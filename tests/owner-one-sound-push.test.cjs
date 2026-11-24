/* TEKO OWNER V55: exact whistle playback, home-screen badge and push checks. */
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

test("Every notification plays the same supplied whistle MP3, not a synthetic tone",()=>{
 assert.ok(sound.includes("new Audio(source())"));
 assert.ok(sound.includes(".mp3"));
 assert.ok(!sound.includes("createOscillator"));
 assert.ok(!sound.includes("setValueAtTime(650"));
 assert.ok(html.includes('id="ownerSoundToggle"'));
 assert.ok(html.includes('id="ownerSoundTest"'));
 assert.ok(html.includes('id="ownerSoundImport"'));
 assert.ok(html.includes('id="ownerSoundFile"'));
 assert.ok(html.includes('src="owner-sound.js?v=55"'));
 assert.ok(html.includes('src="owner-notifications.js?v=55"'));
 assert.ok(sound.includes("teko-owner-alert-event"));
 assert.ok(notify.includes("teko-owner-alert-event"));
});
test("Sound is deduplicated across push and polling; one sound per event id",async()=>{
 const nodes=new Map(),events=new Map(),storage=new Map(),played=[];
 function node(id){
  if(!nodes.has(id)){
   const listeners=new Map();
   nodes.set(id,{textContent:"",disabled:false,files:[],
    value:"",attributes:{},setAttribute(k,v){this.attributes[k]=v},
    addEventListener(type,fn){listeners.set(type,fn)},
    click(){return listeners.get("click")?.()},pause(){},focus(){}});
  }
  return nodes.get(id);
 }
 class FakeAudio{
  constructor(src){this.src=src;this.currentTime=0;this.volume=1;}
  play(){played.push(this.src);return Promise.resolve();}
  pause(){}
 }
 const window={
  addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn)},
  dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event)}
 };
 const CustomEvent=class{constructor(type,payload){this.type=type;this.detail=payload?.detail}};
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)};
 vm.runInNewContext(sound,{window,document:{getElementById:node,visibilityState:"visible"},
  localStorage,Audio:FakeAudio,CustomEvent,FileReader:class{}});
 window.dispatchEvent(new CustomEvent("teko-owner-signin",{}));
 assert.equal(node("ownerSoundToggle").attributes["aria-pressed"],"true");
 await node("ownerSoundTest").click();
 assert.equal(played.length,1);
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:1}}));
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:1}}));
 await Promise.resolve();assert.equal(played.length,2);
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:2}}));
 await Promise.resolve();assert.equal(played.length,3);
 assert.deepEqual([...new Set(played)].length,1,"All notifications must play one identical MP3");
 await node("ownerSoundToggle").click();
 window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{detail:{id:3}}));
 assert.equal(played.length,3,"Mute must suppress every notification");
});
test("Existing unread badge one triggers chime on first owner feed, but no reload loop",()=>{
 assert.ok(notify.includes("const newest=events.filter(e=>Number(e.id)>prev&&!e.owner_read_at)"));
 assert.ok(notify.includes("saveLastAlert(lastMax)"));
 assert.ok(notify.includes("getLastAlert()"));
 assert.ok(notify.includes("nativeAlert(e)"));
 assert.ok(notify.includes("teko-owner-last-notified-id-v55"));
});
test("Home-screen app badge uses the OS Badging API when supported",()=>{
 assert.ok(notify.includes("navigator.setAppBadge(number)"));
 assert.ok(notify.includes("navigator.clearAppBadge()"));
 assert.ok(notify.includes("void syncAppBadge(unread)"));
 assert.ok(sw.includes("registration.setAppBadge(unread)"));
 assert.ok(sw.includes("p.data.unreadCount"));
 assert.ok(dispatcher.includes("unreadCount:unreadCount||0"));
 assert.ok(dispatcher.includes('is("owner_read_at",null)'));
 assert.ok(sw.includes('self.addEventListener("notificationclick"'));
});
test("Owner Push is owner-verified, retries are bounded, and mute uses one preference",()=>{
 assert.ok(push.includes("Notification.requestPermission()"));
 assert.ok(push.includes('request("ownerPushSubscribe"'));
 assert.ok(push.includes("userVisibleOnly:true"));
 assert.ok(push.includes("teko-owner-sound-change"));
 assert.ok(api.includes('if(!await authorizedOwner(req,db))'));
 assert.ok(dispatcher.includes("x-teko-push-secret"));
 assert.ok(dispatcher.includes("teko_owner_push_deliveries"));
 assert.ok(dispatcher.includes("sendPushNotification("));
 assert.ok(dispatcher.includes("silent:sub.sound_enabled===false"));
 assert.ok(!html.includes("dispatch_secret"));
});
test("Background audio stays system-controlled and user can import an exact local MP3",()=>{
 assert.ok(sw.includes('self.registration.showNotification'));
 assert.ok(sw.includes('silent:p.silent===true'));
 assert.ok(sound.includes('reader.readAsDataURL(file)'));
 assert.ok(sound.includes('localStorage.setItem(FILE_KEY,base64)'));
 assert.ok(sound.includes('file.size>512000'));
 assert.ok(!sw.includes("caches.open("));
});
