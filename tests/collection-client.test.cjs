const test=require('node:test'),assert=require('node:assert/strict');
const Client=require('../collection-client.js');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
test('credential is persisted before first request and reused across retries',async()=>{
 const storage=memory(),seen=[];const fetch=async(url,options)=>{seen.push(options);if(seen.length===1)throw Error('offline');return Response.json({assignment:{role:'judge'}})};
 const c=Client.create({baseUrl:'https://example.test',storage,key:'test',fetch,crypto:globalThis.crypto});
 await assert.rejects(c.start('judge',true),/网络/);const r=await c.start('judge',true);assert.equal(r.assignment.role,'judge');assert.equal(seen[0].headers.Authorization,seen[1].headers.Authorization);assert.equal(seen[1].credentials,'omit');
 assert.equal(JSON.parse(seen[1].body).consent.version,Client.CONSENT);
 const c2=Client.create({baseUrl:'https://example.test',storage,key:'test',fetch,crypto:globalThis.crypto});await c2.session();assert.equal(seen[2].headers.Authorization,seen[1].headers.Authorization);
});
test('server errors never become successful local submissions',async()=>{
 const c=Client.create({baseUrl:'https://example.test',storage:memory(),key:'test',crypto:globalThis.crypto,fetch:async()=>Response.json({error:'合计须为 100'},{status:400})});
 await assert.rejects(c.submit({}),e=>e.status===400&&e.message==='合计须为 100');
});
test('recovery discards confirmed pending case before advancing to case two',()=>{
 const first={caseType:'natural'},session={caseOrder:['natural','statutory'],caseIndex:0,responses:[first]};
 assert.equal(Client.pendingForSession(first,session),null);
 const second={caseType:'statutory'},advanced={...session,caseIndex:1};
 assert.equal(Client.pendingForSession(second,advanced),second);
 assert.equal(Client.pendingForSession(first,advanced),null);
 assert.throws(()=>Client.pendingForSession(second,{...session,responses:[]}),/不一致/);
});
