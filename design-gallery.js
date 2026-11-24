/* TEKO STORE V48 — public, shared design gallery.
 * Source: catalog/gallery.json on the same origin, not a browser-only local gallery.
 * This module never writes orders, cart, drafts, cookies, or Supabase data.
 */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const grid=$("publicGalleryGrid");
 if(!grid)return;
 const filters=$("galleryCategories"),search=$("gallerySearch"),summary=$("galleryCount");
 const blank=$("galleryEmpty"),emptyTitle=$("galleryEmptyTitle"),emptyText=$("galleryEmptyText");
 const dialog=$("galleryDetail"),previewArt=$("galleryPreviewArt"),previewTitle=$("galleryPreviewTitle");
 const previewNote=$("galleryPreviewNote"),previewUse=$("galleryPreviewUse"),previewClose=$("galleryPreviewClose");
 const status=$("galleryStatus");
 let items=[],category="الكل",busy=false,previewItem=null,loaded=false,attempted=false;
 const safePath=value=>typeof value==="string"&&
    /^assets\/design-gallery\/[a-z0-9_\/-]+\.(png|jpe?g|webp)$/i.test(value)&&
    !value.includes("..");
 const clean=(record,index)=>{
  if(!record||typeof record!=="object")return null;
  const id=String(record.id||"").trim();
  const title=String(record.title||"").trim();
  if(!/^[a-z0-9_-]{1,60}$/i.test(id)||!title||title.length>80)return null;
  const kind=record.kind==="image"?"image":record.kind==="text"?"text":null;
  if(!kind)return null;
  if(kind==="image"&&!safePath(record.src))return null;
  const font=["Impact","Arial Black","Georgia","Tahoma","Cairo"].includes(record.font)?record.font:"Impact";
  const color=/^#[a-f0-9]{6}$/i.test(String(record.color||""))?record.color:"#ffffff";
  return Object.freeze({
   id,title,category:String(record.category||"تصميمات").slice(0,35),
   kind,src:kind==="image"?record.src:null,
   text:kind==="text"?String(record.text||title).slice(0,90):"",
   color,font,featured:record.featured===true,order:index
  });
 };
 const showNotice=(title,msg)=>{
  blank.hidden=false;emptyTitle.textContent=title;emptyText.textContent=msg;
 };
 function artwork(item){
  const outer=document.createElement("div");
  outer.className="gallery-artwork variant-"+(1+(item.order%4));
  const tag=document.createElement("span");tag.className="gallery-type-chip";
  tag.textContent=item.kind==="image"?"تصميم جاهز":"كتابة جاهزة";
  outer.append(tag);
  if(item.kind==="image"){
   const im=document.createElement("img");
   im.src=item.src;im.loading="lazy";im.decoding="async";im.alt="تصميم "+item.title;
   im.addEventListener("error",()=>{
    im.remove();
    const span=document.createElement("span");span.className="gallery-lettering";
    span.textContent="الصورة غير متاحة";outer.append(span);
   },{once:true});
   outer.append(im);
  }else{
   const span=document.createElement("span");
   span.className="gallery-lettering";
   span.textContent=item.text;span.style.color=item.color;
   outer.append(span);
  }
  return outer;
 }
 function button(text,className,attr,id){
  const el=document.createElement("button");
  el.type="button";el.textContent=text;el.className=className;
  el.dataset[attr]=id;return el;
 }
 function render(){
  if(!loaded)return;
  const term=search.value.trim().toLocaleLowerCase();
  const selected=items.filter(item=>(category==="الكل"||item.category===category)&&
    (!term||(item.title+" "+item.text+" "+item.category).toLocaleLowerCase().includes(term)));
  grid.replaceChildren();
  const frag=document.createDocumentFragment();
  selected.forEach(item=>{
   const card=document.createElement("article");card.className="gallery-card-public";
   card.append(artwork(item));
   const info=document.createElement("div");info.className="gallery-card-info";
   const title=document.createElement("h3");title.textContent=item.title;
   const note=document.createElement("p");note.textContent=item.category+" · "+(item.kind==="text"?"قابل لتعديل اللون والحجم":"ملف تصميم جاهز");
   const actions=document.createElement("div");actions.className="gallery-card-actions";
   actions.append(button("معاينة","gallery-see","galleryOpen",item.id),
    button("استخدم التصميم","gallery-try","galleryAdd",item.id));
   info.append(title,note,actions);card.append(info);frag.append(card);
  });
  grid.append(frag);
  summary.textContent="عرض "+selected.length.toLocaleString("ar-EG")+" من "+items.length.toLocaleString("ar-EG")+" تصميم";
  if(selected.length)blank.hidden=true;
  else if(!items.length)showNotice("المعرض لسه بيتجهّز","التصميمات الأصلية هتظهر هنا أول ما تتضاف لمعرض TEKO العام.");
  else showNotice("مفيش تصميمات مطابقة","جرّب كلمة بحث مختلفة أو اختار «الكل» من التصنيفات.");
 }
 function renderCategories(){
  filters.replaceChildren();
  const options=["الكل",...new Set(items.map(x=>x.category))];
  for(const choice of options){
   const el=document.createElement("button");
   el.type="button";el.className="gallery-category";el.dataset.category=choice;
   el.setAttribute("aria-pressed",String(choice===category));el.textContent=choice;
   filters.append(el);
  }
 }
 function closePreview(){if(dialog.open)dialog.close();previewItem=null;status.textContent="";}
 function openPreview(item){
  previewItem=item;previewTitle.textContent=item.title;
  previewNote.textContent=item.category+" · "+
   (item.kind==="text"?"العبارة ممكن تعدّل مكانها ومقاسها ولونها في الاستوديو.":"تقدر تتحكم في الحجم والمكان من الاستوديو.");
  previewArt.replaceChildren(artwork(item));status.textContent="";
  dialog.showModal();previewClose.focus();
 }
 async function useItem(item,buttonElement){
  if(busy||!item)return;
  if(typeof window.TEKO_GALLERY_USE!=="function"){
   status.textContent="استوديو التصميم لسه مش جاهز. جرّب تحديث الصفحة.";return;
  }
  busy=true;
  if(buttonElement)buttonElement.disabled=true;
  status.textContent="جاري إضافة التصميم للهودي...";
  try{
   const ok=await window.TEKO_GALLERY_USE(item);
   if(ok!==false){closePreview();location.hash="#studio";}
   else status.textContent="تعذر إضافة التصميم. جرّب مرة تانية.";
  }catch(e){status.textContent="تعذر تحميل التصميم. تأكد من اتصال الإنترنت أو جرّب غيره.";}
  finally{busy=false;if(buttonElement)buttonElement.disabled=false;}
 }
 async function load(){
  if(busy||loaded)return;
  attempted=true;summary.textContent="جاري تحميل التصميمات...";
  try{
   const response=await fetch("catalog/gallery.json",{cache:"no-store",credentials:"same-origin"});
   if(!response.ok)throw Error("Catalog HTTP "+response.status);
   const data=await response.json();
   if(!Array.isArray(data.items))throw Error("Unexpected catalog");
   const seen=new Set();
   items=data.items.map(clean).filter(item=>{
    if(!item||seen.has(item.id))return false;
    seen.add(item.id);return true;
   }).sort((a,b)=>Number(b.featured)-Number(a.featured)||a.order-b.order);
   window.TEKO_GALLERY_ITEMS=items;
   window.dispatchEvent(new Event("teko-gallery-updated"));
   loaded=true;renderCategories();render();
  }catch(e){
   grid.replaceChildren();summary.textContent="تعذر تحميل المعرض";
   showNotice("تعذر تحميل معرض التصميمات","تأكد إنك متصل بالإنترنت ثم اضغط «إعادة المحاولة».");
   $("galleryRetry").hidden=false;
  }
 }
 $("galleryRetry")?.addEventListener("click",()=>{ $("galleryRetry").hidden=true;void load(); });
 search.addEventListener("input",render);
 filters.addEventListener("click",event=>{
  const categoryButton=event.target.closest("button[data-category]");
  if(!categoryButton)return;
  category=categoryButton.dataset.category;renderCategories();render();
 });
 grid.addEventListener("click",event=>{
  const target=event.target.closest("button[data-gallery-open],button[data-gallery-add]");
  if(!target)return;
  const designId=target.dataset.galleryOpen||target.dataset.galleryAdd;
  const item=items.find(x=>x.id===designId);
  if(!item)return;
  if(target.dataset.galleryOpen)openPreview(item);
  else void useItem(item,target);
 });
 previewUse.addEventListener("click",()=>void useItem(previewItem,previewUse));
 previewClose.addEventListener("click",closePreview);
 dialog.addEventListener("click",event=>{if(event.target===dialog)closePreview()});
 dialog.addEventListener("close",()=>{previewItem=null;status.textContent=""});
 window.TEKO_GALLERY_RENDER=()=>{if(!loaded)void load();else render()};
 void load();
})();
