/* TEKO STORE V16 — private local autosave of the hoodie editor.
   No customer name, phone, address, or notes are stored here.
   Uploaded artwork stays in the browser's IndexedDB and is never uploaded. */
(()=>{
 'use strict';
 const DB_NAME='teko-design-drafts',KEY='current',VALID_MS=30*86400000;
 const $=id=>document.getElementById(id);
 let ready=false,changedDuringLoad=false,blocked=false,version=0,lastSaved=0,saving=false,timer=null,dbPromise=null;
 const status=(msg)=>{const el=$('draftStatus');if(el)el.textContent=msg};
 function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   if(!window.indexedDB){reject(Error('IndexedDB unsupported'));return}
   const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts')};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||Error('Open failed'));
   request.onblocked=()=>reject(Error('Database blocked'));
  }).catch(e=>{dbPromise=null;throw e});
  return dbPromise;
 }
 function read(db){
  return new Promise((resolve,reject)=>{
   const request=db.transaction('drafts','readonly').objectStore('drafts').get(KEY);
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>reject(request.error||Error('Read failed'));
  });
 }
 function draftData(){
  return {schema:1,at:Date.now(),view,color:color[0],size,
   quantity:Math.max(1,Math.min(100,parseInt($('quantity').value)||1)),
   designs:designs.map(d=>({...d}))};
 }
 function markChanged(){
  if(!ready){changedDuringLoad=true;return}
  if(blocked)return;
  version++;
  status('جاري حفظ التصميم تلقائيًا...');
  clearTimeout(timer);timer=setTimeout(save,420);
 }
 async function save(){
  if(!ready||blocked||saving||version===lastSaved)return;
  saving=true;
  const target=version,payload=draftData();
  try{
   const db=await openDB();
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite');
    tx.objectStore('drafts').put(payload,KEY);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||Error('Write failed'));
    tx.onabort=()=>reject(tx.error||Error('Write aborted'));
   });
   lastSaved=target;
   if(version===lastSaved)status('✓ تم حفظ التصميم على هذا الجهاز');
  }catch(e){
   blocked=true;status('تعذر الحفظ التلقائي — مساحة المتصفح غير كافية أو مقفولة');
   console.warn('TEKO autosave:',e);
  }finally{
   saving=false;
   if(!blocked&&version>lastSaved){clearTimeout(timer);timer=setTimeout(save,120)}
  }
 }
 function validItem(d){
  if(!d||!['front','back','left','right'].includes(d.view)||!['image','text'].includes(d.kind))return false;
  if(![d.x,d.y,d.w,d.h].every(v=>Number.isFinite(Number(v))))return false;
  if(d.w<2||d.w>40||d.h<2||d.h>60||d.x<-.13||d.x>1.09||d.y<-.13||d.y>1.09)return false;
  if(d.kind==='image'){
   if(typeof d.src!=='string'||d.src.length>16e6)return false;
   return /^data:image\/(png|jpeg|webp|gif);base64,/i.test(d.src)||/^(?:\.\/)?assets\//.test(d.src);
  }
  return typeof d.text==='string'&&d.text.trim().length>0&&d.text.length<=200;
 }
 async function restore(){
  try{
   const record=await read(await openDB());
   if(record&&record.schema===1&&Number(record.at)>0&&Date.now()-record.at<VALID_MS&&!changedDuringLoad){
    if(!Array.isArray(record.designs)||record.designs.length>70||!record.designs.every(validItem))
     throw Error('Draft validation failed');
    designs=record.designs.map(d=>({...d}));
    const chosen=COLORS.find(c=>c[0]===record.color);
    if(chosen)color=chosen;
    if(Object.prototype.hasOwnProperty.call(SIZES,record.size))size=record.size;
    $('quantity').value=String(Math.max(1,Math.min(100,Number(record.quantity)||1)));
    history=[];future=[];selectedId=null;
    renderAll();
    selectView(['front','back','left','right'].includes(record.view)?record.view:'front');
    status('✓ تم استرجاع تصميمك المحفوظ');
    if(designs.length)notify('استرجعنا تصميم الهودي السابق بعد التحديث');
   }else status('الحفظ التلقائي جاهز — المسودة على جهازك فقط');
  }catch(error){
   blocked=true;status('الحفظ التلقائي غير متاح حاليًا');
   console.warn('TEKO draft restore:',error);
  }finally{
   ready=true;
   if(changedDuringLoad&&!blocked){changedDuringLoad=false;markChanged()}
  }
 }
 // Don't overwrite active edits if database startup is slow.
 for(const type of ['pointerdown','input','change']){
  document.addEventListener(type,()=>{if(!ready)changedDuringLoad=true},{capture:true});
 }
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(timer);void save()}});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);void save()});
 window.TEKO_DRAFT={changed:markChanged,flush:save};
 void restore();
})();