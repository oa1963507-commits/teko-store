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
 const KEY="teko_owner_sound_v1",DB="teko-owner-sound-db",STORE="audio",FILE_KEY="owner-alert",URL="./assets/notifications/teko-owner-alert.mp3";
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
    const response=await fetch(URL,{method:"HEAD",cache:"no-store"});
    if(response.ok){setSource(URL,false);return true;}
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
 async function play(testRun=false){
  if(!loggedIn||!enabled||(!testRun&&document.visibilityState!=="visible"))return false;
  if(!await loadSource())return false;
  try{
   player.muted=false;player.pause();player.currentTime=0;
   await player.play();
   ready=true;
   if(testRun)note("✓ صوت الصافرة شغّال. نفس الملف هيتشغّل مع كل إشعار جديد أثناء فتح اللوحة.");
   return true;
  }catch(error){
   ready=false;
   note("الصوت اتحمّل لكن المتصفح منع تشغيله. اضغط «تجربة الصوت»، وتأكد إن صوت الجهاز والتبويب مش مكتومين.");
   return false;
  }
 }
 async function prime(){
  if(!loggedIn||!enabled||ready||priming||!sourceReady)return;
  priming=true;
  try{
   player.muted=true;
   await player.play();
   player.pause();player.currentTime=0;player.muted=false;
   ready=true;
  }catch{if(player){player.pause();player.muted=false;}}
  finally{priming=false;}
 }
 document.addEventListener("pointerdown",()=>void prime(),{capture:true});
 document.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")void prime();},{capture:true});
 upload.addEventListener("click",()=>fileInput.click());
 fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];
  if(!file)return;
  if(!(/\.mp3$/i.test(file.name)||file.type==="audio/mpeg")||file.size>8*1024*1024||!file.size){
   note("اختار ملف MP3 صالح بحجم أقل من 8 ميجابايت.");fileInput.value="";return;
  }
  try{
   await saveFile(file);
   setSource(URL.createObjectURL(file),true);
   note("✓ تم حفظ الصافرة على الجهاز ده. اضغط «تجربة الصوت» للتأكد من تشغيلها.");
  }catch{
   note("تعذر حفظ الصافرة على الجهاز. تأكد أن مساحة المتصفح متاحة وجرّب مرة أخرى.");
  }
  fileInput.value="";
 });
 test.addEventListener("click",()=>void play(true));
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