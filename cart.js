/* TEKO STORE V33 | IndexedDB cart: artwork never touches Supabase until checkout. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const DB="teko-store-cart",TABLE="cart",KEY="saved",MAX_LINES=6,MAX_PRINTS=32;
let items=[],editingId=null,buyingCart=false,ready=false,busy=false;
let thumbnails=[];
const money=n=>Number(n||0).toLocaleString("ar-EG",{maximumFractionDigits:0})+" ج.م";
const count=()=>items.reduce((n,item)=>n+item.quantity,0);
const amount=()=>items.reduce((n,item)=>n+item.quantity*item.unitPrice,0);
function database(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(Error("المتصفح لا يدعم الحفظ المحلي"));return}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(TABLE))req.result.createObjectStore(TABLE)};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("تعذر فتح مساحة السلة"));
 });
}
async function read(){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const req=db.transaction(TABLE,"readonly").objectStore(TABLE).get(KEY);
  req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
 });}finally{db.close()}
}
async function write(next){
 const db=await database();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLE,"readwrite");tx.objectStore(TABLE).put(next,KEY);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}finally{db.close()}
}
function validDesign(d){
 return !!d&&["image","text"].includes(d.kind)&&["front","back","left","right"].includes(d.view)&&
  [d.x,d.y,d.w,d.h].every(v=>Number.isFinite(Number(v)))&&d.w>=2&&d.w<=40&&d.h>=2&&d.h<=45&&
  (d.kind!=="image"||(typeof d.src==="string"&&d.src.length<16000000&&
  (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(d.src)||/^(?:\.\/)?assets\//.test(d.src))));
}
function validItem(item){
 return !!item&&typeof item.id==="string"&&
  COLORS.some(c=>c[0]===item.color)&&Object.hasOwn(SIZES,item.size)&&
  Number.isSafeInteger(item.quantity)&&item.quantity>0&&item.quantity<=100&&
  Number.isFinite(item.unitPrice)&&item.unitPrice>=0&&
  Array.isArray(item.designs)&&item.designs.length<=MAX_PRINTS&&item.designs.every(validDesign);
}
function cover(item){
 const slug=COLOR_SLUGS[item.color];
 return slug?"assets/hoodie-"+slug+"-front.webp":"assets/hoodie-front.png";
}
function releaseThumbs(){thumbnails.forEach(u=>URL.revokeObjectURL(u));thumbnails=[]}
function imageFor(item){
 if(item.preview instanceof Blob){const url=URL.createObjectURL(item.preview);thumbnails.push(url);return url}
 return cover(item);
}
function makeButton(label,callback){
 const button=document.createElement("button");button.type="button";button.textContent=label;
 button.addEventListener("click",callback);return button;
}
function renderCart(){
 $("cartCount").textContent=String(items.length);
 $("cartLinesCount").textContent=String(items.length);
 $("cartTotalPieces").textContent=count().toLocaleString("ar-EG");
 $("cartTotalPrice").textContent=money(amount());
 $("cartProceedBtn").disabled=!ready||!items.length;
 $("cartSavedNote").textContent=ready?
  "السلة محفوظة على نفس المتصفح والجهاز، ومش بتستهلك مساحة Supabase.":"جاري تحميل السلة المحلية...";
 const root=$("cartItems");releaseThumbs();root.replaceChildren();
 if(!items.length){
  const empty=document.createElement("div");empty.className="cart-empty";
  const h=document.createElement("h2");h.textContent="سلتك لسه فاضية 🛍️";
  const p=document.createElement("p");p.textContent="صمّم هوديك واحفظه هنا عشان تشتريه في أي وقت.";
  const a=document.createElement("a");a.href="#studio";a.className="teko-cta";a.textContent="ابدأ التصميم";
  empty.append(h,p,a);root.append(empty);return;
 }
 items.forEach((item,i)=>{
  const row=document.createElement("article");row.className="cart-line";
  const image=document.createElement("img");image.className="cart-line-img";image.alt="معاينة الهودي "+item.color;
  image.loading="lazy";image.src=imageFor(item);
  const body=document.createElement("div");body.className="cart-line-body";
  const title=document.createElement("h3");title.textContent="Oversize Hoodie — "+item.color;
  const meta=document.createElement("div");meta.className="cart-line-meta";
  meta.textContent="المقاس "+item.size+" · "+item.designs.length+" عناصر طباعة · القطعة "+money(item.unitPrice);
  const qWrap=document.createElement("div");qWrap.className="cart-quantity";
  const label=document.createElement("label");label.textContent="الكمية";
  const input=document.createElement("input");input.type="number";input.min="1";input.max="100";
  input.value=String(item.quantity);input.setAttribute("aria-label","كمية المنتج رقم "+(i+1));
  input.addEventListener("change",async()=>{
   const n=Number(input.value);
   if(!Number.isSafeInteger(n)||n<1||n>100){input.value=String(item.quantity);notify("اختار كمية من 1 إلى 100");return}
   const next=items.map(x=>x.id===item.id?{...x,quantity:n}:x);
   if(next.reduce((t,x)=>t+x.quantity,0)>100){input.value=String(item.quantity);notify("الحد الأقصى 100 قطعة في الطلب");return}
   try{await save(next)}catch(e){input.value=String(item.quantity);notify("تعذر حفظ الكمية")}
  });
  qWrap.append(label,input);
  const actions=document.createElement("div");actions.className="cart-line-buttons";
  actions.append(makeButton("تعديل التصميم",()=>editItem(item.id)),
   makeButton("حذف",async()=>{
    if(!confirm("حذف هذا الهودي من السلة؟"))return;
    try{await save(items.filter(x=>x.id!==item.id));if(editingId===item.id)editingId=null}
    catch(e){notify("تعذر حذف التصميم من السلة")}
   }));
  body.append(title,meta,qWrap,actions);
  const total=document.createElement("div");total.className="cart-line-total";
  total.textContent=money(item.quantity*item.unitPrice);
  row.append(image,body,total);root.append(row);
 });
}
async function save(next){await write(next);items=next;renderCart();updateCheckoutSummary()}
function snapshot(){
 const quantity=Number($("quantity").value);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw Error("الكمية بين 1 و100");
 return {id:editingId||"c-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),
  color:color[0],size,quantity,unitPrice:price(),designs:designs.map(d=>({...d})),
  at:Date.now(),preview:null};
}
async function add(){
 if(busy||!ready||cloudUploading||packageBusy)return;
 if(hasErrors()){notify("صحح مناطق الطباعة قبل إضافة الهودي للسلة");return}
 const btn=$("addToCartBtn");busy=true;btn.disabled=true;btn.textContent="جاري حفظ تصميمك...";
 try{
  const item=snapshot();
  if(!validItem(item))throw Error("تفاصيل التصميم غير صالحة للحفظ");
  if(items.length+(editingId?0:1)>MAX_LINES)throw Error("الحد الأقصى 6 تخصيصات في السلة الواحدة");
  const others=items.filter(x=>x.id!==editingId);
  if(others.reduce((n,x)=>n+x.quantity,0)+item.quantity>100)throw Error("الحد الأقصى 100 قطعة في الطلب");
  if(others.reduce((n,x)=>n+x.designs.length,0)+item.designs.length>MAX_PRINTS)throw Error("الحد الأقصى 32 عنصر طباعة في السلة");
  try{item.preview=await makePreview("front","image/jpeg",.76)}catch{}
  await save(editingId?items.map(x=>x.id===editingId?item:x):[...items,item]);
  editingId=null;
  notify("✓ تم حفظ الهودي بكل تفاصيله في السلة على جهازك");
  location.hash="#cart";route();
 }catch(e){notify("تعذر حفظ السلة: "+e.message)}
 finally{busy=false;btn.disabled=false;btn.textContent=editingId?"تحديث الهودي في السلة":"+ أضف الهودي للسلة"}
}
function editItem(id){
 const item=items.find(x=>x.id===id);if(!item)return;
 buyingCart=false;editingId=id;
 color=COLORS.find(c=>c[0]===item.color)||COLORS[0];
 size=item.size;designs=item.designs.map(d=>({...d}));
 $("quantity").value=String(item.quantity);
 history=[];future=[];selectedId=null;
 setCartMode(false);renderAll();selectView("front");renderPrice();
 $("addToCartBtn").textContent="تحديث الهودي في السلة";
 window.TEKO_DRAFT?.changed();
 location.hash="#studio";route();
 notify("عدّل التصميم ثم اضغط «تحديث الهودي في السلة»");
}
function fresh(){
 editingId=null;setCartMode(false);
 designs=[];history=[];future=[];selectedId=null;
 color=COLORS[0];size="M";view="front";$("quantity").value="1";orderDraftCode=null;
 renderAll();selectView("front");renderPrice();
 $("addToCartBtn").textContent="+ أضف الهودي للسلة";
 window.TEKO_DRAFT?.changed();
 location.hash="#studio";route();
}
function navigate(place){
 const screen=place==="cart"?"cart":place==="studio"||place==="designs"?"studio":"home";
 $("home").hidden=screen!=="home";
 $("studioView").hidden=screen!=="studio";
 $("cartPage").hidden=screen!=="cart";
 document.body.classList.toggle("studio-mode",screen==="studio");
 document.body.classList.toggle("cart-checkout-active",buyingCart&&screen==="studio");
 document.querySelectorAll("[data-route]").forEach(a=>{
  a.classList.toggle("is-active",a.dataset.route===screen);
  if(a.dataset.route===screen)a.setAttribute("aria-current","page");
  else a.removeAttribute("aria-current");
 });
 if(screen==="cart")renderCart();
 if(screen==="studio"){renderSummary();window.TEKO_START_SECURITY?.();}
 window.scrollTo(0,0);
 if(place==="designs")setTimeout(()=>$("designs").scrollIntoView({behavior:"smooth",block:"start"}),90);
}
function route(){
 const routeName=location.hash.slice(1);
 navigate(routeName==="cart"?"cart":["studio","editor","checkout"].includes(routeName)?"studio":
  ["designs","studio-designs"].includes(routeName)?"designs":"home");
 if(routeName==="checkout")setTimeout(()=>$("checkout").scrollIntoView({behavior:"smooth",block:"start"}),120);
}
function designInfo(d){
 return {view:d.view,kind:d.kind,name:String(d.sourceName||"").slice(0,60),
  text:d.kind==="text"?String(d.text||"").slice(0,90):null,
  widthCm:+Number(d.w).toFixed(2),heightCm:+Number(d.h).toFixed(2),
  x:+Number(d.x).toFixed(4),y:+Number(d.y).toFixed(4),
  font:d.kind==="text"?String(d.font||"").slice(0,35):null};
}
function payload(code){
 const qty=count(),total=amount();
 const data={
  code,created:new Date().toISOString(),
  customer:{name:$("customerName").value.trim(),phone:$("customerPhone").value.trim(),
   address:$("address").value.trim(),notes:$("notes").value.trim()},
  item:{name:"Oversize Hoodie Cart",color:items.length===1?items[0].color:"متنوع",
   size:items.length===1?items[0].size:"متعدد",quantity:qty,
   unitPrice:Math.round(total/qty),totalBeforeShipping:total},
  designs:items.flatMap((item,i)=>item.designs.map(d=>({...designInfo(d),itemIndex:i+1}))),
  items:items.map((item,i)=>({number:i+1,color:item.color,size:item.size,quantity:item.quantity,
   unitPrice:item.unitPrice,total:item.unitPrice*item.quantity,designs:item.designs.map(designInfo)})),
  print:{maxWidthCm:40,maxHeightCm:45,warning:"Approximate print locations; confirm production placements."},
 };
 if(JSON.stringify(data).length>15000)throw Error("بيانات التصميمات كبيرة. قلّل العناصر أو قسّم السلة إلى طلبين");
 return data;
}
async function bundleCart(code,data){
 const files=[],original={color,size,designs,view};
 try{
  for(let i=0;i<items.length;i++){
   const item=items[i],part=String(i+1).padStart(2,"0");
   color=COLORS.find(c=>c[0]===item.color)||COLORS[0];
   size=item.size;designs=item.designs.map(d=>({...d}));
   if(hasErrors())throw Error("تخصيص رقم "+(i+1)+" خارج مساحة الطباعة المسموحة");
   cloudMessage("جاري تجهيز الهودي "+(i+1)+" من "+items.length+"...");
   const prefix="hoodies/"+part+"-"+item.size+"/";
   for(const angle of REVIEW_VIEWS){
    assertCloudNotCancelled();
    const blob=await makePreview(angle,"image/jpeg",.84);
    files.push({name:prefix+"mockups/"+angle+(blob.type==="image/jpeg"?".jpg":".png"),blob});
   }
   const originals=await collectOriginalArtworks();
   for(const originalFile of originals)
    files.push({name:prefix+"artwork-original/"+originalFile.name,blob:originalFile.blob});
   files.push({name:prefix+"details.json",blob:new Blob([JSON.stringify(data.items[i],null,2)],{type:"application/json"})});
  }
 }finally{
  color=original.color;size=original.size;designs=original.designs;view=original.view;
  renderAll();selectView(original.view);
 }
 files.push({name:"order/details.json",blob:new Blob([JSON.stringify(data,null,2)],{type:"application/json"})});
 const instructions="TEKO STORE | رقم الطلب: "+code+"\nعدد التخصيصات: "+items.length+
  "\nإجمالي القطع: "+data.item.quantity+"\nالإجمالي قبل الشحن: "+data.item.totalBeforeShipping+
  " جنيه\nالمجلدات داخل hoodies تحتوي صور الموكاب وملفات الطباعة الأصلية لكل هودي.\n";
 files.push({name:"order/README-ar.txt",blob:new Blob([instructions],{type:"text/plain;charset=utf-8"})});
 cloudMessage("جاري تجميع ملفات السلة في ZIP...");
 const zip=await window.TEKO_PACKAGE.bundle(files);
 if(zip.size>40*1024*1024)throw Error("السلة أكبر من 40 ميجابايت؛ قلل الصور أو قسّم الطلب");
 return zip;
}
function message(code,url){
 const list=items.map((i,n)=>(n+1)+". "+i.color+" / "+i.size+" × "+i.quantity+
  " · "+money(i.quantity*i.unitPrice)+" · "+i.designs.length+" عناصر طباعة");
 return ["🛍️ طلب سلة جديد — TEKO STORE","رقم الطلب: "+code,
  "الاسم: "+$("customerName").value.trim(),"الهاتف: "+$("customerPhone").value.trim(),
  "المنتجات:",...list,
  "إجمالي القطع: "+count(),
  "الإجمالي المبدئي قبل الشحن: "+money(amount()),
  "عنوان الاستلام: "+($("address").value.trim()||"غير محدد"),
  "ملاحظات: "+($("notes").value.trim()||"لا يوجد"),
  url?"📦 رابط ZIP يشمل ملفات كل الهوديز:\n"+url+
   "\nالرابط خاص بهذا الطلب ومؤقت؛ لا تشاركه خارج فريق المتجر.":
   "📎 حمل ملف TEKO-ORDER-"+code+".zip وأرفقه في واتساب كمستند Document.",
  "الطلب مبدئي وليس دفعًا مؤكدًا."].join("\n");
}
function updateCheckoutSummary(){
 if(!buyingCart)return;
 $("summary").innerHTML='<div><span>نوع الطلب</span><b>سلة متعددة</b></div>'+
  '<div><span>التخصيصات</span><b>'+items.length+'</b></div>'+
  '<div><span>عدد القطع</span><b>'+count()+'</b></div>'+
  '<div><span>الإجمالي قبل الشحن</span><b style="color:#f84a61;font-size:18px">'+money(amount())+'</b></div>';
 $("unitPrice").textContent=money(amount());
 $("originalPrice").textContent="إجمالي السلة — ليس دفعًا مؤكدًا";
}
function setCartMode(state){
 buyingCart=state;
 $("cartCheckoutBanner").hidden=!state;
 $("singleQuantityRow").hidden=state;
 $("whatsappBtn").textContent=state?"تجهيز طلب السلة وإرساله على واتساب":"تجهيز الطلب ومشاركته على واتساب";
 if(state)updateCheckoutSummary();else renderPrice();
 document.body.classList.toggle("cart-checkout-active",state);
}
function proceed(){
 if(!items.length){notify("أضف هودي للسلة أولًا");return}
 if(count()>100||items.reduce((n,x)=>n+x.designs.length,0)>MAX_PRINTS){
  notify("السلة تجاوزت الحد المسموح به لطلب واحد");return
 }
 setCartMode(true);location.hash="#checkout";route();
}
async function submit(){
 if(!buyingCart||busy)return;
 if(cloudUploading){
  cloudCancelRequested=true;if(activeCloudXHR)activeCloudXHR.abort();
  cloudMessage("جاري إلغاء رفع طلب السلة...");return;
 }
 if(!items.length){notify("السلة فارغة");return}
 if(!$("customerName").value.trim()){notify("اكتب اسمك لإتمام الطلب");$("customerName").focus();return}
 if(!/^01\d{9}$/.test($("customerPhone").value.trim())){
  notify("اكتب رقم هاتف مصري صحيح 11 رقم");$("customerPhone").focus();return;
 }
 if(CLOUD_ACTIVE&&!turnstileToken){
  notify("أكمل تحقق Cloudflare أولًا");
  $("cloudSecurity").scrollIntoView({behavior:"smooth",block:"center"});return;
 }
 let tab=null;try{
  tab=window.open("about:blank","_blank");
  if(tab){tab.opener=null;tab.document.title="TEKO STORE — تجهيز الطلب";
   tab.document.body.innerHTML='<p dir="rtl" style="font:18px Tahoma;text-align:center;margin-top:15vh">جاري تجهيز هوديز السلة...</p>';}
 }catch{}
 cloudUploading=true;cloudCancelRequested=false;cloudDeadlineAt=Date.now()+180000;cloudPreparedZip=null;
 const button=$("whatsappBtn");button.textContent="إلغاء تجهيز السلة";
 let zip=null,code="";
 try{
  code="TK-"+Date.now().toString().slice(-10);
  const order=payload(code);
  zip=await bundleCart(code,order);cloudPreparedZip=zip;
  assertCloudNotCancelled();
  let link="";
  if(CLOUD_ACTIVE)link=await uploadZipForSupabase(code,zip,order);
  else saveBlob(zip,"TEKO-ORDER-"+code+".zip");
  assertCloudNotCancelled();
  const wa="https://wa.me/201557229102?text="+encodeURIComponent(message(code,link));
  cloudMessage("✓ تم تجهيز كل منتجات السلة في طلب واحد. أكمل إرسال الرسالة على واتساب. السلة ستظل محفوظة.");
  if(tab&&!tab.closed)tab.location.replace(wa);else window.location.href=wa;
  notify("تم تجهيز طلب السلة، أكمل الإرسال من واتساب");
 }catch(error){
  if(!cloudCancelRequested&&zip){
   try{
    saveBlob(zip,"TEKO-ORDER-"+code+".zip");
    const wa="https://wa.me/201557229102?text="+encodeURIComponent(message(code,""));
    if(tab&&!tab.closed)tab.location.replace(wa);else window.location.href=wa;
    cloudMessage("تعذر الرفع السحابي، نزل ZIP كبديل. أرفقه في واتساب؛ قد لا يظهر هذا الطلب في لوحة المالك.");
   }catch{if(tab&&!tab.closed)tab.close();cloudMessage("فشل تجهيز السلة: "+error.message)}
  }else{if(tab&&!tab.closed)tab.close();cloudMessage("لم يكتمل طلب السلة: "+error.message)}
 }finally{
  refreshChallenge();cloudUploading=false;cloudCancelRequested=false;cloudDeadlineAt=0;cloudPreparedZip=null;
  button.textContent="تجهيز طلب السلة وإرساله على واتساب";
 }
}
window.TEKO_CART={isCheckoutActive:()=>buyingCart,submit,updateCheckoutSummary};
window.addEventListener("hashchange",route);
document.querySelectorAll("[data-start-fresh]").forEach(button=>button.addEventListener("click",e=>{
 e.preventDefault();fresh();
}));
document.querySelectorAll("[data-product-color]").forEach(button=>button.addEventListener("click",e=>{
 e.preventDefault();
 const selection=COLORS.find(x=>x[0]===button.dataset.productColor);
 if(selection){color=selection;renderAll();drawBackground();prefetchSelectedColor(color[0])}
 editingId=null;setCartMode(false);$("addToCartBtn").textContent="+ أضف الهودي للسلة";
 location.hash="#studio";route();
}));
$("addToCartBtn").addEventListener("click",add);
$("cartProceedBtn").addEventListener("click",proceed);
$("cartReturnBtn").addEventListener("click",()=>{setCartMode(false);location.hash="#studio";route()});
(async()=>{
 try{const saved=await read();items=Array.isArray(saved)?saved.filter(validItem).slice(0,MAX_LINES):[];
  ready=true;renderCart();
 }catch(error){ready=false;renderCart();$("cartSavedNote").textContent=
  "الحفظ المحلي غير متاح: "+(error.message||"افتح الموقع خارج الوضع الخفي");}
 route();
})();
})();