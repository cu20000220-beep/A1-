'use strict';
// Synthetic fetch fixtures only. No API key, paid call or remote request is used.
const test = require('node:test'), assert = require('node:assert/strict');
const adapter = import('../server/openai-stylist.mjs');
const KEY = 'sk-fixture-stylist-key-not-real-123456789';
const MODEL = 'gpt-4.1-mini-2025-04-14';
const env = { A1_AI_MODE: 'live', A1_AI_LIVE_APPROVED: 'true', A1_AI_MODEL: MODEL, OPENAI_API_KEY: KEY };
const reservation = { requestId: 'fixture-reservation-1', reservedMicroUsd: 5000, inputTokenCap: 10000, outputTokenCap: 512 };
function request() { return { model: MODEL, instructions: 'Choose only supplied advice and product identifiers.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ message: 'Recommend a neutral outfit.', catalog: [] }) }] }],
  text: { format: { type: 'json_schema', name: 'a1_stylist', strict: true,
    schema: { type: 'object', additionalProperties: false, properties: { productIds: { type: 'array', items: { type: 'string' } } }, required: ['productIds'] } } },
  store: false, max_output_tokens: 512, truncation: 'disabled' }; }
function completed(overrides = {}) { return { status: 'completed',
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ productIds: [] }) }] }],
  usage: { input_tokens: 140, output_tokens: 30 }, ...overrides }; }
async function expectError(operation, status, code) {
  await assert.rejects(operation, error => { assert.equal(error.status, status); assert.equal(error.code, code);
    assert.doesNotMatch(error.message, new RegExp(KEY)); return true; });
}

test('default, key-only, unapproved or unpinned configurations never make a request', async () => {
  const { callOpenAIStylist, getOpenAIStylistConfiguration } = await adapter;
  let calls = 0;
  for (const configuration of [{}, { OPENAI_API_KEY: KEY }, { ...env, A1_AI_MODE: undefined },
    { ...env, A1_AI_LIVE_APPROVED: 'false' }, { ...env, A1_AI_MODEL: 'gpt-4.1-mini' },
    { ...env, OPENAI_API_KEY: `${KEY}\n` }, { ...env, OPENAI_API_KEY: 'secret' }]) {
    const config = getOpenAIStylistConfiguration(configuration);
    assert.equal(config.ready, false); assert.equal(config.OPENAI_API_KEY, undefined);
    assert.doesNotMatch(JSON.stringify(config), new RegExp(KEY));
    await expectError(() => callOpenAIStylist(configuration, request(), { reservation, fetchImpl: async () => { calls++; } }), 503, 'live_not_approved');
  }
  assert.equal(calls, 0);
});

test('a valid reservation is required and text-only strict requests reject unsupported API features', async () => {
  const { callOpenAIStylist } = await adapter;
  let calls = 0;
  const invoke = (body, current) => callOpenAIStylist(env, body, { reservation: current, fetchImpl: async () => { calls++; } });
  for (const current of [undefined, {}, { ...reservation, reservedMicroUsd: 0 }, { ...reservation, inputTokenCap: 1 },
    { ...reservation, outputTokenCap: 511 }, { ...reservation, requestId: 'bad\nrequest' }]) {
    await expectError(() => invoke(request(), current), 503, 'live_not_approved');
  }
  for (const update of [{ model: 'unapproved' }, { tools: [] }, { background: true }, { previous_response_id: 'old' },
    { store: true }, { truncation: 'auto' }, { max_output_tokens: 513 },
    { input: [{ role: 'system', content: [{ type: 'input_text', text: '{}' }] }] },
    { input: [{ role: 'user', content: [{ type: 'input_image', image_url: 'https://private.example/photo.jpg' }] }] },
    { input: [{ role: 'user', content: [{ type: 'input_text', text: 'not JSON' }] }] },
    { input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ message: 'x'.repeat(70 * 1024) }) }] }] },
    { text: { format: { type: 'text' } } }]) {
    await expectError(() => invoke({ ...request(), ...update }, reservation), 503, 'live_not_approved');
  }
  assert.equal(calls, 0);
});

test('approved transport uses one fixed Responses endpoint with no image, tools, storage or retries', async () => {
  const { callOpenAIStylist, getOpenAIStylistConfiguration } = await adapter;
  assert.equal(getOpenAIStylistConfiguration(env).ready, true);
  let calls = 0;
  const result = await callOpenAIStylist(env, request(), { reservation, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.model, MODEL);
    assert.equal(body.max_output_tokens, 512); assert.equal(body.tools, undefined); assert.equal(body.previous_response_id, undefined);
    assert.equal(body.input[0].content[0].type, 'input_text');
    assert.equal(body.text.format.strict, true); return Response.json(completed());
  } });
  assert.deepEqual(result, { plan: { productIds: [] }, usage: { inputTokens: 140, outputTokens: 30 } });
  assert.equal(calls, 1);
});

test('redirects, rate limits and provider failures are bounded safe errors without retries or leaking bodies', async () => {
  const { callOpenAIStylist } = await adapter;
  for (const [status, expectedStatus, code] of [[302, 503, 'provider_unavailable'], [429, 429, 'provider_rate_limited'],
    [400, 503, 'provider_unavailable'], [401, 503, 'provider_unavailable'], [500, 503, 'provider_unavailable']]) {
    let calls = 0, canceled = false;
    const fetchImpl = async () => { calls++; return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(`private: ${KEY}`)); }, cancel() { canceled = true; }
    }), { status, headers: { Location: 'https://never-follow.example.test/' } }); };
    await expectError(() => callOpenAIStylist(env, request(), { reservation, fetchImpl }), expectedStatus, code);
    assert.equal(calls, 1); assert.equal(canceled, true);
  }
  await expectError(() => callOpenAIStylist(env, request(), { reservation, fetchImpl: async () => { throw new Error(`private ${KEY}`); } }), 503, 'provider_unavailable');
});

test('a timeout bounds both headers and body reads even if a fetch fixture ignores its signal', async () => {
  const { callOpenAIStylist } = await adapter;
  for (const fetchImpl of [async () => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } })]) {
    await expectError(() => callOpenAIStylist(env, request(), { reservation, timeoutMs: 10, fetchImpl }), 504, 'provider_timeout');
  }
});

test('incomplete, refusal, malformed, excess and over-budget outputs never return a plan', async () => {
  const { callOpenAIStylist } = await adapter;
  const invalidData = [completed({ status: 'incomplete' }), completed({ error: { message: KEY } }),
    completed({ output: [] }), completed({ output: [{ type: 'function_call', arguments: '{}' }] }),
    completed({ output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'No' }] }] }),
    completed({ output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: KEY }] }] }),
    completed({ usage: { input_tokens: -1, output_tokens: 2 } }), completed({ usage: null })];
  for (const value of invalidData) await expectError(() => callOpenAIStylist(env, request(), { reservation, fetchImpl: async () => Response.json(value) }), 502, 'provider_invalid_response');
  for (const response of [new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    new Response('not JSON', { headers: { 'Content-Type': 'text/plain' } }),
    new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '70000' } }),
    new Response('x'.repeat(70000), { headers: { 'Content-Type': 'application/json' } })]) {
    await expectError(() => callOpenAIStylist(env, request(), { reservation, fetchImpl: async () => response }), 502, 'provider_invalid_response');
  }
  for (const usage of [{ input_tokens: 10001, output_tokens: 1 }, { input_tokens: 1, output_tokens: 513 }]) {
    await expectError(() => callOpenAIStylist(env, request(), { reservation, fetchImpl: async () => Response.json(completed({ usage })) }), 502, 'billed_provider_overrun');
  }
});
