/* TEKO OWNER V53 — session persistence and rotating refresh regression tests. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const code=fs.readFileSync(path.join(root,"owner-auth.js"),"utf8");
const owner=fs.readFileSync(path.join(root,"owner.js"),"utf8");
const html=fs.readFileSync(path.join(root,"owner.html"),"utf8");
const fakeJwt=i=>"eyJhbGciOiJIUzI1NiJ9."+(String(i).repeat(160))+".signed";
function fixture(storage=new Map(),clock={now:Date.now()},server={rotations:0,logouts:0}){
 let refreshToken="initial-refresh-token-value-"+String(clock.now);
 const results=[];
 const localStorage={
  getItem:k=>storage.get(k)??null,
  setItem:(k,v)=>storage.set(k,v),
  removeItem:k=>storage.delete(k)
 };
 const fetch=async(url,{body,method}={})=>{
  if(url.includes("grant_type=password")){
   return {ok:true,status:200,json:async()=>({
    access_token:fakeJwt(1),refresh_token:refreshToken,expires_in:3600
   })};
  }
  if(url.includes("grant_type=refresh_token")){
   const input=JSON.parse(body);
   results.push(input.refresh_token);
   if(input.refresh_token!==refreshToken)
    return{ok:false,status:400,json:async()=>({error:"invalid_grant"})};
   server.rotations++;
   refreshToken="rotated-refresh-"+server.rotations+"-"+clock.now;
   return {ok:true,status:200,json:async()=>({
    access_token:fakeJwt(server.rotations+2),refresh_token:refreshToken,expires_in:3600
   })};
  }
  if(url.includes("/auth/v1/logout")){
   assert.equal(method,"POST");server.logouts++;
   return {ok:true,status:204,json:async()=>({})};
  }
  throw Error("Unexpected auth URL "+url);
 };
 const events={};
 class FakeDate extends Date{static now(){return clock.now}}
 const window={
  TEKO_OWNER_CONFIG:{projectUrl:"https://test.supabase.co",publicKey:"sb_publishable_test"},
  dispatchEvent:e=>{(events[e.type]||[]).forEach(fn=>fn(e))},
  addEventListener:(type,fn)=>{(events[type]||(events[type]=[])).push(fn)}
 };
 const context={
  window,localStorage,fetch,Date:FakeDate,
  navigator:{},document:{addEventListener(){}},
  setTimeout:()=>11,clearTimeout:()=>{},
  Event:class{constructor(type){this.type=type}},
  AbortSignal:{timeout(){return {}}}
 };
 vm.runInNewContext(code,context);
 return{auth:window.TEKO_OWNER_AUTH,storage,clock,server,results,window};
}
test("Supabase rotating tokens persist only after server-side owner confirmation",async()=>{
 const f=fixture();
 await f.auth.signIn("owner@test.example","redacted");
 assert.equal(f.auth.hasSavedSession(),false,"A signed-in non-owner must never persist");
 f.auth.confirmOwner();
 assert.equal(f.auth.hasSavedSession(),true);
 assert.equal(f.storage.size,1);
 assert.ok(JSON.parse([...f.storage.values()][0]).refreshToken);
 assert.ok(!JSON.stringify([...f.storage.values()][0]).includes("redacted"),"Never save password");
});
test("Owner session survives a full page reload without entering a password",async()=>{
 const f=fixture();
 const first=await f.auth.signIn("owner@test.example","hidden");
 f.auth.confirmOwner();
 const reload=fixture(f.storage,f.clock,f.server);
 assert.equal(await reload.auth.restore(),true);
 assert.equal(await reload.auth.getToken(),first);
 assert.equal(reload.auth.hasSavedSession(),true);
});
test("Expired JWT is refreshed transparently and session saved for a later reload",async()=>{
 const f=fixture();
 const first=await f.auth.signIn("owner@test.example","hidden");f.auth.confirmOwner();
 f.clock.now+=3650*1000;
 const [x,y,z]=await Promise.all([f.auth.getToken(),f.auth.getToken(),f.auth.getToken()]);
 assert.notEqual(x,first);
 assert.equal(x,y);assert.equal(y,z);
 assert.equal(f.server.rotations,1,"The same refresh token cannot be used concurrently");
 const reload=fixture(f.storage,f.clock,f.server);
 assert.equal(await reload.auth.restore(),true);
 assert.equal(await reload.auth.getToken(),x);
});
test("Explicit logout revokes Supabase session and deletes saved credentials",async()=>{
 const f=fixture();
 await f.auth.signIn("owner@test.example","hidden");f.auth.confirmOwner();
 assert.equal(f.auth.hasSavedSession(),true);
 await f.auth.signOut();
 assert.equal(f.server.logouts,1);
 assert.equal(f.storage.size,0);
 assert.equal(f.auth.hasSavedSession(),false);
});
test("Existing owner console verifies owner UID before persisting and restores after reload",()=>{
 const idx=owner.indexOf('await call("list",{page:0,status:"all",search:""});');
 const approved=owner.indexOf("auth.confirmOwner();",idx);
 assert.ok(idx>=0&&approved>idx,"Server-side list call must authorize before saving auth");
 assert.ok(owner.includes('if(configured)void restoreOwner()'));
 assert.ok(owner.includes('state.token=await auth.getToken()'));
 assert.ok(owner.includes('state.token=await auth.refresh(true)'));
 assert.ok(owner.includes("await auth.signOut()"));
 assert.ok(owner.includes("await window.TEKO_OWNER_PUSH_DISABLE?.()"));
 assert.ok(html.indexOf("owner-auth.js?v=53")<html.indexOf("owner.js?v=53"));
 assert.ok(html.includes('owner-auth.js?v=53'));
});
