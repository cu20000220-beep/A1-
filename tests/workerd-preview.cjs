'use strict';
// Exercise Wrangler's real Pages router, including its middleware ordering.
// All bindings/assets/providers below are local fixtures; nothing is deployed.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const toolsRoot = process.env.A1_WORKER_TOOLS_ROOT;
const dependency = name => require(toolsRoot ? join(toolsRoot, name) : name);
const { Miniflare, convertV4MiniflareOptions } = dependency('miniflare');
const { build } = dependency('esbuild');
const root = resolve(__dirname, '..');
// Match the existing Pages dashboard date; do not add runtime flags.
const compatibilityDate = '2026-11-04';
const scratch = mkdtempSync(join(tmpdir(), 'a1-preview-router-'));
const wrangler = toolsRoot ? join(toolsRoot, 'wrangler/bin/wrangler.js') : require.resolve('wrangler/bin/wrangler.js');
let runtime;

(async () => {
  execFileSync(process.execPath, [wrangler, 'pages', 'functions', 'build', 'functions',
    '--outdir', join(scratch, 'compiled'), '--output-routes-path', join(scratch, 'routes.json'),
    '--compatibility-date', compatibilityDate], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', XDG_CONFIG_HOME: join(scratch, 'config') },
    stdio: 'pipe', timeout: 60000
  });
  const routes = JSON.parse(readFileSync(join(scratch, 'routes.json'), 'utf8'));
  assert.ok(routes.include.includes('/api/*'), 'The generated routes must cover future API paths with middleware');
  assert.ok(routes.include.every(path => path.startsWith('/api/')), 'Static analysis/model assets must stay outside Functions routes');

  const bundled = await build({ stdin: { contents: `
    import pages from './compiled/index.js';
    let environmentReads=0, databaseReads=0, assetCalls=0;
    const bindings={
      FIREBASE_PROJECT_ID:'a1-preview-local-fixture',
      FIREBASE_WEB_API_KEY:'fixture-preview-key-never-real-123456789',
      OPENAI_API_KEY:'sk-fixture-preview-never-real-123456789',
      MEMBERSHIP_DB:{prepare(){databaseReads++;throw new Error('No test DB query is allowed');}}
    };
    const assets={async fetch(request){
      assetCalls++;
      const path=new URL(request.url).pathname;
      return new Response(path.endsWith('.tflite')?new Uint8Array([1,2,3,4]):'LOCAL STATIC '+path,
        {headers:{'Content-Type':path.endsWith('.tflite')?'application/octet-stream':'text/html'}});
    }};
    export default {async fetch(request,env,ctx){
      const url=new URL(request.url);
      if(url.pathname==='/__local_test_stats')return Response.json({environmentReads,databaseReads,assetCalls});
      const preview=url.hostname.replace(/\\.$/,'').endsWith('.a1fashion.pages.dev');
      const observed=new Proxy(bindings,{
        get(target,key){
          if(key==='ASSETS')return assets;
          environmentReads++;
          if(preview)throw new Error('Preview must never inspect credentials or bindings');
          return Reflect.get(target,key);
        },
        ownKeys(target){environmentReads++;if(preview)throw new Error('Preview must not enumerate bindings');return Reflect.ownKeys(target);}
      });
      return pages.fetch(request,observed,ctx);
    }};
  `, resolveDir: scratch, sourcefile: 'local-preview-router-entry.mjs' }, bundle: true,
  // Preserve runtime built-ins already emitted by Wrangler. Resolving those
  // in this second esbuild pass is a test harness concern, not a runtime flag.
  format: 'esm', platform: 'browser', target: 'es2022', external: ['node:*'], write: false });

  const outbound = [];
  const options = { modules: true, script: bundled.outputFiles[0].text, compatibilityDate,
    outboundService: async request => {
      outbound.push(request.url);
      const url = new URL(request.url);
      assert.equal(url.origin, 'https://identitytoolkit.googleapis.com');
      assert.equal(url.pathname, '/v1/projects');
      assert.equal(request.method, 'GET');
      return Response.json({ authorizedDomains: ['a1fashion.pages.dev'] });
    } };
  runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  const stats = async () => (await runtime.dispatchFetch('https://a1fashion.pages.dev/__local_test_stats')).json();
  const paths = [
    ['/api/auth/config', 'GET'], ['/api/auth/session', 'GET'], ['/api/auth/signup', 'POST'],
    ['/api/auth/login', 'POST'], ['/api/auth/reset-password', 'POST'], ['/api/auth/delete-account', 'POST'],
    ['/api/membership', 'GET'], ['/api/recommendations', 'POST'], ['/api/global/account', 'GET'],
    ['/api/global/watchlist', 'DELETE'], ['/api/global/simulate', 'POST'], ['/api/stylist', 'GET'],
    ['/api/stylist', 'POST'], ['/api/future-private-route', 'PUT']
  ];
  let blocked = 0;
  for (const host of ['abc123.a1fashion.pages.dev', 'feature-a1-unified-release.a1fashion.pages.dev']) {
    for (const [path, method] of paths) {
      const response = await runtime.dispatchFetch(`https://${host}${path}`, {
        method, headers: { 'Accept-Language': 'en-US', Origin: 'https://a1fashion.pages.dev',
          'X-Forwarded-Host': 'a1fashion.pages.dev', 'Content-Type': 'application/json' },
        ...(['GET', 'HEAD'].includes(method) ? {} : { body: '{"fixture":"never read"}' })
      });
      assert.equal(response.status, 503, host + path);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
      const body = await response.json();
      assert.equal(body.error, 'preview_isolated');
      assert.doesNotMatch(JSON.stringify(body), /fixture-preview-key|sk-fixture|FIREBASE_WEB_API_KEY|MEMBERSHIP_DB/);
      blocked++;
    }
  }
  assert.deepEqual(await stats(), { environmentReads: 0, databaseReads: 0, assetCalls: 0 },
    'The compiled middleware must run before every handler and asset fallback');
  assert.equal(outbound.length, 0, 'Preview must not even contact read-only Firebase configuration');

  for (const path of ['/index.html', '/assets/vendor/mediapipe/pose_landmark_lite.tflite']) {
    const response = await runtime.dispatchFetch('https://abc123.a1fashion.pages.dev' + path);
    assert.equal(response.status, 200);
    if (path.endsWith('.tflite')) assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1,2,3,4]);
    else assert.equal(await response.text(), 'LOCAL STATIC /index.html');
  }
  assert.equal((await stats()).environmentReads, 0, 'Static rendering must not inspect production credentials');
  assert.equal((await stats()).assetCalls, 2);

  const production = await runtime.dispatchFetch('https://a1fashion.pages.dev/api/auth/config');
  assert.equal(production.status, 200);
  assert.deepEqual(await production.json(), { configured: true }, 'Production must reach the original real handler');
  assert.ok((await stats()).environmentReads > 0);
  assert.equal((await stats()).databaseReads, 0);
  assert.equal(outbound.length, 1, 'Only the deliberately exercised production fixture reads project configuration');
  console.log(`Workerd Preview passed: real compiled Pages middleware blocks ${blocked} hashed/branch API requests before credential/DB/provider access; static HTML/model passthrough and original Production Firebase handler preserved. All external calls are local fixtures.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (runtime) await runtime.dispose();
  rmSync(scratch, { recursive: true, force: true });
});
