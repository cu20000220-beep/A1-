'use strict';
// Actual SQLite statements only. No provider, contact verification, account,
// live promotion, production D1 or outgoing message is used by these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const modulePromise = import('../server/promotion-simulation.mjs');
const memberDataPromise = import('../server/member-data.mjs');
const NOW = Date.UTC(2026,10,6,9);
const ISSUER = 'https://promotion-members.example.test/';
const OWNER = { issuer:ISSUER,subject:'member-a',email:'private-recipient@example.test',phone:'+821012345678' };

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../server/schema.sql',`file://${__filename}`),'utf8'));
  const hooks={beforeFirst:null,afterFirst:null},queries=[];
  const db={prepare(query){queries.push(query);const statement=sql.prepare(query);return{bind(...values){return{
    async first(){if(hooks.beforeFirst)await hooks.beforeFirst(query,values);const row=statement.get(...values)||null;if(hooks.afterFirst)await hooks.afterFirst(query,values,row);return row;},
    async all(){return{results:statement.all(...values)};},
    async run(){return{meta:{changes:Number(statement.run(...values).changes)}};}
  };}};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  function member(subject='member-a',plan='PREMIUM',status='active',expiry=NOW+30*86400000,verified=NOW-1000){
    sql.prepare('INSERT OR REPLACE INTO memberships(issuer,subject,plan_code,subscription_status,paid_through,payment_verified_at) VALUES(?,?,?,?,?,?)').run(ISSUER,subject,plan,status,expiry,verified);
  }
  function prefs(subject='member-a',extra={}){
    const p={country:'US',timeZone:'America/New_York',language:'en',frequency:'immediate',emailEnabled:true,smsEnabled:false,brands:[],categories:[],...extra};
    sql.prepare(`INSERT OR REPLACE INTO notification_preferences(issuer,subject,country,time_zone,language,frequency,email_enabled,sms_enabled,phone_e164,phone_verified,brands_json,categories_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?)`)
      .run(ISSUER,subject,p.country,p.timeZone,p.language,p.frequency,Number(p.emailEnabled),Number(p.smsEnabled),'+821012345678',JSON.stringify(p.brands),JSON.stringify(p.categories),NOW-1);
  }
  let sequence=0;
  function consent(subject='member-a',channel='email',granted=true,at=NOW-10){
    sql.prepare('INSERT INTO notification_consents(issuer,subject,id,channel,granted,policy_version,occurred_at) VALUES(?,?,?,?,?,?,?)')
      .run(ISSUER,subject,`consent-${String(++sequence).padStart(4,'0')}`,channel,Number(granted),'fixture-policy',at);
  }
  function watch(subject='member-a',target=40,currency='USD',productId='demo-tee'){
    sql.prepare('INSERT OR REPLACE INTO product_watchlists(id,issuer,subject,product_id,target_price,currency,created_at) VALUES(?,?,?,?,?,?,?)').run('watch-'+productId,ISSUER,subject,productId,target,currency,NOW-1);
  }
  async function run(options={}){return(await modulePromise).runMemberPromotionSimulation(db,{identity:OWNER,now:NOW,...options});}
  function ready(extra={}){member();prefs('member-a',extra);consent();watch();}
  return{sql,db,hooks,queries,member,prefs,consent,watch,run,ready,close:()=>sql.close()};
}

test('five DEMO conditions use fictional stable events and never imported product or recipient data',async()=>{
  const f=fixture();f.ready();const originalFetch=globalThis.fetch;let externalCalls=0;
  globalThis.fetch=async()=>{externalCalls++;throw new Error('Network forbidden by fixture');};
  try{
    const result=await f.run();assert.equal(result.mode,'DEMO');assert.equal(result.sent,false);assert.equal(result.created,5);assert.equal(result.eventCount,5);
    assert.deepEqual(result.previews.map(row=>row.eventTypes[0]).sort(),['price_drop','target_reached','brand_promotion','promotion_start','promotion_ending'].sort());
    assert.ok(result.previews.every(row=>row.channel==='email'&&row.template.demo&&row.template.mode==='DRY_RUN'&&row.template.liveDeliveryEnabled===false));
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM notification_deliveries WHERE status=?').get('simulated').n,5);
    const serialized=JSON.stringify([result,f.sql.prepare('SELECT payload_json FROM notification_deliveries').all()]);
    assert.doesNotMatch(serialized,/private-recipient|\+821012345678|promotion-members|member-a|body.?photo|analysis.?ratio/i);
    assert.ok(!f.queries.some(query=>/SELECT.+(?:phone_e164|phone_verified)/i.test(query)),'Preview does not read or claim verification of a real SMS contact');
    assert.equal(externalCalls,0);
    const events=(await modulePromise).demoPromotionEvents(NOW);
    assert.deepEqual(events,(await modulePromise).demoPromotionEvents(NOW+1000).map(event=>({...event,checkedAt:NOW})));
  }finally{globalThis.fetch=originalFetch;f.close();}
});

test('FREE, GENERAL, missing, expired, refunded, unpaid and unverified memberships cannot simulate Premium alerts',async()=>{
  for(const row of [['FREE','active',NOW+1,NOW-1],['GENERAL','active',NOW+1,NOW-1],['PREMIUM','canceled',NOW+1,NOW-1],['PREMIUM','past_due',NOW+1,NOW-1],['PREMIUM','unpaid',NOW+1,NOW-1],['PREMIUM','active',NOW,NOW-1],['PREMIUM','inactive',NOW+1,null],['PREMIUM','active',NOW+100,NOW+1]]){
    const f=fixture();try{f.member('member-a',...row);await assert.rejects(f.run(),error=>error.status===403&&error.code==='premium_required');assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM notification_deliveries').get().n,0);}finally{f.close();}
  }
  const f=fixture();try{await assert.rejects(f.run(),error=>error.status===403);}finally{f.close();}
});

test('default preferences and channel-specific consent stay off; SMS templates never require or claim phone verification',async()=>{
  const f=fixture();f.member();f.watch();
  try{
    assert.equal((await f.run()).reason,'preferences_disabled');
    f.prefs('member-a',{smsEnabled:true});assert.equal((await f.run()).reason,'consent_required');
    f.consent('member-a','email');const email=await f.run();assert.equal(email.created,5);assert.ok(email.previews.every(item=>item.channel==='email'));
    f.consent('member-a','sms');const sms=await f.run();assert.equal(sms.created,5);assert.ok(sms.previews.every(item=>item.channel==='sms'));
    assert.equal(f.sql.prepare('SELECT phone_verified FROM notification_preferences').get().phone_verified,0);
    assert.ok(sms.previews.every(item=>item.template.text.includes('No real message is sent')));
  }finally{f.close();}
});

test('target prices use exact currency and threshold; only own watchlists or explicit brand/category interests match',async()=>{
  for(const [target,currency,expected]of[[38,'USD',false],[39,'USD',true],[40,'EUR',false],[null,'USD',false]]){
    const f=fixture();f.member();f.prefs();f.consent();f.watch('member-a',target,currency);
    try{const result=await f.run();assert.equal(result.previews.some(row=>row.eventTypes.includes('target_reached')),expected);assert.equal(result.eventCount,expected?5:4);}finally{f.close();}
  }
  const f=fixture();f.member();f.member('member-b');f.prefs();f.consent();f.watch('member-b');
  try{
    assert.equal((await f.run()).reason,'no_matching_interests');
    f.prefs('member-a',{brands:['A1 DEMO']});const brand=await f.run();assert.equal(brand.created,3);assert.ok(brand.previews.every(row=>!row.eventTypes.includes('price_drop')&&!row.eventTypes.includes('target_reached')));
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM notification_deliveries WHERE subject=?').get('member-b').n,0);
  }finally{f.close();}
});

test('daily and weekly preferences create one localized digest per channel and local period',async()=>{
  const f=fixture();f.ready({frequency:'daily',language:'ko',country:'KR',timeZone:'Asia/Seoul',smsEnabled:true});f.consent('member-a','sms');
  try{
    const first=await f.run();assert.equal(first.created,2);assert.ok(first.previews.every(row=>row.eventTypes.length===5&&row.template.subject.includes('일간 모의 요약')));
    const next=await f.run({now:NOW+3600000});assert.equal(next.created,0);assert.equal(next.duplicates,2);
    f.prefs('member-a',{frequency:'weekly',language:'en',timeZone:'America/Los_Angeles'});
    const weekly=await f.run();assert.equal(weekly.created,1);assert.match(weekly.previews[0].template.subject,/Weekly preview summary/);
    const tomorrow=await f.run({now:NOW+86400000});assert.equal(tomorrow.created,0);assert.equal(tomorrow.duplicates,1);
  }finally{f.close();}
  const local=fixture();local.ready({frequency:'daily',timeZone:'America/Los_Angeles'});
  try{
    const before=Date.UTC(2026,10,6,23,30),after=Date.UTC(2026,10,7,0,30);
    assert.equal((await local.run({now:before})).created,1);
    assert.equal((await local.run({now:after})).duplicates,1,'A UTC date boundary does not start a new Los Angeles digest period');
  }finally{local.close();}
});

test('concurrent repeat simulations atomically claim each event/channel once and deleting history cannot resend it',async()=>{
  const f=fixture();f.ready({smsEnabled:true});f.consent('member-a','sms');
  try{
    const results=await Promise.all(Array.from({length:6},()=>f.run()));
    assert.equal(results.reduce((sum,result)=>sum+result.created,0),10);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM notification_deliveries').get().n,10);
    const store=new(await memberDataPromise).MemberStore(f.db,OWNER,NOW);await store.deleteHistory();
    assert.ok(f.sql.prepare('SELECT status,payload_json FROM notification_deliveries').all().every(row=>row.status==='deleted'&&row.payload_json==='{}'));
    const repeat=await f.run();assert.equal(repeat.created,0);assert.equal(repeat.duplicates,10);assert.equal(repeat.previews.length,0);
  }finally{f.close();}
});

test('withdrawal immediately before a claim or while pending suppresses records and returned templates',async()=>{
  for(const when of ['before','pending','finalized']){
    const f=fixture();f.ready({frequency:'daily'});let changed=false;
    const withdraw=()=>{if(changed)return;changed=true;f.consent('member-a','email',false,NOW);};
    if(when==='before')f.hooks.beforeFirst=(query)=>{if(query.startsWith('INSERT INTO notification_deliveries'))withdraw();};
    else f.hooks.afterFirst=(query,values,row)=>{if(row&&(when==='pending'?query.startsWith('INSERT INTO notification_deliveries'):query.startsWith('UPDATE notification_deliveries SET status = \'simulated\'')))withdraw();};
    try{
      const result=await f.run();assert.equal(changed,true);assert.equal(result.created,0);assert.equal(result.previews.length,0);assert.equal(result.suppressed,1);
      assert.ok(f.sql.prepare('SELECT status,payload_json FROM notification_deliveries').all().every(row=>row.status==='canceled'&&row.payload_json==='{}'));
    }finally{f.close();}
  }
});

test('removing interest, changing preferences or revoking Premium after the initial read blocks the atomic write',async()=>{
  for(const change of ['watch','language','membership']){
    const f=fixture();f.ready({frequency:'daily'});let changed=false;
    f.hooks.beforeFirst=(query)=>{if(!changed&&query.startsWith('INSERT INTO notification_deliveries')){changed=true;
      if(change==='watch')f.sql.prepare('DELETE FROM product_watchlists WHERE subject=?').run('member-a');
      if(change==='language')f.sql.prepare('UPDATE notification_preferences SET language=? WHERE subject=?').run('ko','member-a');
      if(change==='membership')f.sql.prepare('UPDATE memberships SET subscription_status=? WHERE subject=?').run('canceled','member-a');
    }};
    try{const result=await f.run();assert.equal(result.created,0);assert.equal(result.suppressed,1);assert.equal(result.previews.length,0);}finally{f.close();}
  }
});

test('missing tables, unavailable storage and invalid identity/origin never look like a successful simulation',async()=>{
  const f=fixture();f.ready();
  try{
    for(const identity of [null,{issuer:ISSUER,subject:''},{issuer:ISSUER,subject:'bad\nsubject'}])await assert.rejects(f.run({identity}),error=>error.status===400);
    for(const origin of ['http://a1fashion.pages.dev','https://a1fashion.pages.dev/extra','https://user:password@a1fashion.pages.dev'])await assert.rejects(f.run({origin}),error=>error.status===400);
    f.sql.exec('DROP TABLE notification_deliveries');await assert.rejects(f.run(),error=>error.status===503&&error.code==='setup_required');
    await assert.rejects((await modulePromise).runMemberPromotionSimulation({}, {identity:OWNER,now:NOW}),error=>error.status===503);
    await assert.rejects((await modulePromise).runMemberPromotionSimulation({prepare(){throw new Error('private SQL failure');}}, {identity:OWNER,now:NOW}),error=>error.status===503&&!error.message.includes('private SQL'));
  }finally{f.close();}
});

test('current clock rechecks membership expiry and event windows after an asynchronous claim',async()=>{
  for(const expiry of ['subscription','period']){
    const f=fixture();f.ready({frequency:'daily'});if(expiry==='subscription')f.member('member-a','PREMIUM','active',NOW+1000);
    let time=NOW,claimed=false;
    f.hooks.afterFirst=(query,values,row)=>{if(!claimed&&row&&query.startsWith('INSERT INTO notification_deliveries')){claimed=true;time=expiry==='subscription'?NOW+1001:Math.floor(NOW/86400000)*86400000+86400000;}};
    try{const result=await f.run({clock:()=>time});assert.equal(claimed,true);assert.equal(result.created,0);assert.equal(result.previews.length,0);assert.equal(result.suppressed,1);assert.equal(f.sql.prepare('SELECT status FROM notification_deliveries').get().status,'canceled');}finally{f.close();}
  }
});
