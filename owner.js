/* TEKO STORE owner console — all order data is protected by server-side
   JWT verification + TEKO_OWNER_UID. No tokens saved to disk or localStorage. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const config=window.TEKO_OWNER_CONFIG||{};
const project=String(config.projectUrl||"").replace(/\/+$/,"");
const publicKey=String(config.publicKey||"");
const fn=String(config.functionName||"teko-admin-orders");
const reportsEnabled=config.reportsEnabled===true;
const money=(amount)=>Number(amount||0).toLocaleString("ar-EG",{maximumFractionDigits:2})+" ج.م";
const configured=project.startsWith("https://")&&(publicKey.startsWith("sb_publishable_")||publicKey.length>75);
const statusLabels={new:"جديد",reviewing:"قيد المراجعة",in_production:"قيد التنفيذ",ready:"جاهز",delivered:"تم التسليم",cancelled:"ملغي"};
const state={token:null,expiresAt:0,page:0,total:0,items:[],busy:false,customerPage:0,customerTotal:0,customers:[],section:"orders"};
function tell(text){$("message").textContent=text;}
function showLogin(message=""){
 state.token=null;state.expiresAt=0;state.items=[];
 $("loginPanel").hidden=false;$("appPanel").hidden=true;$("loginPassword").value="";
 $("loginStatus").textContent=message;
}
function showApp(){
 $("loginPanel").hidden=true;$("appPanel").hidden=false;
 if(reportsEnabled){
  $("insightsPanel").hidden=false;
  $("ownerTabs").hidden=false;
  $("exportOrdersBtn").hidden=false;
  refreshDashboard();
 }
}
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
   if(reportsEnabled)refreshDashboard();
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
// V28 reporting UI: all data comes from the authenticated owner-only API.
function renderDashboard(d){
 const statuses=d.statusCounts||{};
 const text=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
 text("statTotalOrders",Number(d.totalOrders||0).toLocaleString("ar-EG"));
 text("statPendingOrders",Number((statuses.new||0)+(statuses.reviewing||0)).toLocaleString("ar-EG"));
 text("statQuoteTotal",money(d.quotedTotalEGP));
 text("statCustomers",Number(d.uniqueCustomers||0).toLocaleString("ar-EG"));
 text("reportSecondary","قطع الهودي: "+Number(d.totalPieces||0).toLocaleString("ar-EG")+
   " · متوسط قيمة الطلب المبدئية: "+money(d.averageQuoteEGP)+
   " · عروض الطلبات المسلّمة: "+money(d.deliveredQuotedEGP));
 const flow=$("statusBars");flow.replaceChildren();
 const statusMax=Math.max(1,...Object.values(statuses).map(Number));
 for(const [key,label] of Object.entries(statusLabels)){
  const count=Number(statuses[key]||0);
  const line=document.createElement("div");line.className="flow-row";
  const name=document.createElement("span");name.textContent=label;
  const track=document.createElement("div");track.className="flow-track";
  const fill=document.createElement("div");fill.className="flow-fill";
  fill.style.width=(count/statusMax*100)+"%";
  track.append(fill);
  const total=document.createElement("b");total.textContent=String(count);
  line.append(name,track,total);flow.append(line);
 }
 const trend=$("trendBars");trend.replaceChildren();
 const days=Array.isArray(d.dailyOrders)?d.dailyOrders:[];
 const max=Math.max(1,...days.map(x=>Number(x.count)||0));
 for(const entry of days){
  const bar=document.createElement("div");bar.className="trend-col";
  const count=document.createElement("strong");count.textContent=String(entry.count||0);
  const column=document.createElement("div");column.className="trend-column";
  const fill=document.createElement("div");fill.className="trend-fill";
  fill.style.height=Math.max(entry.count?6:2,(Number(entry.count)||0)/max*100)+"%";
  column.append(fill);
  const label=document.createElement("span");label.textContent=String(entry.date||"").slice(5);
  bar.append(count,column,label);trend.append(bar);
 }
 const note=d.partial
  ?"تنبيه: الأرقام تحليل للطلبات الـ"+Number(d.coveredOrders||0).toLocaleString("ar-EG")+" الأحدث فقط، وليست إجمالي جميع الطلبات."
  :"تقرير تقديري — جميع الطلبات في الفترة المحددة. يتم تجميع العملاء حسب رقم الهاتف.";
 $("reportStatus").textContent=note;
}
async function refreshDashboard(){
 if(!reportsEnabled||!state.token)return;
 $("reportStatus").textContent="جاري تحميل إحصائيات الطلبات...";
 try{
  const response=await call("dashboard",{days:Number($("reportPeriod").value)});
  renderDashboard(response.dashboard||{});
 }catch(error){
  $("reportStatus").textContent="تعذر تحميل الإحصائيات: "+error.message+
   " (تأكد من نشر تحديث Edge Function).";
 }
}
function showSection(section){
 if(!reportsEnabled)return;
 state.section=section;
 $("ordersPanel").hidden=section!=="orders";
 $("customersPanel").hidden=section!=="customers";
 $("detailPanel").hidden=true;
 $("tabOrders").setAttribute("aria-selected",String(section==="orders"));
 $("tabCustomers").setAttribute("aria-selected",String(section==="customers"));
 if(section==="customers")loadCustomers();
}
function renderCustomers(){
 const body=$("customersBody");body.replaceChildren();
 if(!state.customers.length){
  const row=document.createElement("tr"),cell=td("لا توجد بيانات عملاء مطابقة.");
  cell.colSpan=7;row.append(cell);body.append(row);
 }
 for(const customer of state.customers){
  const row=document.createElement("tr");
  row.append(
   td(customer.name),td(customer.phone),td(customer.orders),
   td(customer.activeOrders),td(money(customer.quoteEGP)),
   td(formatDate(customer.latestOrderAt))
  );
  const actions=td("");actions.className="actions";
  actions.append(btn("عرض طلباته",()=>{
    $("searchOrders").value=customer.phone;
    $("filterStatus").value="all";state.page=0;
    showSection("orders");list();
  }));
  const phone=String(customer.phone||"");
  if(/^01\d{9}$/.test(phone)){
   const link=document.createElement("a");
   link.className="contact-link";link.textContent="واتساب";
   link.href="https://wa.me/20"+phone.slice(1);
   link.target="_blank";link.rel="noopener noreferrer";
   actions.append(link);
  }
  row.append(actions);body.append(row);
 }
 $("customerCount").textContent=state.customerTotal.toLocaleString("ar-EG")+" عميل";
 const totalPages=Math.max(1,Math.ceil(state.customerTotal/25));
 $("customerPagination").textContent="صفحة "+(state.customerPage+1)+" من "+totalPages;
 $("prevCustomerPage").disabled=state.customerPage===0;
 $("nextCustomerPage").disabled=(state.customerPage+1)>=totalPages;
}
async function loadCustomers(){
 if(!reportsEnabled||!state.token)return;
 $("customerStatus").textContent="جاري تحميل العملاء...";
 try{
  const data=await call("customers",{page:state.customerPage,search:$("searchCustomers").value});
  state.customers=data.customers||[];
  state.customerTotal=Number(data.total)||0;
  renderCustomers();
  $("customerStatus").textContent=data.partial
   ?"تنبيه: عرض ملخص للطلبات الـ"+data.coveredOrders+" الأحدث فقط."
   :"البيانات خاصة بالمالك، وتُجمع حسب رقم الهاتف.";
 }catch(error){
  $("customerStatus").textContent="تعذر تحميل العملاء: "+error.message+
    " (تأكد من نشر تحديث Edge Function).";
 }
}
function safeCSVCell(value){
 const input=String(value==null?"":value);
 // Avoid CSV formula injection when a file is opened in Excel.
 const escaped=/^[\s]*[=+\-@]/.test(input)?"'"+input:input;
 return '"'+escaped.replace(/"/g,'""')+'"';
}
function exportCurrentOrders(){
 if(!state.items.length){tell("لا توجد طلبات في الصفحة الحالية للتصدير.");return;}
 const header=["رقم الطلب","تاريخ الطلب","اسم العميل","الهاتف","اللون","المقاس",
  "الكمية","الإجمالي المبدئي بالجنيه","الحالة"];
 const rows=state.items.map(o=>[o.order_code,o.created_at,o.customer_name,o.customer_phone,
  o.hoodie_color,o.hoodie_size,o.quantity,o.total_quote_egp,statusLabels[o.status]||o.status]);
 const csv="\uFEFF"+[header,...rows].map(row=>row.map(safeCSVCell).join(",")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;
 link.download="TEKO-ORDERS-page-"+(state.page+1)+".csv";
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 tell("تم تصدير الصفحة الحالية فقط ("+state.items.length+" طلب) إلى CSV.");
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
$("reportPeriod").addEventListener("change",refreshDashboard);
$("refreshReports").addEventListener("click",refreshDashboard);
$("tabOrders").addEventListener("click",()=>showSection("orders"));
$("tabCustomers").addEventListener("click",()=>showSection("customers"));
$("customerFilterForm").addEventListener("submit",event=>{event.preventDefault();state.customerPage=0;loadCustomers();});
$("prevCustomerPage").addEventListener("click",()=>{if(state.customerPage>0){state.customerPage--;loadCustomers();}});
$("nextCustomerPage").addEventListener("click",()=>{if((state.customerPage+1)*25<state.customerTotal){state.customerPage++;loadCustomers();}});
$("exportOrdersBtn").addEventListener("click",exportCurrentOrders);
})();
