/** Server-only, text-only Responses API transport. No automatic retries. */
import { isFreeBetaMode } from './free-beta.mjs';
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('OpenAI transport is server-only.');

const ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4.1-mini-2025-04-14';
const MAX_BYTES = 64 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const validKey = value => typeof value === 'string' && /^sk-[A-Za-z0-9_-]{17,500}$/.test(value);

export class OpenAIStylistError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const invalid = () => new OpenAIStylistError(502, 'provider_invalid_response');

/** Readiness never returns the secret or accepts a browser-selected model. */
export function getOpenAIStylistConfiguration(env = {}) {
  const liveRequested = !isFreeBetaMode(env) && env.A1_AI_MODE === 'live';
  const approved = !isFreeBetaMode(env) && env.A1_AI_LIVE_APPROVED === 'true';
  const model = env.A1_AI_MODEL === MODEL ? MODEL : null;
  return Object.freeze({ liveRequested, approved,
    ready: liveRequested && approved && model !== null && validKey(env.OPENAI_API_KEY), model });
}

function exact(value, keys) {
  return object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function serializedRequest(body, model, reservation) {
  if (!object(reservation) || typeof reservation.requestId !== 'string'
    || !/^[a-zA-Z0-9_-]{1,128}$/.test(reservation.requestId)
    || !positiveInteger(reservation.reservedMicroUsd) || !positiveInteger(reservation.inputTokenCap)
    || !positiveInteger(reservation.outputTokenCap) || reservation.outputTokenCap > 4096
    || !exact(body, ['model', 'instructions', 'input', 'text', 'store', 'max_output_tokens', 'truncation'])
    || body.model !== model || body.store !== false || body.truncation !== 'disabled'
    || typeof body.instructions !== 'string' || !body.instructions.trim() || body.instructions.length > 12000
    || !positiveInteger(body.max_output_tokens) || body.max_output_tokens > reservation.outputTokenCap
    || !Array.isArray(body.input) || body.input.length !== 1
    || !exact(body.input[0], ['role', 'content']) || body.input[0].role !== 'user'
    || !Array.isArray(body.input[0].content) || body.input[0].content.length !== 1
    || !exact(body.input[0].content[0], ['type', 'text']) || body.input[0].content[0].type !== 'input_text'
    || typeof body.input[0].content[0].text !== 'string'
    || !exact(body.text, ['format']) || !exact(body.text.format, ['type', 'name', 'strict', 'schema'])
    || body.text.format.type !== 'json_schema' || body.text.format.strict !== true
    || typeof body.text.format.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.text.format.name)
    || !object(body.text.format.schema) || body.text.format.schema.type !== 'object'
    || body.text.format.schema.additionalProperties !== false) throw new OpenAIStylistError(503, 'live_not_approved');
  try {
    // Conversation, catalog and preferences are serialized as untrusted data,
    // never elevated to developer/system messages by this transport.
    if (!object(JSON.parse(body.input[0].content[0].text))) throw new Error('invalid-input');
    const serialized = JSON.stringify(body);
    const bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > MAX_BYTES || bytes > reservation.inputTokenCap) throw new Error('unreserved-input');
    return serialized;
  } catch { throw new OpenAIStylistError(503, 'live_not_approved'); }
}

async function readBounded(response) {
  const declared = response.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) {
    await response.body?.cancel(); throw invalid();
  }
  const reader = response.body?.getReader();
  if (!reader) throw invalid();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); throw invalid(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw invalid(); }
}

function result(data, reservation) {
  if (!object(data) || data.status !== 'completed' || data.error != null || data.incomplete_details != null
    || !Array.isArray(data.output) || data.output.length !== 1) throw invalid();
  const message = data.output[0];
  if (!object(message) || message.type !== 'message' || message.role !== 'assistant'
    || message.status !== 'completed' || !Array.isArray(message.content) || message.content.length !== 1
    || message.content[0]?.type !== 'output_text' || typeof message.content[0].text !== 'string') throw invalid();
  const usage = data.usage;
  if (!object(usage) || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 0
    || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0) throw invalid();
  if (usage.input_tokens > reservation.inputTokenCap || usage.output_tokens > reservation.outputTokenCap) {
    throw new OpenAIStylistError(502, 'billed_provider_overrun');
  }
  let plan;
  try { plan = JSON.parse(message.content[0].text); } catch { throw invalid(); }
  if (!object(plan)) throw invalid();
  // The route must still validate every plan identifier against its current
  // server-side catalog. Never publish a provider-generated price or URL.
  return { plan, usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } };
}

/** Only a previously budget-reserved, operator-approved server call can fetch. */
export async function callOpenAIStylist(env, body, { fetchImpl = globalThis.fetch, timeoutMs = 12000, reservation } = {}) {
  const config = getOpenAIStylistConfiguration(env);
  if (!config.ready || typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs)
    || timeoutMs < 1 || timeoutMs > 12000) throw new OpenAIStylistError(503, 'live_not_approved');
  const serialized = serializedRequest(body, config.model, reservation);
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new OpenAIStylistError(504, 'provider_timeout')); }, timeoutMs);
  });
  const transport = async () => {
    const response = await fetchImpl(ENDPOINT, { method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: serialized });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new OpenAIStylistError(429, 'provider_rate_limited');
      throw new OpenAIStylistError(503, 'provider_unavailable');
    }
    if (!/^application\/json(?:\s*;.*)?$/i.test(response.headers.get('Content-Type') || '')) {
      await response.body?.cancel(); throw invalid();
    }
    return result(await readBounded(response), reservation);
  };
  try { return await Promise.race([transport(), timeout]); }
  catch (error) {
    if (error instanceof OpenAIStylistError) throw error;
    if (controller.signal.aborted) throw new OpenAIStylistError(504, 'provider_timeout');
    // No response body, exception details, request text or credentials escape.
    throw new OpenAIStylistError(503, 'provider_unavailable');
  } finally { clearTimeout(timer); }
}
