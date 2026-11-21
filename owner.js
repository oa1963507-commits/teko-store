/* TEKO STORE owner console — all order data is protected by server-side
   JWT verification + TEKO_OWNER_UID. No tokens saved to disk or localStorage. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const config=window.TEKO_OWNER_CONFIG||{};
const project=String(config.projectUrl||"").replace(/\/+$/,"");
const publicKey=String(config.publicKey||"");
const fn=String(config.functionName||"teko-admin-orders");
const configured=project.startsWith("https://")&&(publicKey.startsWith("sb_publishable_")||publicKey.length>75);
const statusLabels={new:"جديد",reviewing:"قيد المراجعة",in_production:"قيد التنفيذ",ready:"جاهز",delivered:"تم التسليم",cancelled:"ملغي"};
const state={token:null,expiresAt:0,page:0,total:0,items:[],busy:false};
function tell(text){$("message").textContent=text;}
function showLogin(message=""){
 state.token=null;state.expiresAt=0;state.items=[];
 $("loginPanel").hidden=false;$("appPanel").hidden=true;$("loginPassword").value="";
 $("loginStatus").textContent=message;
}
function showApp(){$("loginPanel").hidden=true;$("appPanel").hidden=false;}
if(!configured){
 $("configNotice").hidden=false;
 $("loginButton").disabled=true;
 $("loginStatus").textContent="التجهيز الفني لم يُفعّل بعد. لا تُدخل بيانات حسابك قبل اكتمال ربط Supabase.";
}
async function signin(email,password){
 const response=await fetch(project+"/auth/v1/token?grant_type=password",{
  method:"POST",
  headers:{"Content-Type":"application/json","apikey":publicKey},
  body:JSON.stringify({email,password}),
  cache:"no-store"
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token)throw Error("تعذر تسجيل الدخول. راجع البريد وكلمة المرور وصلاحية الحساب.");
 return {token:data.access_token,expiresIn:Number(data.expires_in)||3600};
}
async function call(action,fields={}){
 if(!state.token||Date.now()>state.expiresAt)throw Error("انتهت الجلسة. سجّل دخولك مرة أخرى.");
 const response=await fetch(project+"/functions/v1/"+fn,{
  method:"POST",
  headers:{"Content-Type":"application/json","apikey":publicKey,"Authorization":"Bearer "+state.token},
  body:JSON.stringify({action,...fields}),cache:"no-store"
 });
 const data=await response.json().catch(()=>({}));
 if(response.status===401){showLogin("انتهت الجلسة؛ سجّل دخولك مرة أخرى.");throw Error("انتهت الجلسة");}
 if(!response.ok)throw Error(data.error||"تعذر الاتصال بقاعدة الطلبات.");
 return data;
}
function td(text){
 const cell=document.createElement("td");
 cell.textContent=text==null?"":String(text);
 return cell;
}
function btn(text,callback){
 const button=document.createElement("button");
 button.type="button";button.textContent=text;button.className="alt";
 button.addEventListener("click",callback);
 return button;
}
function formatDate(date){
 try{return new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(date))}
 catch{return "—"}
}
function makeStatusSelect(order){
 const select=document.createElement("select");
 select.className="status-select";
 for(const [value,label] of Object.entries(statusLabels)){
  const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);
 }
 select.value=order.status;
 select.addEventListener("change",async()=>{
  const from=order.status,to=select.value;
  if(to===from)return;
  if(!window.confirm("تأكيد تغيير حالة الطلب "+order.order_code+" إلى "+statusLabels[to]+"؟")){
   select.value=from;return;
  }
  select.disabled=true;
  try{
   const data=await call("status",{id:order.id,status:to});
   order.status=data.order.status;
   tell("تم تحديث حالة "+order.order_code+" إلى "+statusLabels[order.status]);
  }catch(error){
   select.value=from;tell(error.message);
  }finally{select.disabled=false;}
 });
 return select;
}
function render(){
 const body=$("ordersBody");body.replaceChildren();
 if(!state.items.length){
  const row=document.createElement("tr"),cell=td("لا توجد طلبات مطابقة.");cell.colSpan=8;
  row.append(cell);body.append(row);
 }
 for(const order of state.items){
  const row=document.createElement("tr");
  row.append(
   td(order.order_code),
   td(formatDate(order.created_at)),
   td(order.customer_name+" — "+order.customer_phone),
   td(order.hoodie_color+" / "+order.hoodie_size),
   td(order.quantity),
   td(Number(order.total_quote_egp||0).toLocaleString("ar-EG")+" ج.م")
  );
  const status=td("");status.append(makeStatusSelect(order));row.append(status);
  const action=td("");action.className="actions";
  action.append(btn("التفاصيل",()=>openDetail(order.id)),btn("تحميل ZIP",()=>downloadZip(order.id)));
  row.append(action);body.append(row);
 }
 $("orderCount").textContent=state.total+" طلب";
 const maxPage=Math.max(1,Math.ceil(state.total/25));
 $("pagination").textContent="صفحة "+(state.page+1)+" من "+maxPage;
 $("prevPage").disabled=state.page===0;$("nextPage").disabled=(state.page+1)>=maxPage;
}
async function list(){
 tell("جاري تحميل الطلبات...");
 try{
  const data=await call("list",{page:state.page,status:$("filterStatus").value,search:$("searchOrders").value});
  state.items=data.orders||[];
  state.total=data.total||0;
  render();tell("");
 }catch(error){tell("خطأ: "+error.message);}
}
async function downloadZip(id){
 const tab=window.open("about:blank","_blank");
 try{
  const data=await call("download",{id});
  const link=new URL(data.downloadUrl);
  if(link.origin!==new URL(project).origin||
     !link.pathname.startsWith("/storage/v1/object/sign/teko-orders/orders/"))
    throw Error("خدمة التخزين أرجعت رابطًا غير صالح.");
  if(tab&&!tab.closed){tab.opener=null;tab.location.replace(link.toString());}
  else window.location.assign(link.toString());
  tell("تم إنشاء رابط تنزيل آمن مدته 15 دقيقة.");
 }catch(error){if(tab&&!tab.closed)tab.close();tell("خطأ: "+error.message);}
}
function addFact(root,label,value){
 const block=document.createElement("p");
 const strong=document.createElement("strong");strong.textContent=label+": ";
 const text=document.createElement("span");text.textContent=value==null?"—":String(value);
 block.append(strong,text);root.append(block);
}
async function openDetail(id){
 const pane=$("detailPanel"),grid=$("detailContent"),designs=$("designDetails");
 pane.hidden=false;grid.replaceChildren();designs.replaceChildren();
 addFact(grid,"الحالة","جاري تحميل التفاصيل...");
 pane.scrollIntoView({behavior:"smooth",block:"start"});
 try{
  const data=await call("detail",{id}),o=data.order,details=o.order_payload||{};
  grid.replaceChildren();
  const facts=[
   ["رقم الطلب",o.order_code],["التاريخ",formatDate(o.created_at)],
   ["الاسم",o.customer_name],["الهاتف",o.customer_phone],
   ["العنوان",o.customer_address],["ملاحظات",o.customer_notes],
   ["اللون",o.hoodie_color],["المقاس",o.hoodie_size],
   ["الكمية",o.quantity],["السعر المبدئي",o.total_quote_egp+" ج.م"],
   ["الحالة",statusLabels[o.status]||o.status]
  ];
  for(const [k,v] of facts)addFact(grid,k,v);
  const arr=Array.isArray(details.designs)?details.designs:[];
  if(!arr.length){designs.textContent="لا توجد بيانات عناصر طباعة محفوظة.";return;}
  for(const d of arr){
   const block=document.createElement("p");
   block.textContent=(d.viewArabic||d.view||"")+
    " — "+(d.name||d.text||"تصميم")+
    " — "+(d.widthCm??"—")+" × "+(d.heightCm??"—")+" سم"+
    " — الموضع "+(d.relativePosition?.x??"—")+" / "+(d.relativePosition?.y??"—");
   designs.append(block);
  }
 }catch(error){grid.replaceChildren();addFact(grid,"خطأ",error.message);}
}
$("loginForm").addEventListener("submit",async event=>{
 event.preventDefault();if(!configured)return;
 const btn=$("loginButton");btn.disabled=true;
 $("loginStatus").textContent="جارٍ التحقق من الحساب...";
 try{
  const email=$("loginEmail").value.trim(),password=$("loginPassword").value;
  const session=await signin(email,password);
  state.token=session.token;state.expiresAt=Date.now()+Math.max(60,session.expiresIn-60)*1000;
  $("loginPassword").value="";
  // Owner access is enforced server-side: login alone does not give admin access.
  await call("list",{page:0,status:"all",search:""});
  showApp();await list();
 }catch(error){showLogin("تعذر فتح لوحة المالك: "+error.message);}
 finally{btn.disabled=false;}
});
$("logoutButton").addEventListener("click",()=>showLogin("تم تسجيل الخروج من لوحة المالك."));
$("filterForm").addEventListener("submit",event=>{event.preventDefault();state.page=0;list();});
$("prevPage").addEventListener("click",()=>{if(state.page>0){state.page--;list();}});
$("nextPage").addEventListener("click",()=>{if((state.page+1)*25<state.total){state.page++;list();}});
$("closeDetail").addEventListener("click",()=>{$("detailPanel").hidden=true;});
})();
