'use strict';
// Actual isolated SQLite and concurrent worker connections. No provider calls,
// real account data, operational databases, API keys or charges are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { Worker } = require('node:worker_threads');
const mod = import('../server/ai-usage.mjs');
const schema = readFileSync(resolve(__dirname,'../server/migrations/0003_ai_stylist_usage.sql'),'utf8');
const NOW = Date.parse('2026-11-05T12:00:00Z');
const identity = { issuer: 'https://test-members.example/', subject: 'private-member-A' };
const other = { ...identity, subject: 'private-member-B' };
const settings = {
  A1_AI_DAILY_USER_LIMIT: '3', A1_AI_DAILY_BUDGET_MICRO_USD: '100000',
  A1_AI_MONTHLY_BUDGET_MICRO_USD: '1000000',
  A1_AI_INPUT_MICRO_USD_PER_MILLION_TOKENS: '1000000',
  A1_AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS: '2000000'
};
const packet = JSON.stringify({ input: 'Style advice 한국어 test', schema: { products: [] } });

function d1(sql) {
  return {
    prepare(query) { return { bind(...values) { const statement = sql.prepare(query); return {
      first: async () => statement.get(...values) || null,
      all: async () => ({ results: statement.all(...values) }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } })
    }; } }; },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
      catch(error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
}
function fixture() { const sql = new DatabaseSync(':memory:'); sql.exec(schema); return { sql, db: d1(sql), close() { sql.close(); } }; }
async function reserve(f, extra = {}, env = settings) {
  const m = await mod;
  return m.reserveAiUsage(f.db,{ identity, limits: m.readAiUsageLimits(env), serializedInput: packet, maxOutputTokens:100, now:NOW, ...extra });
}
const errorCode = code => error => error?.code === code;

test('API keys or flags cannot activate zero/default budgets; configuration rejects malformed limits',async()=>{
  const m = await mod, f = fixture();
  try {
    assert.equal(m.readAiUsageLimits({}).configured,false);
    assert.equal(m.readAiUsageLimits({ OPENAI_API_KEY:'fixture-key',A1_AI_LIVE_APPROVED:'true' }).configured,false);
    for(const [key] of Object.entries(settings)) {
      for(const invalid of ['-1','1.2',' 10','1e4','Infinity','9007199254740993',null,true]) {
        assert.throws(()=>m.readAiUsageLimits({...settings,[key]:invalid}),errorCode('ai_budget_configuration_invalid'));
      }
      assert.equal(m.readAiUsageLimits({...settings,[key]:'0'}).configured,false);
    }
    await assert.rejects(reserve(f,{},{}),errorCode('ai_budget_not_configured'));
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM ai_usage_reservations').get().n,0);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM ai_usage_buckets').get().n,0);
  } finally { f.close(); }
});

test('reservation estimates all complete-request UTF8 bytes plus framing and ceil integer micro-USD without optimistic token ratios',async()=>{
  const m = await mod, limits=m.readAiUsageLimits(settings);
  const e=m.estimateAiReservation({serializedInput:packet,maxOutputTokens:100,limits});
  assert.equal(e.inputTokenCap,Buffer.byteLength(packet,'utf8')+1024);
  assert.equal(e.outputTokenCap,100); assert.equal(e.reservedMicroUsd,e.inputTokenCap+200);
  const fractional=m.estimateAiReservation({serializedInput:'{}',maxOutputTokens:1,
    limits:m.readAiUsageLimits({...settings,A1_AI_INPUT_MICRO_USD_PER_MILLION_TOKENS:'1',A1_AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS:'1'})});
  assert.equal(fractional.reservedMicroUsd,1,'Fractions always round upward, never to free zero');
  for(const maxOutputTokens of [0,8193,1.5,Infinity])assert.throws(()=>m.estimateAiReservation({serializedInput:packet,maxOutputTokens,limits}),errorCode('ai_usage_input_invalid'));
  assert.throws(()=>m.estimateAiReservation({serializedInput:'한'.repeat(100000),maxOutputTokens:100,limits}),errorCode('ai_usage_input_too_large'));
});

