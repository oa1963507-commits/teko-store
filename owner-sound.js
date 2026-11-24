/* TEKO OWNER V52 — ONE ORIGINAL CHIME for every owner alert.
 * Synthesizes the same 650 Hz chime; does not load/ship any music.
 * Audio plays only after the owner's explicit click unlocks AudioContext.
 * Background notifications use the OS-provided sound, not custom playback.
 */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const toggle=$("ownerSoundToggle"),tryButton=$("ownerSoundTest");
 if(!toggle||!tryButton)return;
 const KEY="teko_owner_sound_v1";
 let enabled=false,authorized=false,context=null;
 const handled=new Set();
 const backlog=[];
 function remember(id){
  const key=String(id??"");
  if(!key)return true;
  if(handled.has(key))return false;
  handled.add(key);backlog.push(key);
  if(backlog.length>120)handled.delete(backlog.shift());
  return true;
 }
 const paint=()=>{
  toggle.setAttribute("aria-pressed",String(enabled));
  toggle.textContent=enabled?"🔊 صوت التنبيه: شغّال":"🔇 صوت التنبيه: مكتوم";
  tryButton.disabled=!enabled;
 };
 async function unlock(){
  const Constructor=window.AudioContext||window.webkitAudioContext;
  if(!Constructor)throw Error("المتصفح لا يدعم تشغيل صوت التنبيه");
  if(!context||context.state==="closed")context=new Constructor();
  if(context.state!=="running")await context.resume();
  return context;
 }
 function chime(){
  if(!enabled||!authorized||!context||context.state!=="running"||
    (document.visibilityState&&document.visibilityState!=="visible"))return false;
  try{
   const now=context.currentTime;
   const osc=context.createOscillator(),gain=context.createGain();
   osc.type="sine";osc.frequency.setValueAtTime(650,now);
   gain.gain.setValueAtTime(0.0001,now);
   gain.gain.exponentialRampToValueAtTime(0.24,now+0.025);
   gain.gain.exponentialRampToValueAtTime(0.0001,now+0.40);
   osc.connect(gain);gain.connect(context.destination);
   osc.start(now);osc.stop(now+0.42);
   osc.onended=()=>{try{osc.disconnect();gain.disconnect()}catch{}};
   return true;
  }catch{return false;}
 }
 function setStatus(value){
  const el=$("ownerSoundStatus");if(el)el.textContent=value;
 }
 toggle.addEventListener("click",async()=>{
  if(enabled){
   enabled=false;try{localStorage.setItem(KEY,"0")}catch{}
   window.dispatchEvent(new CustomEvent("teko-owner-sound-change",{detail:{enabled:false}}));
   setStatus("تم كتم نفس الرنّة لكل الإشعارات.");paint();return;
  }
  try{
   await unlock();
   enabled=true;try{localStorage.setItem(KEY,"1")}catch{}
   window.dispatchEvent(new CustomEvent("teko-owner-sound-change",{detail:{enabled:true}}));
   setStatus("الصوت شغّال: نفس الرنّة لكل أوردر جديد أو تغيير حالة. اضغط «تجربة الصوت».");
  }catch(e){
   enabled=false;setStatus(e?.message||"الصوت غير متاح على الجهاز");
  }
  paint();
 });
 tryButton.addEventListener("click",async()=>{
  try{await unlock();if(!chime())setStatus("سجّل دخول المالك أولًا لتجربة الصوت.")}
  catch{setStatus("المتصفح منع تشغيل الصوت؛ اضغط زر التشغيل مجددًا.");}
 });
 window.addEventListener("teko-owner-alert-event",event=>{
  if(!authorized)return;
  if(!remember(event.detail?.id))return; // No double chime on push + 20-second polling
  chime();
 });
 window.addEventListener("teko-owner-signin",()=>{
  authorized=true;
  // After reload, browser autoplay restrictions may require one new tap.
  try{enabled=localStorage.getItem(KEY)==="1"}catch{}
  paint();
  if(enabled&&(!context||context.state!=="running"))
   setStatus("الصوت مفعّل. لو مش سامعه، اضغط «تجربة الصوت» مرة لتفعيل الصوت في المتصفح.");
 });
 window.addEventListener("teko-owner-signout",()=>{
  authorized=false;handled.clear();backlog.length=0;
 });
 // Do not unlock playback automatically: permission must result from a real tap.
 paint();
})();
