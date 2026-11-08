'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {resolve}=require('node:path');

test('review-only migrations preserve legacy member records and enforce isolated consent/delivery data',()=>{
 const script=String.raw`
import sqlite3,pathlib,json,sys
root=pathlib.Path(sys.argv[1])
legacy="""CREATE TABLE memberships(issuer TEXT NOT NULL,subject TEXT NOT NULL,subscription_status TEXT NOT NULL DEFAULT 'inactive',paid_through INTEGER,payment_verified_at INTEGER,PRIMARY KEY(issuer,subject)) STRICT;"""
db=sqlite3.connect(':memory:')
db.executescript(legacy)
old=[('https://issuer.example/','one','active',2000,1000),('https://issuer.example/','two','canceled',1900,1000)]
db.executemany('INSERT INTO memberships VALUES(?,?,?,?,?)',old)
for name in ['0001_membership_tiers.sql','0002_global_catalog_and_alerts.sql']:
 db.executescript((root/'server/migrations'/name).read_text())
assert db.execute('SELECT issuer,subject,subscription_status,paid_through,payment_verified_at FROM memberships ORDER BY subject').fetchall()==old
assert db.execute('SELECT plan_code FROM memberships').fetchall()==[('GENERAL',),('GENERAL',)]
assert db.execute('SELECT count(*) FROM memberships WHERE plan_code="PREMIUM"').fetchone()[0]==0
expected={'membership_plans','memberships','retailers','product_offers','price_history','product_watchlists','promotion_events','notification_preferences','notification_consents','notification_deliveries','api_rate_limits'}
assert expected <= {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert db.execute('SELECT price_minor FROM membership_plans').fetchall()==[(None,),(None,),(None,)]
for subject in ['one','two']:
 db.execute('INSERT INTO product_watchlists(id,issuer,subject,product_id,target_price,currency,created_at) VALUES(?,?,?,?,?,?,?)',('same-id','https://issuer.example/',subject,'product',99.99,'USD',1))
assert db.execute('SELECT count(*) FROM product_watchlists').fetchone()[0]==2
try:
 db.execute('INSERT INTO product_watchlists(id,issuer,subject,product_id,currency,created_at) VALUES(?,?,?,?,?,?)',('new-id','https://issuer.example/','one','product','USD',2))
 raise AssertionError('Duplicate watchlist must be rejected')
except sqlite3.IntegrityError:pass
for subject in ['one','two']:
 db.execute('INSERT INTO notification_preferences(issuer,subject,updated_at) VALUES(?,?,?)',('https://issuer.example/',subject,1))
assert db.execute('SELECT email_enabled,sms_enabled,phone_verified FROM notification_preferences').fetchall()==[(0,0,0),(0,0,0)]
for id,channel,subject in [('a','email','one'),('b','sms','one'),('c','email','two')]:
 db.execute('INSERT INTO notification_deliveries(id,issuer,subject,channel,event_id,dedupe_key,status,created_at) VALUES(?,?,?,?,?,?,?,?)',(id,'https://issuer.example/',subject,channel,'event','same-event','dry-run',1))
try:
 db.execute('INSERT INTO notification_deliveries(id,issuer,subject,channel,event_id,dedupe_key,status,created_at) VALUES(?,?,?,?,?,?,?,?)',('duplicate','https://issuer.example/','one','email','event','same-event','dry-run',2))
 raise AssertionError('Duplicate delivery must be rejected')
except sqlite3.IntegrityError:pass
assert db.execute('SELECT count(*) FROM notification_deliveries').fetchone()[0]==3
for _ in range(2):
 count=db.execute('INSERT INTO api_rate_limits(issuer,subject,window_start,request_count) VALUES(?,?,?,1) ON CONFLICT(issuer,subject,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count',('https://issuer.example/','one',0)).fetchone()[0]
assert count==2
fresh=sqlite3.connect(':memory:');fresh.executescript((root/'server/schema.sql').read_text())
assert fresh.execute('SELECT count(*) FROM memberships').fetchone()[0]==0
assert fresh.execute('SELECT count(*) FROM notification_deliveries').fetchone()[0]==0
for database in [db,fresh]:
 for event_type in ['price_drop','brand_promotion','promotion_start','target_reached','promotion_ending']:
  database.execute('INSERT INTO promotion_events(id,event_type,starts_at,checked_at,source_url,source_mode) VALUES(?,?,?,?,?,?)',(event_type,event_type,1,1,'https://official.example/fixture','DEMO'))
 assert database.execute('SELECT count(*) FROM promotion_events').fetchone()[0]==5
 for invalid in ['sale_start','target_price','sale_ending','arbitrary']:
  try:
   database.execute('INSERT INTO promotion_events(id,event_type,starts_at,checked_at,source_url,source_mode) VALUES(?,?,?,?,?,?)',(invalid,invalid,1,1,'https://official.example/fixture','DEMO'))
   raise AssertionError('Unsupported promotion type must be rejected')
  except sqlite3.IntegrityError:pass
print(json.dumps({'preservedMembers':len(old),'tables':len(expected),'freshMemberships':0}))
`;
 const result=JSON.parse(execFileSync('python3',['-c',script,resolve(__dirname,'..')],{encoding:'utf8'}));
 assert.deepEqual(result,{preservedMembers:2,tables:11,freshMemberships:0});
});