test('atomic reservation checks user day, global day and global month caps and rejects duplicate request IDs',async()=>{
  const m=await mod,f=fixture();
  try {
    const e=m.estimateAiReservation({serializedInput:packet,maxOutputTokens:100,limits:m.readAiUsageLimits(settings)});
    const env={...settings,A1_AI_DAILY_USER_LIMIT:'2',A1_AI_DAILY_BUDGET_MICRO_USD:String(e.reservedMicroUsd*3),A1_AI_MONTHLY_BUDGET_MICRO_USD:String(e.reservedMicroUsd*4)};
    const one=await reserve(f,{requestId:'fixture-request-one'},env);
    await assert.rejects(reserve(f,{requestId:one.requestId},env),errorCode('ai_usage_limit'));
    await reserve(f,{},env);
    await assert.rejects(reserve(f,{},env),errorCode('ai_usage_limit'));
    await reserve(f,{identity:other},env);
    await assert.rejects(reserve(f,{identity:{...other,subject:'third'}},env),errorCode('ai_usage_limit'));
    await reserve(f,{identity:other,now:NOW+86400000},env);
    await assert.rejects(reserve(f,{identity:other,now:NOW+86400000},env),errorCode('ai_usage_limit'));
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM ai_usage_reservations').get().n,4);
    assert.equal(f.sql.prepare("SELECT reserved_micro_usd AS cost FROM ai_usage_buckets WHERE scope='global_month'").get().cost,e.reservedMicroUsd*4);
  } finally { f.close(); }
});

test('errors, unknown timeouts, successful cheap usage and replayed completion never refund conservative reservations',async()=>{
  const m=await mod,f=fixture();
  try {
    for(const state of ['succeeded','failed','uncertain']) {
      const r=await reserve(f);
      await m.finishAiUsage(f.db,r,{state,inputTokens:10,outputTokens:1,now:NOW+100});
      await m.finishAiUsage(f.db,r,{state:'succeeded',inputTokens:0,outputTokens:0,now:NOW+200});
      const row=f.sql.prepare('SELECT * FROM ai_usage_reservations WHERE request_id=?').get(r.requestId);
      assert.equal(row.state,state); assert.equal(row.finished_at,NOW+100);
    }
    const row=f.sql.prepare("SELECT request_count AS calls,reserved_micro_usd AS cost FROM ai_usage_buckets WHERE scope='global_day'").get();
    const e=m.estimateAiReservation({serializedInput:packet,maxOutputTokens:100,limits:m.readAiUsageLimits(settings)});
    assert.equal(row.calls,3);assert.equal(row.cost,e.reservedMicroUsd*3);
    await assert.rejects(reserve(f),errorCode('ai_usage_limit'));
  } finally { f.close(); }
});

test('budget periods roll over at UTC day/month boundaries, independent of user timezone',async()=>{
  const m=await mod,f=fixture();
  try {
    const e=m.estimateAiReservation({serializedInput:packet,maxOutputTokens:100,limits:m.readAiUsageLimits(settings)});
    const env={...settings,A1_AI_DAILY_USER_LIMIT:'1',A1_AI_DAILY_BUDGET_MICRO_USD:String(e.reservedMicroUsd),A1_AI_MONTHLY_BUDGET_MICRO_USD:String(e.reservedMicroUsd)};
    const before=Date.parse('2026-11-30T23:59:59.999Z'),after=before+1;
    await reserve(f,{now:before},env);await assert.rejects(reserve(f,{now:before},env),errorCode('ai_usage_limit'));
    await reserve(f,{now:after},env);
    assert.deepEqual(f.sql.prepare("SELECT period FROM ai_usage_buckets WHERE scope='global_month' ORDER BY period").all().map(x=>x.period),['2026-11','2026-12']);
    await assert.rejects(reserve(f,{now:Infinity}),errorCode('ai_usage_storage_unavailable'));
    await assert.rejects(reserve(f,{now:253_402_300_800_000}),errorCode('ai_usage_storage_unavailable'));
  } finally { f.close(); }
});

