/* TEKO OWNER V56 — single owner-selected MP3 for all foreground alerts.
 * The original reference MP3 isn't hosted in this repository. Import once per
 * device; the audio Blob is kept in IndexedDB, never in localStorage.
 * Background push notifications still use the mobile OS notification sound.
 */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const toggle=$("ownerSoundToggle"),test=$("ownerSoundTest"),status=$("ownerSoundStatus"),upload=$("ownerSoundUpload"),fileInput=$("ownerSoundFile");
 if(!toggle||!test||!upload||!fileInput)return;
 const KEY="teko_owner_sound_v1",DB="teko-owner-sound-db",STORE="audio",FILE_KEY="owner-alert",SOUND_URL="./assets/notifications/teko-owner-alert.mp3";
 let enabled=true,loggedIn=false,ready=false,player=null,blobUrl=null,sourceReady=false,sourcePromise=null,priming=false;
 const ids=new Set(),queue=[];
 try{enabled=localStorage.getItem(KEY)!=="0"}catch{}
 function note(message){if(status)status.textContent=message;}
 function dbOpen(){
  return new Promise((resolve,reject)=>{
   if(!("indexedDB" in window))return reject(Error("IndexedDB unavailable"));
   const req=indexedDB.open(DB,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||Error("Cannot open audio store"));
  });
 }
 async function readSaved(){
  const db=await dbOpen();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(FILE_KEY);
   req.onsuccess=()=>resolve(req.result||null);
   req.onerror=()=>reject(req.error);
   tx.oncomplete=()=>db.close();
   tx.onerror=()=>{db.close();reject(tx.error);};
  });
 }
 async function saveFile(blob){
  const db=await dbOpen();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,"readwrite");
   tx.objectStore(STORE).put(blob,FILE_KEY);
   tx.oncomplete=()=>{db.close();resolve();};
   tx.onerror=()=>{db.close();reject(tx.error||Error("Save failed"));};
  });
 }
 function setSource(url,temporary){
  if(player){player.pause();player.removeAttribute("src");player.load();}
  if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}
  if(temporary)blobUrl=url;
  player=new Audio(url);
  player.preload="auto";player.volume=1;
  ready=false;sourceReady=true;
 }
 async function loadSource(){
  if(sourceReady)return true;
  if(sourcePromise)return sourcePromise;
  sourcePromise=(async()=>{
   let saved=null;
   try{saved=await readSaved();}catch{}
   if(saved instanceof Blob && saved.size>0){
    setSource(URL.createObjectURL(saved),true);return true;
   }
   // Never assume that a missing uploaded ringtone exists on hosting.
   try{
    const response=await fetch(SOUND_URL,{method:"HEAD",cache:"no-store"});
    if(response.ok){setSource(SOUND_URL,false);return true;}
   }catch{}
   note("ملف الصافرة مش موجود على الموقع. اضغط «اختيار ملف الصافرة» وحدد MP3 الأصلي مرة واحدة على الجهاز ده.");
   return false;
  })().finally(()=>{sourcePromise=null;});
  return sourcePromise;
 }
 function paint(){
  toggle.setAttribute("aria-pressed",String(enabled));
  toggle.textContent=enabled?"🔊 صوت التنبيه: شغّال":"🔇 صوت التنبيه: مكتوم";
  test.disabled=!enabled;
 }
 function remember(id){
  if(id===undefined||id===null)return true;
  const key=String(id);
  if(ids.has(key))return false;
  ids.add(key);queue.push(key);
  if(queue.length>150)ids.delete(queue.shift());
  return true;
 }
 // Launch playback synchronously from a genuine click if the MP3 is loaded.
 // Awaiting IndexedDB or a HEAD request before .play() can lose mobile
 // user activation and silently fail even though notifications arrive.
 function play(testRun=false){
  if(!loggedIn||!enabled||(!testRun&&document.visibilityState!=="visible"))return Promise.resolve(false);
  if(!sourceReady){
   return loadSource().then(ok=>ok?play(testRun):false);
  }
  try{
   const p=player;
   p.pause();p.currentTime=0;p.muted=false;
   const attempt=p.play();
   return Promise.resolve(attempt).then(()=>{
    ready=true;
    if(testRun)note("✓ تم تشغيل الصافرة على الجهاز. نفس الصوت عند كل إشعار جديد واللوحة مفتوحة.");
    return true;
   }).catch(err=>{
    ready=false;
    const reason=err?.name==="NotAllowedError"?"المتصفح منع التشغيل التلقائي":
     err?.name==="NotSupportedError"?"الملف الصوتي غير مدعوم":"تعذر تشغيل ملف الصافرة";
    note(reason+". اضغط «تجربة الصوت» على نفس الجهاز، وتأكد إن صوت التطبيق مش مكتوم.");
    return false;
   });
  }catch(err){
   ready=false;note("تعذر تشغيل الصافرة على الجهاز؛ أعد اختيار ملف MP3 ثم اضغط تجربة الصوت.");
   return Promise.resolve(false);
  }
 }
 upload.addEventListener("click",()=>fileInput.click());
 fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];
  if(!file)return;
  if(!(/\.mp3$/i.test(file.name)||file.type==="audio/mpeg")||file.size>8*1024*1024||!file.size){
   note("اختار ملف MP3 صالح بحجم أقل من 8 ميجابايت.");fileInput.value="";return;
  }
  // Preview on the real file-selection gesture before asynchronous storage.
  setSource(URL.createObjectURL(file),true);
  void play(true);
  try{
   await saveFile(file);
  }catch{
   note("الصوت متاح للتجربة الآن، لكن تعذر حفظه؛ ستحتاج لاختياره بعد فتح التطبيق من جديد.");
  }
  fileInput.value="";
 });
 test.addEventListener("click",()=>{
  if(!loggedIn){note("سجّل الدخول بحساب المالك أولًا.");return;}
  if(!enabled){note("فعّل زر صوت التنبيه أولًا.");return;}
  // No bundled MP3 exists; directly ask for the owner's actual whistle file.
  // fileInput.click must run synchronously inside the genuine user click.
  if(!sourceReady){
   note("اختار ملف «رسالة-صافرة» MP3 الأصلي للتجربة والحفظ على الجهاز ده.");
   fileInput.click();
   return;
  }
  void play(true);
 });
 toggle.addEventListener("click",()=>{
  enabled=!enabled;
  try{localStorage.setItem(KEY,enabled?"1":"0")}catch{}
  if(!enabled&&player){player.pause();player.currentTime=0;}
  paint();
  window.dispatchEvent(new CustomEvent("teko-owner-sound-change",{detail:{enabled}}));
  if(enabled)void play(true);
  else note("تم كتم صوت جميع إشعارات TEKO OWNER على الجهاز ده.");
 });
 window.addEventListener("teko-owner-alert-event",e=>{
  if(!loggedIn||!enabled||!remember(e.detail?.id))return;
  void play(false);
 });
 window.addEventListener("teko-owner-signin",()=>{
  loggedIn=true;paint();
  if(enabled)void loadSource().then(ok=>{
   if(ok)note("الصافرة جاهزة. اضغط «تجربة الصوت» مرة لتسمح للمتصفح بتشغيلها.");
  });
  else note("الصوت مكتوم. اضغط «صوت التنبيه» لتشغيله.");
 });
 window.addEventListener("teko-owner-signout",()=>{
  loggedIn=false;ids.clear();queue.length=0;
  if(player){player.pause();player.currentTime=0;}
 });
 paint();
})();