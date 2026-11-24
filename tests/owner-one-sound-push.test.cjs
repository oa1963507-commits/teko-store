const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const sound=read("owner-sound.js");
const notify=read("owner-notifications.js");
const push=read("owner-push.js");
const sw=read("sw.js");
const html=read("owner.html");
const dispatcher=read("supabase/functions/teko-owner-push-dispatch/index.ts");
const api=read("supabase/functions/teko-order-notifications/index.ts");

test("Owner's original MP3 is the single foreground alert and is not synthesized",()=>{
 assert.match(sound,/new Audio\(url\)/);
 assert.match(sound,/URL\.createObjectURL\(file\)/);
 assert.doesNotMatch(sound,/createOscillator/);
 for(const id of ["ownerSoundToggle","ownerSoundTest","ownerSoundUpload","ownerSoundFile"])
  assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('owner-sound.js?v=57'));
 assert.ok(sound.includes("teko-owner-alert-event"));
 assert.ok(notify.includes("teko-owner-alert-event"));
});

test("Two distinct notifications produce two plays of the same sound, not one for duplicates",async()=>{
 const nodes=new Map(),events=new Map(),stored=new Map(),played=[];
 function node(id){
  if(!nodes.has(id)){
   const listeners=new Map();
   nodes.set(id,{textContent:"",disabled:false,files:[],value:"",attributes:{},
    setAttribute(key,value){this.attributes[key]=value},
    addEventListener(type,fn){listeners.set(type,fn)},
    click(){return listeners.get("click")?.()},
    pause(){},focus(){}});
  }
  return nodes.get(id);
 }
 class FakeAudio{
  constructor(src){this.src=src;this.currentTime=0;this.volume=1;this.muted=false;}
  play(){played.push(this.src);return Promise.resolve();}
  pause(){}removeAttribute(){}load(){}
 }
 const window={
  addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn)},
  dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event)}
 };
 const CustomEvent=class{constructor(type,payload){this.type=type;this.detail=payload?.detail}};
 const localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 const document={getElementById:node,visibilityState:"visible",addEventListener(){}};
 vm.runInNewContext(sound,{window,document,Audio:FakeAudio,localStorage,
  CustomEvent,fetch:async()=>({ok:true}),URL,
 });
 window.dispatchEvent(new CustomEvent("teko-owner-signin"));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(node("ownerSoundToggle").attributes["aria-pressed"],"true");
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:1}}));
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:1}}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(played.length,1);
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:2}}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(played.length,2);
 assert.equal(new Set(played).size,1,"One MP3 must be used for all alerts");
 node("ownerSoundToggle").click();
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:3}}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(played.length,2,"Muting blocks all audio");
});

test("First unread order can chime once and owner badge reflects server unread events",()=>{
 assert.match(notify,/const newest=events\.filter\(e=>Number\(e\.id\)>prev&&!e\.owner_read_at\)/);
 assert.ok(notify.includes("saveLastAlert(lastMax)"));
 assert.ok(notify.includes("nativeAlert(e)"));
 assert.ok(notify.includes("navigator.setAppBadge(number)"));
 assert.ok(notify.includes("navigator.clearAppBadge()"));
 assert.ok(sw.includes("registration.setAppBadge(unread)"));
});
test("Encrypted background Web Push uses the same OS sound for each notification",()=>{
 assert.ok(push.includes("Notification.requestPermission()"));
 assert.ok(push.includes('request("ownerPushSubscribe"'));
 assert.ok(api.includes("authorizedOwner(req,db)"));
 assert.ok(dispatcher.includes("x-teko-push-secret"));
 assert.ok(dispatcher.includes("teko_owner_push_deliveries"));
 assert.ok(dispatcher.includes("sendNativePush("));
 assert.ok(dispatcher.includes("aes128gcm"));
 assert.ok(dispatcher.includes("silent:sub.sound_enabled===false"));
 assert.ok(!dispatcher.includes('npm:@mmmike/web-push'));
 assert.ok(sw.includes('self.registration.showNotification'));
 assert.ok(sw.includes('silent:p.silent===true'));
 assert.ok(!sw.includes("caches.open("));
});