test('hashed account erasure removes only owned usage; global spending totals survive deletion and missing migrations fail closed',async()=>{
  const m=await mod,f=fixture();
  try {
    const a=await reserve(f),b=await reserve(f,{identity:other});
    assert.match(a.ownerHash,/^[a-f0-9]{64}$/);assert.notEqual(a.ownerHash,b.ownerHash);
    const raw=JSON.stringify(f.sql.prepare('SELECT * FROM ai_usage_reservations').all());
    assert.ok(!raw.includes(identity.subject)&&!raw.includes(identity.issuer)&&!raw.includes('Style advice'));
    await m.eraseAiMemberUsage(f.db,identity);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM ai_usage_reservations WHERE owner_hash=?').get(a.ownerHash).n,0);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM ai_usage_reservations WHERE owner_hash=?').get(b.ownerHash).n,1);
    assert.equal(f.sql.prepare("SELECT request_count AS calls FROM ai_usage_buckets WHERE scope='global_day'").get().calls,2);
    f.sql.exec('DROP TRIGGER ai_usage_reservation_counters');
    await assert.rejects(reserve(f),errorCode('ai_usage_limit'),'A partially-applied migration cannot reserve without its atomic trigger');
    const empty=new DatabaseSync(':memory:');
    try { await m.eraseAiMemberUsage(d1(empty),identity); await assert.rejects(m.reserveAiUsage(d1(empty),{identity,limits:m.readAiUsageLimits(settings),serializedInput:packet,maxOutputTokens:100,now:NOW}),errorCode('ai_usage_storage_unavailable')); }
    finally { empty.close(); }
    await assert.rejects(m.eraseAiMemberUsage({prepare(){throw new Error('storage offline');}},identity),/storage offline/);
  } finally { f.close(); }
});

test('ten concurrent real SQLite connections cannot overspend the shared cost cap or either member daily quota',async()=>{
  const m=await mod,folder=mkdtempSync(join(tmpdir(),'a1-ai-usage-')),path=join(folder,'usage.db');
  const sql=new DatabaseSync(path);sql.exec(schema);sql.close();
  const e=m.estimateAiReservation({serializedInput:packet,maxOutputTokens:100,limits:m.readAiUsageLimits(settings)});
  const env={...settings,A1_AI_DAILY_USER_LIMIT:'2',A1_AI_DAILY_BUDGET_MICRO_USD:String(e.reservedMicroUsd*3)};
  const moduleUrl=pathToFileURL(resolve(__dirname,'../server/ai-usage.mjs')).href;
  const script=`const {parentPort,workerData:w}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');
    (async()=>{const m=await import(w.moduleUrl),sql=new DatabaseSync(w.path);sql.exec('PRAGMA busy_timeout=10000');
    const db={prepare(q){return{bind(...v){return{first:async()=>sql.prepare(q).get(...v)||null}}}}};
    try{await m.reserveAiUsage(db,{identity:w.identity,limits:m.readAiUsageLimits(w.env),serializedInput:w.packet,maxOutputTokens:100,now:w.now});parentPort.postMessage('reserved');}
    catch(e){parentPort.postMessage(e.code||'unexpected-error');}finally{sql.close();}})().catch(e=>{parentPort.postMessage('unexpected-error');});`;
  try {
    const results=await Promise.all(Array.from({length:10},(_,index)=>new Promise((resolve,reject)=>{
      const worker=new Worker(script,{eval:true,workerData:{moduleUrl,path,identity:index%2?other:identity,env,packet,now:NOW}});
      worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code)reject(new Error('Worker failed'));});
    })));
    assert.equal(results.filter(x=>x==='reserved').length,3);assert.ok(results.every(x=>['reserved','ai_usage_limit'].includes(x)),JSON.stringify(results));
    const inspect=new DatabaseSync(path);
    try {
      assert.equal(inspect.prepare("SELECT reserved_micro_usd AS cost FROM ai_usage_buckets WHERE scope='global_day'").get().cost,e.reservedMicroUsd*3);
      assert.ok(inspect.prepare("SELECT request_count AS calls FROM ai_usage_buckets WHERE scope='user_day'").all().every(x=>x.calls<=2));
    } finally { inspect.close(); }
  } finally { rmSync(folder,{recursive:true,force:true}); }
});
