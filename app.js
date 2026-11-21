'use strict';
const ASSETS={front:'assets/hoodie-front.png',back:'assets/hoodie-back.png',left:'assets/hoodie-left.png',right:'assets/hoodie-right.png'};
const VIEW_NAMES={front:'الأمام',back:'الخلف',left:'الجانب 1',right:'الجانب 2'};
const SIZES={M:[60,70,58],L:[62,72,60],XL:[64,74,62],'2XL':[66,76,64],'3XL':[68,78,66]};
const COLORS=[['أبيض','#f2efeb'],['أسود','#18181a'],['زيتي','#66744a'],['برجندي','#743043'],['كحلي','#273851'],['رمادي','#83888c'],['بيج','#c9b79c'],['بني','#79543f']];
const DEFAULT_GALLERY=[{id:'g1',name:'TEKO BOLD',text:'TEKO'},{id:'g2',name:'STREET ENERGY',text:'STREET'},{id:'g3',name:'YOUR STYLE',text:'YOUR STYLE'},{id:'g4',name:'NO LIMITS',text:'NO LIMITS'}];
const PRINT_LIMITS={width:40,height:45};
const DEFAULT={price:650,discount:0,gallery:DEFAULT_GALLERY,orders:[]};
const $=id=>document.getElementById(id);
let store;try{store={...DEFAULT,...JSON.parse(localStorage.getItem('teko-store-demo')||'{}')}}catch{store={...DEFAULT}};
let view='front',color=COLORS[2],size='M',designs=[],selectedId=null,history=[],future=[],showTools=true,photoCache={},lastFile=null,dragging=null,toastTimer=null;
const canvas=$('hoodCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),layer=$('designLayer');
function persist(){try{localStorage.setItem('teko-store-demo',JSON.stringify(store))}catch{notify('ذاكرة المتصفح امتلأت. المعرض الكبير يحتاج تخزين سحابي.')}}
function notify(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3500)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
function id(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
const areas={
 front:[{x:.290,y:.566,w:.420,h:.205,label:'الجيب الأمامي'},{x:.375,y:.210,w:.252,h:.043,label:'خياطة الرقبة'},{x:.135,y:.817,w:.116,h:.075,label:'منطقة التطريز والحياكة'},{x:.765,y:.817,w:.111,h:.075,label:'منطقة التطريز والحياكة'}],
 back:[{x:.335,y:.132,w:.330,h:.145,label:'الكابيشو والخياطة'},{x:.490,y:.130,w:.018,h:.275,label:'خياطة منتصف الخلف'},{x:.155,y:.832,w:.105,h:.052,label:'حياكة طرف الكم'},{x:.743,y:.832,w:.116,h:.052,label:'حياكة طرف الكم'}],
 left:[{x:.410,y:.290,w:.230,h:.080,label:'خياطة الكتف'},{x:.398,y:.820,w:.210,h:.066,label:'حياكة الكفة'},{x:.570,y:.547,w:.155,h:.220,label:'الجيب الجانبي'}],
 right:[{x:.405,y:.284,w:.242,h:.080,label:'خياطة الكتف'},{x:.380,y:.825,w:.225,h:.060,label:'حياكة الكفة'},{x:.270,y:.540,w:.142,h:.226,label:'الجيب الجانبي'}]
};
function scaleW(){return .66/SIZES[size][0]}
function getBounds(d){const w=d.w*scaleW(),h=d.h*scaleW()*(1122/1402);return{x:d.x,y:d.y,w,h}}
function textSize(d,displayWidth){const b=getBounds(d),boxW=b.w*displayWidth,boxH=b.h*displayWidth*1402/1122,chars=Array.from(d.text||'A').length;return Math.max(8,Math.min(boxH*.74,boxW/Math.max(1,chars*.62)))}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function violations(d){const b=getBounds(d);const off=b.x<.04||b.y<.055||b.x+b.w>.96||b.y+b.h>.95;
 return [...areas[d.view].filter(z=>overlaps(b,z)),...(off?[{x:Math.max(0,b.x),y:Math.max(0,b.y),w:b.w,h:b.h,label:'خارج مساحة الهودي'}]:[]),...((d.w>PRINT_LIMITS.width+.001||d.h>PRINT_LIMITS.height+.001)?[{...b,label:'التصميم أكبر من الحد الأقصى للطباعة'}]:[])];}
function hasErrors(){return designs.some(d=>violations(d).length>0)}
function snapshot(){history.push(JSON.stringify(designs));if(history.length>40)history.shift();future=[]}
function current(){return designs.find(d=>d.id===selectedId)}
// Material-aware color grading: preserve the photographic fabric relief without
// multiplying bright palette RGB values into clipped highlights.
// Each recipe targets the *fabric appearance*, not the UI swatch brightness.
// Neutral tones deliberately remove the olive chroma from the original image.
const FABRIC_GRADES={
  'أبيض':   {rgb:[217,217,214],contrast:38,blackPoint:11,whitePoint:247},
  'أسود':   {rgb:[32,33,36],contrast:18,blackPoint:7,whitePoint:109},
  'برجندي': {rgb:[107,49,67],contrast:29,blackPoint:9,whitePoint:200},
  'كحلي':   {rgb:[46,61,83],contrast:29,blackPoint:8,whitePoint:190},
  'رمادي':  {rgb:[135,137,139],contrast:33,blackPoint:10,whitePoint:220},
  'بيج':    {rgb:[195,186,173],contrast:34,blackPoint:11,whitePoint:239},
  'بني':    {rgb:[112,83,72],contrast:32,blackPoint:9,whitePoint:204}
};
function drawBackground(){
 const image=photoCache[view];if(!image)return;
 ctx.clearRect(0,0,1122,1402);
 ctx.drawImage(image,0,0,1122,1402);
 if(color[0]==='زيتي')return; // Exact original sample, with its lighting and weave preserved.
 const recipe=FABRIC_GRADES[color[0]];
 if(!recipe)return;
 let frame;
 try{frame=ctx.getImageData(0,0,1122,1402)}
 catch(err){notify('تعذر معالجة لون الصورة؛ شغّل النسخة كاملة.');return}
 const v=frame.data, target=recipe.rgb;
 for(let i=0;i<v.length;i+=4){
   const r=v[i],g=v[i+1],b=v[i+2];
   const chroma=Math.max(r,g,b)-Math.min(r,g,b);
   // Chromatic screen isolates olive fabric from the neutral gray studio background.
   let coverage=Math.min(1,Math.max(0,(chroma-7)/15)) *
     Math.min(1,Math.max(0,(g-b-5)/13));
   if(!(g>r*.78 && r>b*.97))coverage=0;
   if(coverage<.012)continue;
   const light=.30*r+.59*g+.11*b;
   // Log lightness preserves folds across light/dark colors and avoids the
   // clipped white/washed beige/flat orange brown of the previous RGB multiplier.
   let delta=recipe.contrast*Math.log2((light+13)/85);
   if(light<43)delta*=1.18; // Retain the sculpted depth in the hood and sleeve folds.
   for(let c=0;c<3;c++){
     // Soft highlight roll-off, useful especially for white and stone-beige.
     let out=target[c]+delta;
     if(out>recipe.whitePoint-12)out=recipe.whitePoint-12+12*(1-Math.exp(-(out-(recipe.whitePoint-12))/12));
     out=Math.max(recipe.blackPoint,Math.min(recipe.whitePoint,out));
     v[i+c]=Math.round(v[i+c]*(1-coverage)+out*coverage);
   }
 }
 ctx.putImageData(frame,0,0);
}

function hex(h){h=h.slice(1);return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function loadImages(){Object.entries(ASSETS).forEach(([v,path])=>{const im=new Image();im.onload=()=>{photoCache[v]=im;if(view===v)drawBackground()};im.onerror=()=>notify('تعذر تحميل زاوية الهودي: '+VIEW_NAMES[v]);
 // Inline original PNG bytes keep the canvas origin-clean even when index.html is opened via file://.
 im.src=(window.TEKO_HOODIE_IMAGES&&window.TEKO_HOODIE_IMAGES[v])||path;})}
function renderColors(){$('colors').innerHTML=COLORS.map((c,i)=>`<button class="swatch ${color[0]===c[0]?'selected':''}" data-color="${i}"><i style="background:${c[1]}"></i>${c[0]}</button>`).join('')}
function renderSizes(){$('sizes').innerHTML=Object.keys(SIZES).map(s=>`<button class="chip ${s===size?'selected':''}" data-size="${s}">${s}</button>`).join('');let q=SIZES[size];$('sizeInfo').textContent=`عرض الصدر ${q[0]} سم · طول الهودي ${q[1]} سم · طول الكم ${q[2]} سم`}
function renderGallery(){$('gallery').innerHTML=store.gallery.map(g=>`<div class="gitem"><div class="gpreview">${g.src?`<img alt="" src="${g.src}">`:`<span>${escapeHTML(g.text||g.name)}</span>`}</div><button data-gallery="${escapeHTML(g.id)}">+ أضف ${escapeHTML(g.name)}</button></div>`).join('')}
function addDesign(d){snapshot();const newItem={id:id(),view,kind:d.kind||'image',src:d.src||null,sourceName:d.sourceName||'تصميم',text:d.text||'',font:d.font||'Impact',color:d.color||'#ffffff',x:.42,y:.32,w:15,h:10,ratio:1.5};newItem.ratio=newItem.w/newItem.h;designs.push(newItem);selectedId=newItem.id;renderAll();notify('تمت إضافة التصميم؛ اسحبه للمكان المطلوب')}
function renderDesigns(){layer.innerHTML='';designs.filter(d=>d.view===view).forEach(d=>{const b=getBounds(d),el=document.createElement('div');el.className='design'+(selectedId===d.id&&showTools?' selected':'');el.dataset.id=d.id;el.style.left=(b.x*100)+'%';el.style.top=(b.y*100)+'%';el.style.width=(b.w*100)+'%';el.style.height=(b.h*100)+'%';
 if(d.kind==='image'){const image=document.createElement('img');image.src=d.src;image.alt=d.sourceName;el.appendChild(image)}else{const span=document.createElement('span');span.className='tx';span.textContent=d.text;span.style.fontFamily=d.font+",Arial,sans-serif";span.style.color=d.color;span.style.fontSize=textSize(d,layer.clientWidth)+'px';
 el.appendChild(span)}
 const handle=document.createElement('span');handle.className='resize';el.appendChild(handle);layer.appendChild(el);
 if(d.kind==='text'){const span=el.querySelector('.tx');span.style.fontSize=textSize(d,layer.clientWidth)+'px';}
 });renderZones();renderEditTools()}
function renderZones(){const z=$('zones');z.innerHTML='';z.style.pointerEvents='none';const invalid=designs.filter(d=>d.view===view).flatMap(d=>violations(d));if(invalid.length){invalid.forEach(a=>{const box=document.createElement('div');box.className='invalid-outline';box.style.left=(a.x*100)+'%';box.style.top=(a.y*100)+'%';box.style.width=(a.w*100)+'%';box.style.height=(a.h*100)+'%';z.appendChild(box)})}
 const validation=$('validation');if(hasErrors()){validation.className='notice danger';validation.textContent='⚠ يوجد تصميم داخل منطقة ممنوعة أو خارج الحدود. حرّكه حتى يختفي الخط الأحمر؛ لن يتم تأكيد الطلب قبل التصحيح.'}else{validation.className='notice';validation.textContent='اسحب التصميم لأي مكان مناسب على الهودي. إذا تداخل مع الجيب أو الخياطة سيظهر خط أحمر.'}
 $('whatsappBtn').disabled=hasErrors();$('shareBtn').disabled=hasErrors();}
function renderEditTools(){const d=current();$('editTools').style.opacity=d?'1':'.5';$('designWidth').disabled=$('designHeight').disabled=$('removeSelected').disabled=$('lockRatio').disabled=!d;$('designWidth').value=d?Number(d.w.toFixed(1)):'';$('designHeight').value=d?Number(d.h.toFixed(1)):'';$('selectedLabel').textContent=d?`المختار: ${d.sourceName||d.text} — ${VIEW_NAMES[d.view]}`:'اختار تصميمًا للتحكم فيه.'}
function price(){return Math.round(store.price*(1-store.discount/100))}
function renderPrice(){$('unitPrice').textContent=price().toLocaleString('ar-EG')+' ج.م';$('originalPrice').textContent=store.discount>0?`بدلًا من ${store.price} جنيه · خصم ${store.discount}%`:'';$('adminPrice').value=store.price;$('adminDiscount').value=store.discount;renderSummary()}
function renderSummary(){const qty=Math.max(1,parseInt($('quantity').value)||1),amount=qty*price();$('summary').innerHTML=`<div><span>المنتج</span><b>هودي Oversize</b></div><div><span>اللون</span><b>${color[0]}</b></div><div><span>مقاس الهودي</span><b>${size}</b></div><div><span>الكمية</span><b>${qty}</b></div><div><span>عناصر الطباعة</span><b>${designs.length}</b></div><hr style="border:0;border-top:1px solid #e5e5e8"><div><span>الإجمالي قبل الشحن</span><b style="color:#d8172a;font-size:16px">${amount.toLocaleString('ar-EG')} ج.م</b></div>`}
function renderAll(){renderColors();renderSizes();renderDesigns();renderSummary();}
function selectView(v){view=v;selectedId=null;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===view));drawBackground();renderDesigns()}
function clampPrintSize(d,w,h){
 w=Math.max(2,Number(w)||2);h=Math.max(2,Number(h)||2);
 if(d.keepRatio===false){return {w:Math.min(PRINT_LIMITS.width,w),h:Math.min(PRINT_LIMITS.height,h)};}
 const scale=Math.min(1,PRINT_LIMITS.width/w,PRINT_LIMITS.height/h);
 return {w:w*scale,h:h*scale};
}
function applyMeasure(axis,n){const d=current();if(!d)return;
 const requested=Number(n)||2;const input=Math.max(2,requested);
 snapshot();let w=axis==='w'?input:d.w,h=axis==='h'?input:d.h;
 if(d.keepRatio!==false){if(axis==='w')h=w/d.ratio;else w=h*d.ratio;}
 const result=clampPrintSize(d,w,h);d.w=+result.w.toFixed(2);d.h=+result.h.toFixed(2);
 if(Math.abs(d.w-w)>.02||Math.abs(d.h-h)>.02)notify('الحد الأقصى للطباعة 40 سم عرض × 45 سم ارتفاع');
 renderDesigns();renderSummary();
}
// DOM events
$('colors').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;color=COLORS[+b.dataset.color];renderColors();drawBackground();renderSummary()});
$('sizes').addEventListener('click',e=>{const b=e.target.closest('[data-size]');if(!b)return;size=b.dataset.size;renderSizes();renderDesigns();renderSummary()});
$('viewButtons').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)selectView(b.dataset.view)});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t===b));for(const name of ['Gallery','Upload','Text'])$('tab'+name).hidden=(name.toLowerCase()!==b.dataset.tab)}));
$('gallery').addEventListener('click',e=>{const b=e.target.closest('[data-gallery]');if(!b)return;const g=store.gallery.find(x=>x.id===b.dataset.gallery);if(g){if(g.src)addDesign({kind:'image',src:g.src,sourceName:g.name});else addDesign({kind:'text',text:g.text||g.name,font:'Impact',color:'#ffffff',sourceName:g.name})}});
function fileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}
$('uploadFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>6*1024*1024){notify('حجم الملف كبير. الحد التجريبي 6 ميجابايت');return}lastFile=f;const src=await fileData(f);addDesign({kind:'image',src,sourceName:f.name});e.target.value=''});
$('addText').addEventListener('click',()=>{const text=$('textContent').value.trim();if(!text){notify('اكتب الجملة أولًا');return}addDesign({kind:'text',text,font:$('font').value,color:$('textColor').value,sourceName:'كتابة: '+text.slice(0,25)})});
$('designWidth').addEventListener('change',e=>applyMeasure('w',e.target.value));$('designHeight').addEventListener('change',e=>applyMeasure('h',e.target.value));
$('lockRatio').addEventListener('click',()=>{const d=current();if(!d)return;d.keepRatio=d.keepRatio===false;d.ratio=d.w/d.h;$('lockRatio').textContent=d.keepRatio?'🔒 تناسب الأبعاد':'🔓 تعديل حر';notify(d.keepRatio?'تم قفل تناسب الأبعاد':'تم فتح تناسب الأبعاد')});
$('removeSelected').addEventListener('click',()=>{if(!current())return;snapshot();designs=designs.filter(d=>d.id!==selectedId);selectedId=null;renderAll()});
$('undoBtn').addEventListener('click',()=>{if(!history.length)return;future.push(JSON.stringify(designs));designs=JSON.parse(history.pop());selectedId=null;renderAll()});$('redoBtn').addEventListener('click',()=>{if(!future.length)return;history.push(JSON.stringify(designs));designs=JSON.parse(future.pop());selectedId=null;renderAll()});
$('previewBtn').addEventListener('click',()=>{showTools=!showTools;renderDesigns()});$('quantity').addEventListener('input',renderSummary);
// Pointer-driven positioning and scaling: all positions are normalized to the reference picture.
layer.addEventListener('pointerdown',e=>{const el=e.target.closest('.design');if(!el)return;const d=designs.find(d=>d.id===el.dataset.id);if(!d)return;e.preventDefault();if(selectedId!==d.id){selectedId=d.id;renderDesigns()};snapshot();dragging={id:d.id,mode:e.target.classList.contains('resize')?'resize':'move',startX:e.clientX,startY:e.clientY,x:d.x,y:d.y,w:d.w,h:d.h,ratio:d.ratio};});
window.addEventListener('pointermove',e=>{if(!dragging)return;const d=designs.find(v=>v.id===dragging.id);if(!d)return;const rect=layer.getBoundingClientRect(),dx=(e.clientX-dragging.startX)/rect.width,dy=(e.clientY-dragging.startY)/rect.height;
 if(dragging.mode==='move'){d.x=Math.max(-.15,Math.min(1.15,dragging.x+dx));d.y=Math.max(-.15,Math.min(1.15,dragging.y+dy));}
 else{const inc=(-dx/scaleW())+(dy/(scaleW()*1122/1402));const w=Math.max(2,dragging.w+inc*.55),h=d.keepRatio===false?Math.max(2,dragging.h+dy/(scaleW()*1122/1402)):w/dragging.ratio;const measured=clampPrintSize(d,w,h);d.w=measured.w;d.h=measured.h;}
 const el=layer.querySelector(`[data-id="${d.id}"]`);if(el){const b=getBounds(d);el.style.left=(b.x*100)+'%';el.style.top=(b.y*100)+'%';el.style.width=(b.w*100)+'%';el.style.height=(b.h*100)+'%';if(d.kind==='text'){el.querySelector('.tx').style.fontSize=textSize(d,layer.clientWidth)+'px'}}
 renderZones();renderEditTools();renderSummary();});
window.addEventListener('pointerup',()=>{if(dragging){dragging=null;renderDesigns()}});
// Export actual source image + graphics via canvas (no HTML capture dependency).
async function makePreview(targetView=view){if(!photoCache[targetView])throw new Error('الصورة لم تكتمل');const prev=view;const off=document.createElement('canvas');off.width=1122;off.height=1402;const p=off.getContext('2d');
 // Preserve state while rendering the chosen product view and its selected color.
 view=targetView;drawBackground();p.drawImage(canvas,0,0);view=prev;if(prev!==targetView)drawBackground();
 for(const d of designs.filter(x=>x.view===targetView)){const b=getBounds(d),x=b.x*1122,y=b.y*1402,w=b.w*1122,h=b.h*1402;
 if(d.kind==='text'){p.textAlign='center';p.textBaseline='middle';p.fillStyle=d.color;p.font=`900 ${Math.round(textSize(d,1122))}px ${d.font},Arial`;p.fillText(d.text,x+w/2,y+h/2,w);}
 else if(d.src){const img=await loadAsset(d.src);p.drawImage(img,x,y,w,h)} }
 return new Promise(resolve=>off.toBlob(blob=>resolve(blob),'image/png'));
}
function loadAsset(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),15000)}
$('exportBtn').addEventListener('click',async()=>{try{const blob=await makePreview();saveBlob(blob,'TEKO-hoodie-'+view+'.png');notify('تم تجهيز معاينة PNG للتنزيل')}catch{notify('المعاينة غير جاهزة بعد')}});
async function collectFiles(){let files=[];const views=[...new Set(designs.map(d=>d.view))];for(const v of (views.length?views:[view])){const blob=await makePreview(v);files.push(new File([blob],`TEKO-mockup-${v}.png`,{type:'image/png'}))}
 for(const d of designs){if(d.kind==='image'&&d.src){try{const blob=await(await fetch(d.src)).blob();files.push(new File([blob],d.sourceName||('artwork-'+d.id+'.png'),{type:blob.type||'image/png'}))}catch{}}}
 return files}
