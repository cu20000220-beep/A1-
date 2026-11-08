'use strict';
// The real middleware must deny a Pages Preview before touching a binding,
// streamed input or a downstream route. No real service or account is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const middleware = import('../functions/api/_middleware.js');

function context(request, next = () => { throw new Error('downstream must not run'); }) {
  const result = { request, next };
  Object.defineProperty(result, 'env', { get() { throw new Error('Preview must not read environment bindings'); } });
  return result;
}
const routes = [
  ['GET', '/api/auth/config'], ['GET', '/api/auth/session'],
  ['POST', '/api/auth/signup'], ['POST', '/api/auth/login'],
  ['POST', '/api/auth/logout'], ['POST', '/api/auth/reset-password'],
  ['POST', '/api/auth/verify-email'], ['POST', '/api/auth/delete-account'],
  ['GET', '/api/membership'], ['POST', '/api/recommendations'],
  ['GET', '/api/global/account'], ['POST', '/api/global/products'],
  ['POST', '/api/global/comparison'], ['POST', '/api/global/simulate'],
  ['GET', '/api/global/watchlist'], ['PUT', '/api/global/preferences'],
  ['POST', '/api/global/consents'], ['DELETE', '/api/global/history'],
  ['GET', '/api/stylist'], ['POST', '/api/stylist'],
  ['OPTIONS', '/api/stylist'], ['POST', '/api/not-yet-implemented']
];

for (const hostname of ['187c481.a1fashion.pages.dev', 'feature-a1-unified-release.a1fashion.pages.dev',
  'UPPERCASE.A1FASHION.PAGES.DEV', '187c481.a1fashion.pages.dev.']) {
  test(`standard Preview ${hostname} denies all API methods before any environment, body, provider or downstream access`, async t => {
    let fetches = 0;
    t.mock.method(globalThis, 'fetch', async () => { fetches++; throw new Error('No external request is allowed'); });
    const { onRequest } = await middleware;
    for (const [method, path] of routes) {
      const request = new Request(`https://${hostname}${path}`, {
        method, headers: { 'Accept-Language': 'en', 'Content-Type': 'application/json' },
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { body: '{"neverRead":"private fixture"}' } : {})
      });
      const response = await onRequest(context(request));
      assert.equal(response.status, 503, method + ' ' + path);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Content-Language'), 'en');
      const body = await response.json();
      assert.equal(body.error, 'preview_isolated'); assert.equal(body.allowed, false);
      assert.equal(request.bodyUsed, false, 'Middleware cannot consume sensitive credentials or chat content');
      assert.doesNotMatch(JSON.stringify(body), /private fixture|neverRead/);
    }
    assert.equal(fetches, 0);
  });
}

test('Preview locale uses the shared allowlist without exposing raw headers, CORS or configuration', async () => {
  const { onRequest } = await middleware;
  for (const [header, language] of [[undefined, 'ko'], ['ko-KR', 'ko'], ['en-US', 'en'], ['en;q=0.2,ko;q=0.9', 'ko'], ['fr-FR', 'en']]) {
    const response = await onRequest(context(new Request('https://fixture.a1fashion.pages.dev/api/auth/config', {
      headers: header ? { 'Accept-Language': header } : {}
    })));
    assert.equal(response.headers.get('Content-Language'), language);
    assert.equal(response.headers.get('Vary'), 'Accept-Language');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['allowed', 'error', 'message', 'ok']);
    assert.equal(/[가-힣]/u.test(body.message), language === 'ko');
    assert.doesNotMatch(JSON.stringify(body), /FIREBASE|OPENAI|MEMBERSHIP_DB|apiKey|credential|token/i);
  }
});

test('request URL is authoritative; forged origin, host and forwarding headers cannot bypass Preview denial', async () => {
  const { onRequest } = await middleware;
  const response = await onRequest(context(new Request('https://fixture.a1fashion.pages.dev/api/auth/delete-account', {
    method: 'POST', body: 'never read', headers: {
      Host: 'a1fashion.pages.dev', Origin: 'https://a1fashion.pages.dev',
      'X-Forwarded-Host': 'a1fashion.pages.dev', Forwarded: 'host=a1fashion.pages.dev'
    }
  })));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'preview_isolated');
});

test('Production, custom production domains and local fixtures pass through without replacing existing authorization', async () => {
  const { onRequest } = await middleware;
  for (const hostname of ['a1fashion.pages.dev', 'A1FASHION.PAGES.DEV', 'a1fashion.pages.dev.',
    'a1fashion.example', 'localhost', '127.0.0.1:8788', 'other.pages.dev', 'a1fashion.pages.dev.evil.test']) {
    let calls = 0;
    const expected = new Response('existing route authorization remains responsible', { status: 401 });
    const result = await onRequest(context(new Request(`https://${hostname}/api/membership`, {
      headers: { Host: 'fixture.a1fashion.pages.dev', 'X-Forwarded-Host': 'fixture.a1fashion.pages.dev' }
    }), () => { calls++; return expected; }));
    assert.equal(result, expected, hostname);
    assert.equal(calls, 1, hostname);
  }
});

test('once mounted in API routing, encoded and unusual paths cannot opt out of the host isolation policy', async () => {
  const { onRequest } = await middleware;
  for (const pathname of ['/api', '/api/', '/%61pi/auth/signup', '/api%2fauth/signup', '/api//stylist', '/api/auth/%64elete-account']) {
    const response = await onRequest(context(new Request('https://fixture.a1fashion.pages.dev' + pathname)));
    assert.equal(response.status, 503, pathname);
  }
});

test('a streamed Preview credential body stays entirely unread and uncancelled', async () => {
  const { onRequest } = await middleware;
  let pulls = 0, cancellations = 0;
  const body = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new TextEncoder().encode('private credential fixture')); controller.close(); },
    cancel() { cancellations++; }
  }, { highWaterMark: 0 });
  const request = new Request('https://fixture.a1fashion.pages.dev/api/auth/signup', { method: 'POST', body, duplex: 'half' });
  const response = await onRequest(context(request));
  assert.equal(response.status, 503); assert.equal(request.bodyUsed, false);
  assert.equal(pulls, 0); assert.equal(cancellations, 0);
});
