/* TEKO V52 — one sound for every owner event + secure background push wiring */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const base=path.resolve(__dirname,"..");
const src=p=>fs.readFileSync(path.join(base,p),"utf8");
const audio=src("owner-sound.js");
const push=src("owner-push.js");
const owner=src("owner-notifications.js");
const api=src("supabase/functions/teko-order-notifications/index.ts");
const sender=src("supabase/functions/teko-owner-push-dispatch/index.ts");
const sw=src("sw.js"),html=src("owner.html");

test("One common notification sound is used for new orders and all status changes",()=>{
 assert.ok(!/event_type.*(?:frequency|chime)|frequency.*event_type/.test(audio));
 assert.ok(audio.includes('osc.frequency.setValueAtTime(650,now)'));
 assert.ok(audio.includes("teko-owner-alert-event"));
 assert.ok(owner.includes("teko-owner-alert-event"));
 assert.ok(owner.includes("teko-owner-push-message"));
 assert.ok(owner.includes("window.TEKO_OWNER_PUSH_ACTIVE"));
 assert.ok(html.includes('id="ownerSoundToggle"'));
 assert.ok(html.includes('id="ownerSoundTest"'));
 assert.ok(html.includes('id="ownerSoundStatus"'));
 assert.ok(html.includes('src="owner-sound.js?v=52"'));
 assert.ok(html.includes('src="owner-push.js?v=52"'));
});

test("Only one chime plays per notification id, even after push plus polling",async()=>{
 const nodes=new Map(),listeners={},stored=new Map();
 function node(id){
  if(!nodes.has(id)){
   const events=new Map();
   nodes.set(id,{
    id,textContent:"",disabled:false,attrs:{},
    setAttribute(k,v){this.attrs[k]=v},
    addEventListener(name,fn){events.set(name,fn)},
    click(){return events.get("click")?.()},
    getAttribute(k){return this.attrs[k]}
   });
  }
  return nodes.get(id);
 }
 let beep=0;
 class FakeAudioContext{
  constructor(){this.state="running";this.destination={};this.currentTime=1}
  async resume(){this.state="running";}
  createOscillator(){
   beep++;
   return {type:"",frequency:{setValueAtTime(){}},connect(){},
    start(){},stop(){},disconnect(){},onended:null};
  }
  createGain(){
   return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
    connect(){},disconnect(){}};
  }
 }
 const window={
  AudioContext:FakeAudioContext,
  addEventListener:(name,fn)=>{listeners[name]=fn},
  dispatchEvent:e=>listeners[e.type]?.(e)
 };
 const localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 const document={getElementById:node};
 const CustomEvent=function(type,options){this.type=type;this.detail=options.detail};
 vm.runInNewContext(audio,{document,window,localStorage,CustomEvent});
 window.dispatchEvent(new CustomEvent("teko-owner-signin",{detail:{}}));
 await node("ownerSoundToggle").click();
 assert.equal(node("ownerSoundToggle").attrs["aria-pressed"],"true");
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:1,message:"new order"}}));
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:1,message:"push same order"}}));
 assert.equal(beep,1,"Duplicate push and polling must share one sound");
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:2,message:"status change"}}));
 assert.equal(beep,2,"Status changes use exactly the same tone as new orders");
 await node("ownerSoundToggle").click();
 assert.equal(node("ownerSoundToggle").attrs["aria-pressed"],"false");
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:3,message:"status while muted"}}));
 assert.equal(beep,2,"Mute blocks every type of notification");
});

test("Background push needs authenticated owner subscription and permission",()=>{
 assert.ok(push.includes("Notification.requestPermission()"));
 assert.ok(push.includes("window.TEKO_OWNER_NOTIFICATIONS_API"));
 assert.ok(push.includes('request("ownerPushKey")'));
 assert.ok(push.includes('request("ownerPushSubscribe"'));
 assert.ok(push.includes("navigator.serviceWorker.ready"));
 assert.ok(push.includes("applicationServerKey"));
 assert.ok(push.includes("userVisibleOnly:true"));
 assert.ok(push.includes("teko-owner-sound-change"));
 assert.ok(api.includes('action==="ownerPushSubscribe"'));
 assert.ok(api.includes('action==="ownerPushKey"'));
 assert.ok(api.includes('if(!await authorizedOwner(req,db))'));
 assert.ok(api.includes('ownerVapidKey(db)'));
 assert.ok(!push.includes("vapid_private"));
});

test("Private service-worker delivery uses OS tone only when owner not focused",()=>{
 assert.ok(sw.includes('self.addEventListener("push"'));
 assert.ok(sw.includes('self.registration.showNotification'));
 assert.ok(sw.includes('silent:p.silent===true'));
 assert.ok(sw.includes('page.visibilityState==="visible" && page.focused'));
 assert.ok(sw.includes('page.postMessage({type:"TEKO_OWNER_PUSH"'));
 assert.ok(sw.includes('self.addEventListener("notificationclick"'));
 assert.ok(!sw.includes("caches.open("));
});

test("Web Push dispatcher is server-secret authenticated, bounded and idempotent",()=>{
 assert.ok(sender.includes('x-teko-push-secret'));
 assert.ok(sender.includes('sendPushNotification('));
 assert.ok(sender.includes('teko_owner_push_config'));
 assert.ok(sender.includes('teko_owner_push_subscriptions'));
 assert.ok(sender.includes('teko_owner_push_deliveries'));
 assert.ok(sender.includes('attempts>=35'));
 assert.ok(sender.includes('previous?.delivered_at'));
 assert.ok(sender.includes("silent:sub.sound_enabled===false"));
 assert.ok(sender.includes('status===404||status===410'));
 assert.ok(!html.includes("dispatch_secret"));
 assert.ok(!push.includes("dispatch_secret"));
});