$('downloadBtn').addEventListener('click',async()=>{if(hasErrors()){notify('صحح مكان التصميم أولًا');return}try{const files=await collectFiles();files.forEach((f,i)=>setTimeout(()=>saveBlob(f,f.name),150*i));notify('الملفات جاهزة للتنزيل؛ اسمح بتنزيل الملفات المتعددة لو طلب المتصفح')}catch{notify('تعذر تجهيز الملفات')}});
function orderMessage(code){const qty=Math.max(1,parseInt($('quantity').value)||1);return `🛍️ طلب جديد — TEKO STORE\nرقم الطلب: ${code}\nالعميل: ${$('customerName').value.trim()||'غير محدد'}\nهاتف: ${$('customerPhone').value.trim()||'غير محدد'}\nالمنتج: Oversize Hoodie\nاللون: ${color[0]}\nالمقاس: ${size}\nالكمية: ${qty}\nسعر القطعة: ${price()} جنيه${store.discount?' (خصم '+store.discount+'%)':''}\nالإجمالي قبل الشحن: ${qty*price()} جنيه\n\nتفاصيل الطباعة:\n${designs.map((d,i)=>`${i+1}. ${VIEW_NAMES[d.view]} — ${d.kind==='text'?'عبارة: '+d.text:'تصميم: '+d.sourceName} — عرض ${(+d.w).toFixed(1)} سم × ارتفاع ${(+d.h).toFixed(1)} سم — الموضع النسبي (${(d.x*100).toFixed(1)}%, ${(d.y*100).toFixed(1)}%)${d.kind==='text'?' — الخط '+d.font+' — اللون '+d.color:''}`).join('\n')||'بدون طباعة'}\n\nالعنوان: ${$('address').value.trim()||'لم يُحدد'}\nالملاحظات: ${$('notes').value.trim()||'لا يوجد'}\n\nملاحظة: معاينات الطلب وملفات التصميم تحتاج إرفاقًا أو رابط تخزين منفصل.`}
function validateOrder(){if(hasErrors()){notify('ممنوع تأكيد طلب داخل منطقة الطباعة المحظورة');return false}if(!$('customerName').value.trim()){notify('اكتب اسم العميل أولًا');$('customerName').focus();return false}if(!/^01\d{9}$/.test($('customerPhone').value.trim())){notify('اكتب رقم موبايل مصري صحيح (11 رقم)');$('customerPhone').focus();return false}return true}
function recordOrder(code){store.orders.unshift({code,date:new Date().toISOString(),name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),qty:Math.max(1,+$('quantity').value||1),color:color[0],size,total:price()*Math.max(1,+$('quantity').value||1),views:[...new Set(designs.map(d=>d.view))]});persist();renderOrders()}
$('whatsappBtn').addEventListener('click',()=>{if(!validateOrder())return;const code='TK-'+Date.now().toString().slice(-8);recordOrder(code);const msg=orderMessage(code);window.open('https://wa.me/201557229102?text='+encodeURIComponent(msg),'_blank','noopener');notify('تم فتح رسالة واتساب. الصور تحتاج إرفاقها يدويًا أو ربط تخزين سحابي.');});
$('shareBtn').addEventListener('click',async()=>{if(!validateOrder())return;const code='TK-'+Date.now().toString().slice(-8);try{const files=await collectFiles();if(navigator.canShare?.({files})){await navigator.share({files,title:'TEKO STORE '+code,text:orderMessage(code)});recordOrder(code);notify('تم فتح مشاركة الملفات؛ اختار واتساب وحدد رقم المتجر')}else{notify('المتصفح لا يدعم مشاركة ملفات؛ استخدم تنزيل الملفات وفتح واتساب')}}catch(e){if(e.name!=='AbortError')notify('تعذر مشاركة الملفات على هذا الجهاز')}});
function renderOrders(){$('orders').innerHTML=store.orders.length?store.orders.map(o=>`<div class="order"><b>${escapeHTML(o.code)}</b> · ${escapeHTML(o.name)} · ${o.total} ج.م<br>${escapeHTML(o.color)} · ${escapeHTML(o.size)} · ${o.qty} قطعة · محفوظ محليًا</div>`).join(''):'لا توجد طلبات محلية حتى الآن.'}
$('adminToggle').addEventListener('click',()=>{$('admin').classList.toggle('show');if($('admin').classList.contains('show'))$('admin').scrollIntoView({behavior:'smooth'})});
$('savePrice').addEventListener('click',()=>{store.price=Math.max(0,Number($('adminPrice').value)||650);store.discount=Math.max(0,Math.min(95,Number($('adminDiscount').value)||0));persist();renderPrice();notify('تم تحديث السعر محليًا في هذه التجربة')});
$('adminAddDesign').addEventListener('click',async()=>{const name=$('adminDesignName').value.trim(),file=$('adminDesignFile').files[0];if(!name||!file){notify('أدخل الاسم واختر ملف التصميم');return}if(file.size>2*1024*1024){notify('ملفات المعرض التجريبي أقل من 2 ميجا؛ التخزين السحابي يدعم أحجام أكبر');return}const src=await fileData(file);store.gallery.unshift({id:id(),name,src});persist();renderGallery();$('adminDesignName').value='';$('adminDesignFile').value='';notify('تمت الإضافة إلى معرض هذا المتصفح')});
// Initialize
renderAll();renderPrice();renderGallery();renderOrders();loadImages();
