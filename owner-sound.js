/* TEKO OWNER V55 — the owner's exact uploaded whistle sound.
 * Foreground: plays the supplied MP3 after browser audio has been enabled.
 * Background/closed app: OS notification audio rules apply.
 * No different tones for order vs status-change notifications.
 */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const toggle=$("ownerSoundToggle"),test=$("ownerSoundTest"),status=$("ownerSoundStatus");
 if(!toggle||!test)return;
 const KEY="teko_owner_sound_v1",URL="./assets/notifications/teko-owner-alert.mp3";
 const IDS=new Set(),FIFO=[];
 let enabled=true,loggedIn=false,ready=false,playing=false;
 try{enabled=localStorage.getItem(KEY)!=="0"}catch{}
 let player;
 function audio(){
  if(!player){
   player=new Audio(URL);
   player.preload="auto";
   player.volume=1;
  }
  return player;
 }
 function note(value){if(status)status.textContent=value;}
 let priming=false;
 async function prime(){
  if(!loggedIn||!enabled||ready||priming)return;
  priming=true;
  try{
   const p=audio();
   p.muted=true;
   const result=p.play(); // Invoked while a real user gesture is active.
   if(result&&typeof result.then==="function")await result;
   p.pause();p.currentTime=0;p.muted=false;
   ready=true;
   note("✓ تم تهيئة صوت الصافرة لتشغيله عند وصول الإشعارات.");
  }catch{
   if(player){player.pause();player.muted=false;}
  }finally{priming=false;}
 }
 document.addEventListener?.("pointerdown",()=>void prime(),{capture:true});
 document.addEventListener?.("keydown",event=>{
  if(event.key==="Enter"||event.key===" ")void prime();
 },{capture:true});
 function paint(){
  toggle.setAttribute("aria-pressed",String(enabled));
  toggle.textContent=enabled?"🔊 صوت التنبيه: شغّال":"🔇 صوت التنبيه: مكتوم";
  test.disabled=!enabled;
 }
 function remember(id){
  if(id===null||id===undefined)return true;
  const key=String(id);
  if(IDS.has(key))return false;
  IDS.add(key);FIFO.push(key);
  if(FIFO.length>150)IDS.delete(FIFO.shift());
  return true;
 }
 async function whistle(testRun=false){
  if(!loggedIn||!enabled||(!testRun&&document.visibilityState!=="visible"))return false;
  try{
   const p=audio();
   // A single audio source, restarted on each distinct notification.
   p.pause();p.currentTime=0;
   const playback=p.play();
   if(playback&&typeof playback.then==="function")await playback;
   ready=true;
   if(testRun)note("✓ ده نفس صوت «رسالة-صافرة» المعتمد لكل إشعارات TEKO OWNER.");
   return true;
  }catch(err){
   ready=false;
   note("المتصفح منع تشغيل الصوت تلقائيًا. اضغط «تجربة الصوت» مرة لتفعيله، وتأكد إن صوت الجهاز مش مكتوم.");
   return false;
  }
 }
 toggle.addEventListener("click",async()=>{
  enabled=!enabled;
  try{localStorage.setItem(KEY,enabled?"1":"0")}catch{}
  paint();
  window.dispatchEvent(new CustomEvent("teko-owner-sound-change",{detail:{enabled}}));
  if(enabled){
   note("الصوت موحّد لكل الأوردرات والتحديثات. اضغط «تجربة الصوت» لتفعيله في المتصفح.");
   await whistle(true);
  }else{
   if(player){player.pause();player.currentTime=0}
   note("تم كتم جميع إشعارات TEKO OWNER على الجهاز ده.");
  }
 });
 test.addEventListener("click",()=>void whistle(true));
 window.addEventListener("teko-owner-alert-event",event=>{
  if(!loggedIn||!enabled||!remember(event.detail?.id))return;
  void whistle(false);
 });
 window.addEventListener("teko-owner-signin",()=>{
  loggedIn=true;paint();
  note(enabled?
   "لاستعمال صافرتك اضغط «اختيار ملف الرنّة» وحدد MP3 المرفق مرة واحدة؛ بعدها جرّب الصوت.":
   "الصوت مكتوم. اضغط زر «صوت التنبيه» لتشغيله.");
 });
 window.addEventListener("teko-owner-signout",()=>{
  loggedIn=false;IDS.clear();FIFO.length=0;
  if(player){player.pause();player.currentTime=0}
 });
 paint();
})();
