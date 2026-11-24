/* TEKO STORE V50 — customer order tracking and in-site notifications.
 * Tokens never go into public URLs, query strings, or shared chat messages.
 * Browser notifications work only while a page of the store is open.
 */
(()=>{
 "use strict";
 const STORE_KEY="teko-customer-tracking-v1";
 const API="https://kopsyfhpcilafuesgjti.supabase.co/functions/v1/teko-order-notifications";
 const statusLabels={new:"طلب جديد",reviewing:"قيد المراجعة",in_production:"قيد التنفيذ",ready:"جاهز للاستلام",delivered:"تم التسليم",cancelled:"ملغي"};
 const $=id=>document.getElementById(id);
 const trackingPage=!!$("trackingOrders");
 const esc=t=>String(t??"");
 let loading=false,records=read(),enableNative=false;
 function read(){
  try{
   const list=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");
   return Array.isArray(list)?list.filter(x=>x&&/^TK-[0-9]{5,20}$/.test(x.code)&&/^[a-f0-9]{64}$/.test(x.token)).slice(0,20):[];
  }catch{return [];}
 }
 function save(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(records.slice(0,20)));return true;}
  catch{return false;}
 }
 function hexToken(){
  if(!crypto?.getRandomValues)throw Error("Secure tracking requires browser cryptography");
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 }
 async function request(body){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await fetch(API,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),cache:"no-store",credentials:"omit",signal:controller.signal
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(String(data.error||"تعذر متابعة الطلب"));
   return data;
  }finally{clearTimeout(timeout);}
 }
 async function bind(info){
  const token=hexToken();
  const data=await request({
   action:"bind",path:info.path,size:info.size,expires:info.expires,
   proof:info.proof,code:info.code,trackingToken:token
  });
  if(data.tracking!==true)throw Error("Tracking was not activated");
  records=read();
  const prev=records.find(x=>x.code===info.code);
  if(prev){
   // Repeated finish with a different token is rejected by the server.
   // In that case the previously saved credential remains untouched.
   prev.token=token;prev.lastSeen=Number(prev.lastSeen)||0;
  }else records.unshift({code:info.code,token,created:Date.now(),lastSeen:0,
    currentStatus:"new",lastEventId:0,unread:0});
  save();updateBadge();
  return true;
 }
 function updateBadge(){
  const total=records.reduce((sum,r)=>sum+(Number(r.unread)||0),0);
  const link=$("customerOrdersNav");
  if(link)link.textContent="🔔 طلباتي"+(total?" ("+total+")":"");
  const count=$("trackingTotal");if(count)count.textContent=records.length.toLocaleString("ar-EG");
  const pending=$("trackingUnread");if(pending)pending.textContent=total.toLocaleString("ar-EG");
 }
 function pop(message){
  if(!enableNative||!("Notification" in window)||Notification.permission!=="granted")return;
  try{new Notification("TEKO STORE — تحديث طلبك",{body:message,tag:"teko-customer-status"});}catch{}
 }
 async function poll(){
  if(loading||records.length===0){render();return;}
  loading=true;records=read();
  try{
   for(const r of records.slice(0,12)){
    try{
     const result=await request({action:"customerFeed",trackingToken:r.token});
     const eventId=Math.max(0,...(result.events||[]).map(e=>Number(e.id)||0));
     const status=String(result.order?.status||"");
     if(!Object.hasOwn(statusLabels,status))continue;
     if(r.lastEventId>0&&eventId>r.lastEventId){
      const next=(result.events||[]).filter(e=>Number(e.id)>r.lastEventId).length;
      r.unread=(Number(r.unread)||0)+next;
      pop(r.code+" — "+statusLabels[status]);
     }
     r.lastEventId=Math.max(eventId,Number(r.lastEventId)||0);
     r.currentStatus=status;r.events=(result.events||[]).slice(0,30)
       .map(e=>({id:e.id,status:e.status,created_at:e.created_at,event_type:e.event_type}));
     r.updated_at=result.order?.updated_at||"";
     r.failed=false;
    }catch{r.failed=true;}
   }
   save();
  }finally{loading=false;updateBadge();render();}
 }
 function el(tag,text,className){
  const node=document.createElement(tag);if(text!==undefined)node.textContent=esc(text);
  if(className)node.className=className;return node;
 }
 function displayDate(value){
  try{return new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
  catch{return "—";}
 }
 function render(){
  if(!trackingPage)return;
  const root=$("trackingOrders");root.replaceChildren();
  if(!records.length){
   const empty=el("div",undefined,"tracking-empty");
   empty.append(el("h2","ما عندكش طلبات محفوظة على الجهاز ده"),
    el("p","بعد تسجيل الأوردر بنجاح، هتلاقيه هنا وتتابع حالته وإشعاراته. لو غيرت الجهاز أو مسحت بيانات المتصفح، سجل المتابعة المحلي مش هينتقل تلقائيًا."));
   root.append(empty);return;
  }
  for(const r of records){
   const card=el("article",undefined,"tracking-card");
   const header=el("div",undefined,"tracking-card-head");
   const title=el("h2",r.code);
   const status=el("span",statusLabels[r.currentStatus]||"جاري المراجعة","tracking-status");
   header.append(title,status);card.append(header);
   if(r.failed)card.append(el("p","تعذر تحديث الحالة حاليًا؛ هنعيد المحاولة تلقائيًا.","tracking-note"));
   else card.append(el("p",r.updated_at?"آخر تحديث: "+displayDate(r.updated_at):"حالة الطلب محفوظة بشكل آمن.","tracking-note"));
   const list=el("ol",undefined,"tracking-timeline");
   for(const event of (r.events||[])){
    const item=el("li");
    item.append(el("strong",statusLabels[event.status]||"تحديث الطلب"),
      el("time",displayDate(event.created_at)));
    list.append(item);
   }
   if(!list.children.length)list.append(el("li","تفاصيل التتبع هتظهر بعد تحديث الطلب."));
   card.append(list);
   const actions=el("div",undefined,"tracking-actions");
   const readBtn=el("button","تم الاطلاع على الإشعارات","tracking-alt");
   readBtn.type="button";
   readBtn.disabled=!(r.unread>0);
   readBtn.addEventListener("click",()=>{
    r.unread=0;save();updateBadge();render();
   });
   actions.append(readBtn);card.append(actions);root.append(card);
  }
 }
 const enableBtn=$("enableCustomerAlerts");
 if(enableBtn)enableBtn.addEventListener("click",async()=>{
  const result=$("trackingNotice");
  if(!("Notification" in window)||!window.isSecureContext){
   result.textContent="المتصفح ده لا يدعم التنبيهات المباشرة. حالة الطلب هتفضل ظاهرة هنا.";return;
  }
  try{
   const permission=await Notification.requestPermission();
   enableNative=permission==="granted";
   result.textContent=enableNative?
    "تم تفعيل إشعارات المتصفح أثناء فتح صفحات TEKO على هذا الجهاز.":
    "إذن التنبيهات غير مفعل. متابعة الحالات داخل الصفحة هتفضل شغالة.";
   if(enableNative){try{localStorage.setItem("teko-customer-alert-permission","1");}catch{}}
  }catch{result.textContent="لم يتمكن المتصفح من تفعيل التنبيهات.";}
 });
 if($("trackingRefresh"))$("trackingRefresh").addEventListener("click",()=>void poll());
 enableNative=localStorage.getItem("teko-customer-alert-permission")==="1";
 window.TEKO_CUSTOMER_NOTIFICATIONS={bind,poll};
 updateBadge();
 if(records.length)void poll();else render();
 setInterval(()=>{if(records.length||read().length)void poll();},45000);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&read().length)void poll();});
})();
