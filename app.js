'use strict';
const ASSETS={front:'assets/hoodie-front.png',back:'assets/hoodie-back.png',left:'assets/hoodie-left.png',right:'assets/hoodie-right.png'};
// Photographic mockups for all colors. Olive continues using the original PNGs.
// Each color has real product photos for front, back and both side views.
const COLOR_SLUGS={'أبيض':'white','أسود':'black','برجندي':'burgundy','كحلي':'navy','رمادي':'gray','بيج':'beige','بني':'brown'};
const colorPhotoCache={};
const colorPhotoRequests={};
function realPhotoKey(colorName,targetView){return colorName+':'+targetView}
function realPhotoPath(colorName,targetView){return 'assets/hoodie-'+COLOR_SLUGS[colorName]+'-'+targetView+'.webp'}
function loadRealPhoto(colorName,targetView){
 if(colorName==='زيتي')return Promise.resolve(photoCache[targetView]||null);
 const key=realPhotoKey(colorName,targetView);
 if(colorPhotoCache[key])return Promise.resolve(colorPhotoCache[key]);
 if(colorPhotoRequests[key])return colorPhotoRequests[key];
 return colorPhotoRequests[key]=new Promise(resolve=>{
  const image=new Image();
  image.decoding='async';
  image.onload=()=>{
   delete colorPhotoRequests[key];
   colorPhotoCache[key]=image;
   resolve(image);
   if(color[0]===colorName&&view===targetView)drawBackground();
  };
  image.onerror=()=>{
   delete colorPhotoRequests[key]; // Allow retry instead of storing a failed request forever.
   resolve(null);
   if(color[0]===colorName&&view===targetView)drawBackground(true);
  };
  image.src=realPhotoPath(colorName,targetView);
 });
}
function prefetchSelectedColor(colorName,targetView=view){
 if(colorName==='زيتي')return;
 loadRealPhoto(colorName,targetView);
 for(const angle of Object.keys(ASSETS)){if(angle!==targetView)loadRealPhoto(colorName,angle)}
}

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
const printCanvas=$('printCanvas'),printCtx=printCanvas.getContext('2d');
function persist(){try{localStorage.setItem('teko-store-demo',JSON.stringify(store))}catch{notify('ذاكرة المتصفح امتلأت. المعرض الكبير يحتاج تخزين سحابي.')}}
function notify(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3500)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
function id(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
// V5: photo-calibrated approximation of printable parts (torso and sleeves).
// These guides are deliberately conservative; precise production calibration is still required.
const PRINT_SURFACES={
 front:[
  [[.25,.255],[.75,.255],[.77,.43],[.76,.79],[.24,.79],[.23,.44]],
  [[.17,.305],[.265,.335],[.287,.48],[.261,.68],[.266,.80],[.226,.844],[.119,.844],[.064,.786],[.065,.62],[.105,.43]],
  [[.83,.305],[.735,.335],[.713,.48],[.739,.68],[.734,.80],[.774,.844],[.881,.844],[.936,.786],[.935,.62],[.895,.43]]
 ],
 back:[
  [[.25,.265],[.75,.265],[.77,.43],[.76,.79],[.24,.79],[.23,.44]],
  [[.17,.305],[.265,.335],[.287,.48],[.261,.68],[.266,.80],[.226,.844],[.119,.844],[.064,.786],[.065,.62],[.105,.43]],
  [[.83,.305],[.735,.335],[.713,.48],[.739,.68],[.734,.80],[.774,.844],[.881,.844],[.936,.786],[.935,.62],[.895,.43]]
 ],
 left:[
  [[.435,.255],[.605,.275],[.658,.44],[.660,.63],[.613,.805],[.55,.848],[.44,.841],[.408,.748],[.419,.53]],
  [[.315,.36],[.422,.36],[.415,.53],[.408,.72],[.32,.73],[.284,.65]]
 ],
 right:[
  [[.395,.275],[.565,.255],[.581,.53],[.592,.748],[.56,.841],[.45,.848],[.387,.805],[.34,.63],[.342,.44]],
  [[.578,.36],[.685,.36],[.716,.65],[.68,.73],[.592,.72],[.585,.53]]
 ]
};
const areas={
 front:[
  {x:.284,y:.558,w:.433,h:.237,label:'الجيب الأمامي'},
  {x:.382,y:.208,w:.237,h:.051,label:'خياطة الرقبة'},
  {x:.240,y:.806,w:.520,h:.071,label:'حياكة أسفل الهودي'},
  {x:.090,y:.810,w:.170,h:.062,label:'كفة الكم'},
  {x:.740,y:.810,w:.170,h:.062,label:'كفة الكم'},
  {x:.158,y:.330,w:.124,h:.024,label:'خياطة الكتف'},
  {x:.718,y:.330,w:.124,h:.024,label:'خياطة الكتف'}
 ],
 back:[
  {x:.305,y:.080,w:.392,h:.201,label:'الكابيشو'},
  {x:.396,y:.277,w:.208,h:.067,label:'خياطة أسفل الكابيشو'},
  {x:.245,y:.807,w:.510,h:.070,label:'حياكة أسفل الهودي'},
  {x:.096,y:.811,w:.166,h:.063,label:'كفة الكم'},
  {x:.740,y:.811,w:.166,h:.063,label:'كفة الكم'}
 ],
 left:[
  {x:.403,y:.309,w:.257,h:.041,label:'خياطة أعلى الكم'},
  {x:.405,y:.822,w:.210,h:.071,label:'كفة الكم'},
  {x:.266,y:.558,w:.154,h:.196,label:'الجيب'}
 ],
 right:[
  {x:.338,y:.309,w:.259,h:.041,label:'خياطة أعلى الكم'},
  {x:.385,y:.822,w:.210,h:.071,label:'كفة الكم'},
  {x:.588,y:.558,w:.156,h:.196,label:'الجيب'}
 ]
};
function scaleW(){return .66/SIZES[size][0]}
function getBounds(d){const w=d.w*scaleW(),h=d.h*scaleW()*(1122/1402);return{x:d.x,y:d.y,w,h}}
function textSize(d,displayWidth){const b=getBounds(d),boxW=b.w*displayWidth,boxH=b.h*displayWidth*1402/1122,chars=Array.from(d.text||'A').length;return Math.max(8,Math.min(boxH*.74,boxW/Math.max(1,chars*.62)))}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function pointInPoly(x,y,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const xi=polygon[i][0],yi=polygon[i][1],xj=polygon[j][0],yj=polygon[j][1];
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}
function onPrintablePart(b,targetView){
 return PRINT_SURFACES[targetView].some(poly=>{
  // Check all corners plus intermediate points so the artwork cannot cross a curved edge.
  for(let ix=0;ix<=4;ix++)for(let iy=0;iy<=4;iy++){
   if(!pointInPoly(b.x+b.w*ix/4,b.y+b.h*iy/4,poly))return false;
  }
  return true;
 });
}
function violations(d){
 const b=getBounds(d);
 const result=areas[d.view].filter(zone=>overlaps(b,zone));
 if(!onPrintablePart(b,d.view))result.push({...b,label:'خارج القماش أو مساحة الطباعة المتاحة'});
 if(d.w>PRINT_LIMITS.width+.001||d.h>PRINT_LIMITS.height+.001)result.push({...b,label:'تجاوز مقاس الطباعة 40 × 45 سم'});
 return result;
}
function hasErrors(){return designs.some(d=>violations(d).length>0)}
function snapshot(){history.push(JSON.stringify(designs));if(history.length>40)history.shift();future=[]}
function current(){return designs.find(d=>d.id===selectedId)}
// Only use the uploaded photo for the chosen color and angle.
// Never fall back to olive recoloring or to a different color while an image loads.
function drawBackground(failed=false){
 const chosen=color[0]==='زيتي'?photoCache[view]:colorPhotoCache[realPhotoKey(color[0],view)];
 const loading=$('photoLoading');
 ctx.clearRect(0,0,1122,1402);
 printCtx.clearRect(0,0,1122,1402);
 if(!chosen){
  if(loading){
   loading.hidden=false;
   loading.textContent=failed
    ?'تعذر تحميل صورة '+color[0]+' — اختر اللون مرة أخرى لإعادة المحاولة'
    :'جاري تحميل صورة الهودي '+color[0]+'...';
  }
  $('photo').setAttribute('aria-busy',String(!failed));
  return;
 }
 ctx.drawImage(chosen,0,0,1122,1402);
 if(loading)loading.hidden=true;
 $('photo').setAttribute('aria-busy','false');
 scheduleInk();
}
// V6: composite print as part of the cloth, not as a flat DOM image.
const inkCache=new Map();
let inkScheduled=false;
function inkAsset(src){
 if(!src)return null;
 let cached=inkCache.get(src);
 if(!cached){
  const image=new Image();cached={image,loaded:false};inkCache.set(src,cached);
  image.onload=()=>{cached.loaded=true;scheduleInk()};
  image.onerror=()=>inkCache.delete(src);
  image.src=src;
 }
 return cached.loaded||cached.image.complete&&cached.image.naturalWidth?cached.image:null;
}
function artFor(d){
 const box=getBounds(d);
 const w=Math.max(4,Math.round(box.w*1122)),h=Math.max(4,Math.round(box.h*1402));
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const p=c.getContext('2d');
 if(d.kind==='image'){
  const im=inkAsset(d.src);if(!im)return null;
  p.drawImage(im,0,0,w,h);
 }else{
  p.fillStyle=d.color||'#ffffff';
  p.textAlign='center';p.textBaseline='middle';
  p.direction=/[\u0600-\u06FF]/.test(d.text||'')?'rtl':'ltr';
  p.font=(Number(d.fontWeight)||900)+' '+Math.round(textSize(d,1122)*(Number(d.fontScale)||1))+'px "'+(d.font||'Impact')+'",Arial,sans-serif';
  p.fillText(d.text||'',w*.5,h*.5,w*.97);
 }
 return c;
}
function drawInk(target,photo,targetView,quality){
 for(const d of designs.filter(item=>item.view===targetView)){
  const art=artFor(d);
  if(art)window.TEKO_FABRIC.print(target,photo,art,getBounds(d),quality);
 }
}
function paintInk(){
 printCtx.clearRect(0,0,1122,1402);
 if(!(color[0]==='زيتي'?photoCache[view]:colorPhotoCache[realPhotoKey(color[0],view)]))return;
 drawInk(printCtx,canvas,view,false);
}
function scheduleInk(){
 if(inkScheduled)return;inkScheduled=true;
 requestAnimationFrame(()=>{inkScheduled=false;paintInk()});
}
function hex(h){h=h.slice(1);return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function loadImages(){Object.entries(ASSETS).forEach(([v,path])=>{const im=new Image();im.onload=()=>{photoCache[v]=im;if(view===v)drawBackground()};im.onerror=()=>notify('تعذر تحميل زاوية الهودي: '+VIEW_NAMES[v]);
 // Inline original PNG bytes keep the canvas origin-clean even when index.html is opened via file://.
 im.src=(window.TEKO_HOODIE_IMAGES&&window.TEKO_HOODIE_IMAGES[v])||path;})}
function renderColors(){window.TEKO_DRAFT?.changed();$('colors').innerHTML=COLORS.map((c,i)=>`<button class="swatch ${color[0]===c[0]?'selected':''}" data-color="${i}"><i style="background:${c[1]}"></i>${c[0]}</button>`).join('')}
function renderSizes(){$('sizes').innerHTML=Object.keys(SIZES).map(s=>`<button class="chip ${s===size?'selected':''}" data-size="${s}">${s}</button>`).join('');let q=SIZES[size];$('sizeInfo').textContent=`عرض الصدر ${q[0]} سم · طول الهودي ${q[1]} سم · طول الكم ${q[2]} سم`}
function renderGallery(){$('gallery').innerHTML=store.gallery.map(g=>`<div class="gitem"><div class="gpreview">${g.src?`<img alt="" src="${g.src}">`:`<span>${escapeHTML(g.text||g.name)}</span>`}</div><button data-gallery="${escapeHTML(g.id)}">+ أضف ${escapeHTML(g.name)}</button></div>`).join('')}
function addDesign(d){
 snapshot();
 const aspect=Number(d.ratio)>0&&Number.isFinite(Number(d.ratio))?Number(d.ratio):1.5;
 const sleeve=view==='left'||view==='right',w=sleeve?11:15,h=Math.min(PRINT_LIMITS.height,w/aspect);
 const newItem={
  id:id(),view,kind:d.kind||'image',src:d.src||null,
  sourceName:d.sourceName||'تصميم',text:d.text||'',font:d.font||'Impact',fontWeight:Number(d.fontWeight)||900,fontScale:Number(d.fontScale)||1,color:d.color||'#ffffff',
  x:sleeve?.435:.425,y:sleeve?.415:.355,w,h,ratio:aspect,keepRatio:true
 };
 designs.push(newItem);
 selectedId=newItem.id;
 renderAll();
 notify('تمت إضافة التصميم؛ حرّكه بالسحب أو حدّد مقاسه بالسنتيمتر');
}
function renderDesigns(){
 window.TEKO_DRAFT?.changed();
 layer.innerHTML='';
 designs.filter(d=>d.view===view).forEach(d=>{
  const b=getBounds(d),el=document.createElement('div');
  el.className='design'+(selectedId===d.id&&showTools?' selected':'');
  el.dataset.id=d.id;
  el.setAttribute('aria-label','تحريك تصميم '+(d.sourceName||d.text||''));
  el.style.left=(b.x*100)+'%';el.style.top=(b.y*100)+'%';
  el.style.width=(b.w*100)+'%';el.style.height=(b.h*100)+'%';
  if(!showTools)el.style.pointerEvents='none';
  const handle=document.createElement('span');handle.className='resize';el.appendChild(handle);
  const remove=document.createElement('button');remove.type='button';remove.className='delete-design';
  remove.dataset.deleteId=d.id;remove.title='حذف العنصر';remove.textContent='×';
  remove.setAttribute('aria-label','حذف '+(d.sourceName||d.text||'التصميم'));
  el.appendChild(remove);layer.appendChild(el);
 });
 renderZones();renderEditTools();renderQuickDock();scheduleInk();
}
function renderZones(){
 const container=$('zones');container.innerHTML='';container.style.pointerEvents='none';
 const currentErrors=showTools?designs.filter(d=>d.view===view).flatMap(d=>violations(d)):[];
 const unique=new Set();
 for(const zone of currentErrors){
  const key=[zone.x,zone.y,zone.w,zone.h].map(v=>v.toFixed(3)).join('/');
  if(unique.has(key))continue;unique.add(key);
  const box=document.createElement('div');
  box.className='invalid-outline';
  box.title=zone.label;
  box.style.left=(zone.x*100)+'%';box.style.top=(zone.y*100)+'%';
  box.style.width=(zone.w*100)+'%';box.style.height=(zone.h*100)+'%';
  container.appendChild(box);
 }
 const invalidDesign=designs.find(d=>violations(d).length);
 const validation=$('validation');
 if(invalidDesign){
  const issue=violations(invalidDesign)[0];
  validation.className='notice danger';
  validation.textContent='⚠ '+VIEW_NAMES[invalidDesign.view]+' — '+issue.label+'. حرّك التصميم أو صغّره حتى يختفي الخط الأحمر، وبعدها تقدر تكمل الطلب.';
 }else{
  validation.className='notice';
  validation.textContent='اختار أي زاوية واسحب التصميم على القماش، بما في ذلك الأكمام. الجيب والخياطة والأطراف ممنوع الطباعة عليها؛ وقت التعارض يظهر خط أحمر.';
 }
 $('whatsappBtn').disabled=$('downloadBtn').disabled=Boolean(invalidDesign);
}
function renderEditTools(){
 const d=current(),selected=!!d,textSelected=!!d&&d.kind==='text';
 $('editTools').style.opacity=selected?'1':'.5';
 for(const name of ['designWidth','designHeight','removeSelected','lockRatio','duplicateSelected','bringFront','sendBack'])$(name).disabled=!selected;
 $('designWidth').value=selected?Number(d.w.toFixed(1)):'';
 $('designHeight').value=selected?Number(d.h.toFixed(1)):'';
 $('lockRatio').textContent=selected&&d.keepRatio===false?'🔓 تعديل حر':'🔒 تناسب الأبعاد';
 $('selectedLabel').textContent=selected?
  'المختار: '+(d.sourceName||d.text)+' — '+VIEW_NAMES[d.view]+' · '+d.w.toFixed(1)+' × '+d.h.toFixed(1)+' سم'
  :'اختار تصميمًا للتحكم فيه.';
 $('selectedTextTools').hidden=!textSelected;
 if(textSelected){
  $('selectedTextContent').value=d.text||'';
  $('selectedFont').value=d.font||'Impact';
  $('selectedTextColor').value=d.color||'#ffffff';
  $('selectedFontWeight').value=String(d.fontWeight||900);
  const percent=Math.round((Number(d.fontScale)||1)*100);
  $('selectedFontScale').value=String(percent);
  $('selectedFontScaleValue').textContent=percent+'%';
 }
 $('clearDesigns').disabled=designs.length===0;
}
function price(){return Math.round(store.price*(1-store.discount/100))}
function renderPrice(){$('unitPrice').textContent=price().toLocaleString('ar-EG')+' ج.م';$('originalPrice').textContent=store.discount>0?`بدلًا من ${store.price} جنيه · خصم ${store.discount}%`:'';$('adminPrice').value=store.price;$('adminDiscount').value=store.discount;renderSummary()}
function renderSummary(){const qty=Math.max(1,parseInt($('quantity').value)||1),amount=qty*price();$('summary').innerHTML=`<div><span>المنتج</span><b>هودي Oversize</b></div><div><span>اللون</span><b>${color[0]}</b></div><div><span>مقاس الهودي</span><b>${size}</b></div><div><span>الكمية</span><b>${qty}</b></div><div><span>عناصر الطباعة</span><b>${designs.length}</b></div><hr style="border:0;border-top:1px solid #e5e5e8"><div><span>الإجمالي قبل الشحن</span><b style="color:#d8172a;font-size:16px">${amount.toLocaleString('ar-EG')} ج.م</b></div>`}
function renderAll(){renderColors();renderSizes();renderDesigns();renderSummary();}
function selectView(v){view=v;selectedId=null;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===view));drawBackground();prefetchSelectedColor(color[0],v);renderDesigns()}
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
$('colors').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;color=COLORS[+b.dataset.color];renderColors();drawBackground();prefetchSelectedColor(color[0]);renderSummary()});
$('sizes').addEventListener('click',e=>{const b=e.target.closest('[data-size]');if(!b)return;size=b.dataset.size;renderSizes();renderDesigns();renderSummary()});
$('viewButtons').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)selectView(b.dataset.view)});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t===b));for(const name of ['Gallery','Upload','Text'])$('tab'+name).hidden=(name.toLowerCase()!==b.dataset.tab)}));
$('gallery').addEventListener('click',e=>{const b=e.target.closest('[data-gallery]');if(!b)return;const g=store.gallery.find(x=>x.id===b.dataset.gallery);if(g){if(g.src){loadAsset(g.src).then(im=>addDesign({kind:'image',src:g.src,sourceName:g.name,ratio:im.naturalWidth/im.naturalHeight})).catch(()=>notify('تعذر تحميل التصميم'))}else addDesign({kind:'text',text:g.text||g.name,font:'Impact',color:'#ffffff',sourceName:g.name})}});
function fileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}
$('uploadFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>6*1024*1024){notify('حجم الملف كبير. الحد التجريبي 6 ميجابايت');return}lastFile=f;const src=await fileData(f);try{const im=await loadAsset(src);addDesign({kind:'image',src,sourceName:f.name,ratio:im.naturalWidth/im.naturalHeight});}catch{notify('ملف الصورة غير صالح')}e.target.value=''});
$('addText').addEventListener('click',()=>{const text=$('textContent').value.trim();if(!text){notify('اكتب الجملة أولًا');return}addDesign({kind:'text',text,font:$('font').value,color:$('textColor').value,sourceName:'كتابة: '+text.slice(0,25)})});
$('designWidth').addEventListener('change',e=>applyMeasure('w',e.target.value));$('designHeight').addEventListener('change',e=>applyMeasure('h',e.target.value));
$('lockRatio').addEventListener('click',()=>{const d=current();if(!d)return;d.keepRatio=d.keepRatio===false;d.ratio=d.w/d.h;window.TEKO_DRAFT?.changed();$('lockRatio').textContent=d.keepRatio?'🔒 تناسب الأبعاد':'🔓 تعديل حر';notify(d.keepRatio?'تم قفل تناسب الأبعاد':'تم فتح تناسب الأبعاد')});
function deleteDesign(designId){
 if(!designs.some(d=>d.id===designId))return;
 snapshot();
 designs=designs.filter(d=>d.id!==designId);
 if(selectedId===designId)selectedId=null;
 renderAll();notify('تم حذف العنصر. يمكنك التراجع عن الحذف.');
}
$('removeSelected').addEventListener('click',()=>{if(current())deleteDesign(selectedId)});
layer.addEventListener('click',e=>{
 const button=e.target.closest('.delete-design');
 if(!button)return;
 e.preventDefault();e.stopPropagation();
 deleteDesign(button.dataset.deleteId);
});
$('duplicateSelected').addEventListener('click',()=>{
 const d=current();if(!d)return;
 snapshot();
 const copy={...d,id:id(),x:Math.min(.91,d.x+.025),y:Math.min(.91,d.y+.025)};
 designs.push(copy);selectedId=copy.id;renderAll();notify('تم نسخ العنصر');
});
$('bringFront').addEventListener('click',()=>{
 const d=current();if(!d)return;
 const index=designs.indexOf(d);
 if(index===designs.length-1)return;
 snapshot();designs.splice(index,1);designs.push(d);renderAll();
});
$('sendBack').addEventListener('click',()=>{
 const d=current();if(!d)return;
 const index=designs.indexOf(d);
 if(index===0)return;
 snapshot();designs.splice(index,1);designs.unshift(d);renderAll();
});
$('clearDesigns').addEventListener('click',()=>{
 if(!designs.length)return;
 if(!window.confirm('مسح كل التصميمات والكتابة من زوايا الهودي الأربع؟ تقدر تتراجع بعد المسح.'))return;
 snapshot();designs=[];selectedId=null;renderAll();notify('تم مسح التصميمات كلها. التراجع متاح.');
});
// Only the selected text is edited. Newly added text continues to use the text tab defaults.
let editSession=null;
function applyTextSetting(prop,value){
 const d=current();if(!d||d.kind!=='text')return;
 if(prop==='text'&&!(value||'').trim())return;
 const key=d.id+':'+prop;
 if(editSession!==key){snapshot();editSession=key}
 d[prop]=value;
 if(prop==='text')d.sourceName='كتابة: '+value.slice(0,25);
 if(prop==='font'){$('selectedFont').value=value;$('font').value=value}
 if(prop==='color'){$('selectedTextColor').value=value;$('textColor').value=value}
 if(prop==='fontScale'){$('selectedFontScaleValue').textContent=Math.round(value*100)+'%'}
 if(prop==='text')$('selectedLabel').textContent='المختار: '+d.sourceName+' — '+VIEW_NAMES[d.view];
 scheduleInk();window.TEKO_DRAFT?.changed();
}
function bindTextInput(id,property,convert){
 const element=$(id);
 element.addEventListener('input',e=>applyTextSetting(property,convert?convert(e.target.value):e.target.value));
 element.addEventListener('change',()=>{editSession=null});
 element.addEventListener('blur',()=>{editSession=null});
}
bindTextInput('selectedTextContent','text');
bindTextInput('selectedFont','font');
bindTextInput('font','font');
bindTextInput('selectedTextColor','color');
bindTextInput('textColor','color');
bindTextInput('selectedFontWeight','fontWeight',value=>Number(value));
bindTextInput('selectedFontScale','fontScale',value=>Number(value)/100);
if(document.fonts)document.fonts.ready.then(scheduleInk).catch(()=>{});
$('undoBtn').addEventListener('click',()=>{if(!history.length)return;future.push(JSON.stringify(designs));designs=JSON.parse(history.pop());selectedId=null;renderAll()});$('redoBtn').addEventListener('click',()=>{if(!future.length)return;history.push(JSON.stringify(designs));designs=JSON.parse(future.pop());selectedId=null;renderAll()});
function toggleCleanPreview(){
 showTools=!showTools;
 selectedId=null;
 $('previewBtn').textContent=showTools?'معاينة نهائية بدون إطار':'إظهار أدوات التحديد';
 const quick=$('cleanPreviewBtn');
 if(quick)quick.textContent=showTools?'معاينة بدون إطار':'العودة للتعديل';
 renderDesigns();
}
$('previewBtn').addEventListener('click',toggleCleanPreview);
if($('cleanPreviewBtn'))$('cleanPreviewBtn').addEventListener('click',toggleCleanPreview);
$('quantity').addEventListener('input',()=>{renderSummary();window.TEKO_DRAFT?.changed()});
// V9: compact three-dot menu follows the selected object without replacing the full side controls.
let quickMenuOpen=false,quickMenuSelected=null;
function positionQuickDock(){
 const d=current(),dock=$('quickDesignDock'),menu=$('quickDesignMenu');
 if(!d||dock.hidden)return;
 const w=layer.clientWidth,h=layer.clientHeight;
 if(!w||!h)return;
 const box=getBounds(d);
 const x=Math.max(22,Math.min(w-22,(box.x+box.w/2)*w));
 const end=(box.y+box.h)*h+9;
 const y=end<=h-43?end:Math.max(8,box.y*h-44);
 dock.style.left=x+'px';dock.style.top=y+'px';
 if(quickMenuOpen&&!menu.hidden){
  const width=Math.min(236,Math.max(135,w-16));
  menu.style.width=width+'px';
  const globalX=Math.max(8,Math.min(w-width-8,x-width/2));
  menu.style.left=(globalX-x)+'px';
  const height=menu.getBoundingClientRect().height;
  menu.style.top=(h-y>=height+46?44:-(height+8))+'px';
 }
}
function renderQuickDock(){
 const d=current(),dock=$('quickDesignDock'),menu=$('quickDesignMenu'),toggle=$('quickDesignToggle');
 if(!d||d.view!==view||!showTools){
  quickMenuOpen=false;quickMenuSelected=null;dock.hidden=true;menu.hidden=true;return;
 }
 if(quickMenuSelected!==d.id){quickMenuSelected=d.id;quickMenuOpen=false;}
 dock.hidden=false;toggle.setAttribute('aria-expanded',String(quickMenuOpen));
 menu.hidden=!quickMenuOpen;
 if(quickMenuOpen){
  menu.innerHTML='<div class="quick-design-heading">إعدادات التصميم</div>'+
   '<div class="quick-design-actions">'+
   '<button class="quick-action" type="button" data-quick="duplicate">⧉ تكرار</button>'+
   '<button class="quick-action" type="button" data-quick="ratio">'+(d.keepRatio===false?'🔓 قفل التناسب':'🔒 فتح التناسب')+'</button>'+
   '<button class="quick-action" type="button" data-quick="front">↑ للأمام</button>'+
   '<button class="quick-action" type="button" data-quick="back">↓ للخلف</button>'+
   '</div>'+
   '<div class="quick-dimensions">'+
   '<label>العرض (سم)<input aria-label="عرض التصميم بالسنتيمتر" data-quick-dim="w" type="number" step="0.5" min="2" max="40" value="'+d.w.toFixed(1)+'"></label>'+
   '<label>الارتفاع (سم)<input aria-label="ارتفاع التصميم بالسنتيمتر" data-quick-dim="h" type="number" step="0.5" min="2" max="45" value="'+d.h.toFixed(1)+'"></label>'+
   '</div>'+
   (d.kind==='text'?'<div class="quick-design-sep"></div><button class="quick-action" type="button" data-quick="text" style="width:100%">✎ تعديل العبارة والخط</button>':'')+
   '<div class="quick-design-sep"></div>'+
   '<div class="quick-design-actions">'+
   '<button class="quick-action quick-danger" type="button" data-quick="delete">× حذف العنصر</button>'+
   '<button class="quick-action quick-danger" type="button" data-quick="clear">مسح كل التصميمات</button>'+
   '</div>';
 }else menu.innerHTML='';
 positionQuickDock();
}
function closeQuickMenu(){
 if(!quickMenuOpen)return;
 quickMenuOpen=false;
 renderQuickDock();
}
$('quickDesignToggle').addEventListener('click',e=>{
 e.preventDefault();e.stopPropagation();
 quickMenuOpen=!quickMenuOpen;renderQuickDock();
});
$('quickDesignMenu').addEventListener('click',e=>{
 const btn=e.target.closest('[data-quick]');if(!btn)return;
 e.preventDefault();e.stopPropagation();
 const action=btn.dataset.quick;
 const d=current();if(!d)return;
 if(action==='text'){
  closeQuickMenu();
  $('selectedTextTools').scrollIntoView({behavior:'smooth',block:'center'});
  $('selectedTextContent').focus({preventScroll:true});
  return;
 }
 closeQuickMenu();
 const mapped={duplicate:'duplicateSelected',ratio:'lockRatio',front:'bringFront',back:'sendBack',delete:'removeSelected',clear:'clearDesigns'};
 if(mapped[action])$(mapped[action]).click();
 renderQuickDock();
});
$('quickDesignMenu').addEventListener('change',e=>{
 const input=e.target.closest('[data-quick-dim]');if(!input)return;
 const axis=input.dataset.quickDim;
 if(axis!=='w'&&axis!=='h')return;
 const number=Number(input.value);
 if(!Number.isFinite(number)||number<2){renderQuickDock();return;}
 applyMeasure(axis,number);
});
document.addEventListener('pointerdown',e=>{
 if(quickMenuOpen&&!e.target.closest('#quickDesignDock'))closeQuickMenu();
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&quickMenuOpen){closeQuickMenu();$('quickDesignToggle').focus();}
});
window.addEventListener('resize',positionQuickDock);
// Drag to position; resize from the lower-right corner. Both stay in real-centimeter units.
layer.addEventListener('pointerdown',e=>{
 if(e.target.closest('.delete-design'))return;
 const el=e.target.closest('.design');if(!showTools)return;
 if(!el){if(selectedId){selectedId=null;renderDesigns();}return;}
 const d=designs.find(x=>x.id===el.dataset.id);if(!d)return;
 closeQuickMenu();
 e.preventDefault();
 const mode=e.target.classList.contains('resize')?'resize':'move';
 if(selectedId!==d.id){selectedId=d.id;renderDesigns()}
 snapshot();
 dragging={id:d.id,mode,startX:e.clientX,startY:e.clientY,x:d.x,y:d.y,w:d.w,h:d.h,ratio:d.ratio};
});
window.addEventListener('pointermove',e=>{
 if(!dragging)return;
 const d=designs.find(x=>x.id===dragging.id);if(!d)return;
 e.preventDefault();
 const rect=layer.getBoundingClientRect();
 const dx=(e.clientX-dragging.startX)/rect.width,dy=(e.clientY-dragging.startY)/rect.height;
 if(dragging.mode==='move'){
  d.x=Math.max(-.12,Math.min(1.08,dragging.x+dx));
  d.y=Math.max(-.12,Math.min(1.08,dragging.y+dy));
 }else{
  const cmX=dx/scaleW(),cmY=dy/(scaleW()*1122/1402);
  let w,h;
  if(d.keepRatio===false){w=dragging.w+cmX;h=dragging.h+cmY}
  else{
   const change=Math.abs(cmX)>=Math.abs(cmY*d.ratio)?cmX:cmY*d.ratio;
   w=dragging.w+change;h=w/dragging.ratio;
  }
  const measured=clampPrintSize(d,Math.max(2,w),Math.max(2,h));
  d.w=measured.w;d.h=measured.h;
 }
 const el=layer.querySelector('[data-id="'+d.id+'"]');
 if(el){
  const b=getBounds(d);
  el.style.left=(b.x*100)+'%';el.style.top=(b.y*100)+'%';
  el.style.width=(b.w*100)+'%';el.style.height=(b.h*100)+'%';
  scheduleInk();
 }
 renderZones();renderEditTools();renderSummary();positionQuickDock();
});
function finishPointer(){if(dragging){dragging=null;renderDesigns()}}
window.addEventListener('pointerup',finishPointer);
window.addEventListener('pointercancel',finishPointer);
// Export actual source image + graphics via canvas (no HTML capture dependency).
// Export without mutating global view: preview and saved PNG remain on the correct angle.
async function makePreview(targetView=view){
 const im=color[0]==='زيتي'?photoCache[targetView]:await loadRealPhoto(color[0],targetView);
 if(!im)throw new Error('صورة اللون لم تُحمّل بعد');
 for(const d of designs.filter(x=>x.view===targetView&&x.kind==='image')){
  if(!inkAsset(d.src))await loadAsset(d.src);
 }
 const photo=document.createElement('canvas');photo.width=1122;photo.height=1402;
 const base=photo.getContext('2d');base.drawImage(im,0,0,1122,1402);
 const exportCanvas=document.createElement('canvas');exportCanvas.width=1122;exportCanvas.height=1402;
 const p=exportCanvas.getContext('2d');p.drawImage(photo,0,0);
 drawInk(p,photo,targetView,true);
 return new Promise((resolve,reject)=>exportCanvas.toBlob(blob=>blob?resolve(blob):reject(Error('Export failed')),'image/png'));
}
function loadAsset(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();const url=a.href;setTimeout(()=>URL.revokeObjectURL(url),60000)}
$('exportBtn').addEventListener('click',async()=>{try{const blob=await makePreview();saveBlob(blob,'TEKO-hoodie-'+view+'.png');notify('تم تجهيز معاينة PNG للتنزيل')}catch{notify('المعاينة غير جاهزة بعد')}});
// The artwork original is distinct from the rendered mockup: never flatten the source.
const ART_EXT={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','image/svg+xml':'.svg','image/avif':'.avif'};
function originalFilename(label,mime,index){
 const type=(mime||'').split(';')[0].toLowerCase(),ext=ART_EXT[type]||'.png';
 let name=cleanFilename(label||'design');
 if(/\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(name)){
  const supplied=name.match(/\.[^.]+$/)[0].toLowerCase();
  if(supplied!==ext&&!(type==='image/jpeg'&&supplied==='.jpeg'))name=name.replace(/\.[^.]+$/,ext);
 }else name+=ext;
 return String(index).padStart(2,'0')+'-'+name;
}
async function collectOriginalArtworks(){
 const originals=[],seen=new Set();
 for(let i=0;i<designs.length;i++){
  const d=designs[i];
  if(d.kind==='image'&&d.src){
   if(seen.has(d.src))continue;
   seen.add(d.src);
   let response,blob;
   try{response=await fetch(d.src);if(!response.ok)throw Error('فشل');blob=await response.blob()}
   catch{throw new Error('تعذر قراءة الملف الأصلي '+(d.sourceName||'تصميم'))}
   originals.push({name:originalFilename(d.sourceName,blob.type,i+1),blob});
  }else if(d.kind==='text'){
   // Custom text has no uploaded file; rasterize on a transparent PNG canvas.
   if(document.fonts){try{await document.fonts.load((d.fontWeight||900)+' 28px "'+(d.font||'Impact')+'"')}catch{}}
   const art=artFor(d);
   if(!art)throw new Error('تعذر تجهيز الكتابة');
   const blob=await new Promise((resolve,reject)=>art.toBlob(x=>x?resolve(x):reject(Error('فشل تصدير الكتابة')),'image/png'));
   originals.push({name:String(i+1).padStart(2,'0')+'-text-transparent.png',blob});
  }
 }
 return originals;
}
async function collectFiles(){
 const files=[],views=[...new Set(designs.map(d=>d.view))];
 for(const v of (views.length?views:[view])){
  const blob=await makePreview(v);
  files.push(new File([blob],'TEKO-mockup-'+v+'.png',{type:'image/png'}));
 }
 const originals=await collectOriginalArtworks();
 for(const original of originals){
  files.push(new File([original.blob],'ORIGINAL-'+original.name,{type:original.blob.type||'application/octet-stream'}));
 }
 return files;
}
$('downloadOriginalsBtn').addEventListener('click',async()=>{
 if(!designs.length){notify('أضف تصميم أو كتابة أولًا');return}
 const button=$('downloadOriginalsBtn'),label=button.textContent;button.disabled=true;button.textContent='جاري تجهيز الأصول...';
 try{
  const files=await collectOriginalArtworks();
  if(files.length===1)saveBlob(files[0].blob,files[0].name);
  else if(files.length>1)saveBlob(await window.TEKO_PACKAGE.bundle(files),'TEKO-ORIGINAL-ARTWORK.zip');
  else{notify('لا توجد تصميمات أصلية');return}
  notify('تم تنزيل التصميمات الأصلية بدون إضافة خلفية بيضاء');
 }catch(e){notify('تعذر تجهيز التصميمات الأصلية: '+(e.message||'خطأ'))}
 finally{button.disabled=false;button.textContent=label}
});
$('downloadBtn').addEventListener('click',async()=>{if(hasErrors()){notify('صحح مكان التصميم أولًا');return}try{const files=await collectFiles();files.forEach((f,i)=>setTimeout(()=>saveBlob(f,f.name),150*i));notify('الملفات جاهزة للتنزيل؛ اسمح بتنزيل الملفات المتعددة لو طلب المتصفح')}catch{notify('تعذر تجهيز الملفات')}});
// V10: preview all four angles and package mockups, original art and a production sheet.
const REVIEW_VIEWS=['front','back','left','right'];
let orderDraftCode=null,packageBusy=false,reviewGeneration=0;
let reviewUrls=[];
const orderCode=()=>orderDraftCode||(orderDraftCode='TK-'+Date.now().toString().slice(-8));
function cleanFilename(str){
 return String(str||'artwork').replace(/[\\/:*?"<>|\x00-\x1F]/g,'_').replace(/^\.+/,'').slice(0,78)||'artwork';
}
function orderObject(code){
 const quantity=Math.max(1,parseInt($('quantity').value)||1);
 return {
  code,created:new Date().toISOString(),
  customer:{name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),address:$('address').value.trim(),notes:$('notes').value.trim()},
  item:{name:'Oversize Hoodie',color:color[0],size,quantity,unitPrice:price(),basePrice:store.price,discountPercent:store.discount,totalBeforeShipping:quantity*price()},
  print:{maxWidthCm:40,maxHeightCm:45,warning:'Preview measurements and printable areas are approximate and must be confirmed for production.'},
  designs:designs.map((d,index)=>({
   number:index+1,view:d.view,viewArabic:VIEW_NAMES[d.view],kind:d.kind,
   name:d.sourceName||null,text:d.kind==='text'?d.text:null,font:d.kind==='text'?d.font:null,
   fontWeight:d.kind==='text'?(d.fontWeight||900):null,
   fontScale:d.kind==='text'?(d.fontScale||1):null,color:d.kind==='text'?d.color:null,
   widthCm:Number(d.w.toFixed(2)),heightCm:Number(d.h.toFixed(2)),
   relativePosition:{x:Number(d.x.toFixed(5)),y:Number(d.y.toFixed(5))}
  }))
 };
}
function orderSheetText(code){
 const data=orderObject(code);
 const lines=[
  'TEKO STORE | ملخص طلب الطباعة', 'رقم الطلب: '+code,
  'التاريخ: '+new Date(data.created).toLocaleString('ar-EG'),
  'العميل: '+(data.customer.name||'لم يكتب'),
  'الموبايل: '+(data.customer.phone||'لم يكتب'),
  'عنوان الاستلام: '+(data.customer.address||'غير محدد'),
  'اللون: '+data.item.color,
  'مقاس الهودي: '+data.item.size,
  'الكمية: '+data.item.quantity,
  'سعر القطعة: '+data.item.unitPrice+' جنيه',
  'الإجمالي قبل الشحن: '+data.item.totalBeforeShipping+' جنيه',
  'ملاحظات العميل: '+(data.customer.notes||'لا يوجد'),
  '', 'تفاصيل التصميمات:'
 ];
 for(const d of data.designs){
  lines.push(d.number+') '+d.viewArabic+' | '+(d.kind==='text'?'نص: '+d.text:'ملف: '+d.name)+
    ' | '+d.widthCm+' × '+d.heightCm+' سم'+
    (d.kind==='text'?' | خط: '+d.font+' | لون: '+d.color:'')+
    ' | X: '+(d.relativePosition.x*100).toFixed(1)+'% Y: '+(d.relativePosition.y*100).toFixed(1)+'%');
 }
 if(!data.designs.length)lines.push('بدون طباعة');
 lines.push('', 'تنبيه: مساحات الطباعة المعروضة تقريبية ويجب تأكيدها قبل الإنتاج.',
  'الملفات الأصلية داخل artwork-original تحفظ شفافية PNG أو الخلفية الأصلية دون تعديل.',
  'أرفق ZIP على واتساب كمستند Document وليس صورة من المعرض.',
  'هذه الحزمة تم تجهيزها محليًا ولم يتم إرسالها تلقائيًا إلى واتساب.');
 return '\ufeff'+lines.join('\r\n');
}
async function buildOrderPackage(code){
 const pack=[];
 const chosen=color[0];
 for(const v of REVIEW_VIEWS){
  const mockup=await makePreview(v);
  pack.push({name:'mockups/TEKO-'+v+'.png',blob:mockup});
 }
 const originals=await collectOriginalArtworks();
 for(const original of originals){
  pack.push({name:'artwork-original/'+original.name,blob:original.blob});
 }
 pack.push({name:'order/README-ar.txt',blob:new Blob([orderSheetText(code)],{type:'text/plain;charset=utf-8'})});
 pack.push({name:'order/details.json',blob:new Blob([JSON.stringify(orderObject(code),null,2)],{type:'application/json'})});
 return window.TEKO_PACKAGE.bundle(pack);
}
async function saveOrderPackage(){
 if(hasErrors()){notify('صحح مكان الطباعة الممنوع أولًا');return;}
 if(packageBusy)return;
 packageBusy=true;
 const buttons=[$('downloadPackageBtn'),$('reviewDownload')];
 buttons.forEach(b=>{b.disabled=true;b.dataset.oldLabel=b.textContent;b.textContent='جاري تجهيز ملف الطلب...'});
 $('reviewStatus').textContent='جاري تجهيز الصور الأربع والملفات الأصلية. لا تقفل الصفحة أثناء تجهيز الملف.';
 try{
  const code=orderCode();
  const zip=await buildOrderPackage(code);
  saveBlob(zip,'TEKO-ORDER-'+code+'.zip');
  $('reviewStatus').textContent='تم تجهيز الملف. أرسل ZIP على واتساب كمستند Document، وليس صورة، للحفاظ على شفافية PNG.';
  notify('تم تجهيز ملف الطلب '+code+' للتحميل');
 }catch(error){
  $('reviewStatus').textContent='تعذر تجهيز الملف: '+error.message;
  notify('تعذر تجهيز ملف ZIP: '+error.message);
 }finally{
  buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.oldLabel});
  packageBusy=false;
 }
}
$('downloadPackageBtn').addEventListener('click',saveOrderPackage);
$('reviewDownload').addEventListener('click',saveOrderPackage);
const reviewModal=$('reviewModal');
let reviewFocus=null;
function closeReview(){
 reviewGeneration++;
 reviewModal.hidden=true;
 for(const u of reviewUrls)URL.revokeObjectURL(u);
 reviewUrls=[];
 if(reviewFocus&&document.contains(reviewFocus))reviewFocus.focus();
}
function renderReviewFacts(){
 const facts=[
  ['اللون',color[0]],['مقاس الهودي',size],['الكمية',String(Math.max(1,parseInt($('quantity').value)||1))],
  ['إجمالي الطلب قبل الشحن',(Math.max(1,parseInt($('quantity').value)||1)*price()).toLocaleString('ar-EG')+' ج.م']
 ];
 const factsWrap=$('reviewFacts');factsWrap.replaceChildren();
 for(const [title,value] of facts){
  const cell=document.createElement('div');cell.className='review-fact';
  const small=document.createElement('span');small.textContent=title;
  const bold=document.createElement('b');bold.textContent=value;
  cell.append(small,bold);factsWrap.append(cell);
 }
 $('reviewDetails').textContent=orderSheetText(orderCode()).replace(/^\ufeff/,'');
}
async function openOrderReview(){
 if(hasErrors()){notify('صحح منطقة الطباعة أولًا لمراجعة الموكاب');return;}
 reviewFocus=document.activeElement;
 reviewModal.hidden=false;
 $('reviewClose').focus();
 renderReviewFacts();
 const token=++reviewGeneration;
 const row=$('reviewPhotos');row.replaceChildren();
 $('reviewStatus').textContent='جاري تجهيز معاينات الأربع زوايا...';
 for(const v of REVIEW_VIEWS){
  const card=document.createElement('div');card.className='review-photo';
  const image=document.createElement('img');image.alt='معاينة الهودي — '+VIEW_NAMES[v];
  image.loading='lazy';
  const caption=document.createElement('b');caption.textContent=VIEW_NAMES[v];
  card.append(image,caption);row.append(card);
  try{
   const blob=await makePreview(v);
   if(token!==reviewGeneration){return}
   const url=URL.createObjectURL(blob);reviewUrls.push(url);image.src=url;
  }catch(error){
   caption.textContent=VIEW_NAMES[v]+' — المعاينة غير متاحة';
  }
 }
 if(token===reviewGeneration)$('reviewStatus').textContent='الموكابات تُظهر الهودي بخلفيته، بينما ملفات artwork-original تحفظ صور التصميمات كما رفعها العميل. أرسل ZIP كمستند.';
}
$('reviewOrderBtn').addEventListener('click',openOrderReview);
$('reviewClose').addEventListener('click',closeReview);
reviewModal.addEventListener('click',e=>{if(e.target===reviewModal)closeReview()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!reviewModal.hidden)closeReview()});
$('reviewWhatsapp').addEventListener('click',()=>{closeReview();$('whatsappBtn').click()});

function orderMessage(code, downloadUrl=''){
 const qty=Math.max(1,parseInt($('quantity').value)||1);
 const artwork=designs.map((d,i)=>(
  (i+1)+'. '+VIEW_NAMES[d.view]+' — '+(d.kind==='text'?'عبارة: '+d.text:'تصميم: '+d.sourceName)+
  ' — عرض '+(+d.w).toFixed(1)+' سم × ارتفاع '+(+d.h).toFixed(1)+' سم'+
  ' — الموضع النسبي ('+(d.x*100).toFixed(1)+'%, '+(d.y*100).toFixed(1)+'%)'+
  (d.kind==='text'?' — الخط '+d.font+' — اللون '+d.color:'')
 )).join('\n')||'بدون طباعة';
 const attachment=downloadUrl
  ?'\n\n📦 رابط تحميل ملف الطلب ZIP (يشمل الصور الأصلية والموكابات والمقاسات):\n'+downloadUrl+
   '\nالرابط مؤقت ومخصص لهذا الطلب؛ لا تشاركه خارج فريق المتجر.'
   : '\n\n📎 ملف الطلب: TEKO-ORDER-'+code+'.zip\nأرفق ZIP كمستند (Document) مع الطلب حتى تظل ملفات PNG شفافة.';
 return '🛍️ طلب جديد — TEKO STORE\n'+
  'رقم الطلب: '+code+'\n'+
  'العميل: '+($('customerName').value.trim()||'غير محدد')+'\n'+
  'هاتف: '+($('customerPhone').value.trim()||'غير محدد')+'\n'+
  'المنتج: Oversize Hoodie\n'+
  'اللون: '+color[0]+'\nالمقاس: '+size+'\nالكمية: '+qty+'\n'+
  'سعر القطعة: '+price()+' جنيه'+(store.discount?' (خصم '+store.discount+'%)':'')+'\n'+
  'الإجمالي قبل الشحن: '+qty*price()+' جنيه\n\n'+
  'تفاصيل الطباعة:\n'+artwork+'\n\n'+
  'العنوان: '+($('address').value.trim()||'لم يُحدد')+'\n'+
  'الملاحظات: '+($('notes').value.trim()||'لا يوجد')+attachment;
}
function validateOrder(){if(hasErrors()){notify('ممنوع تأكيد طلب داخل منطقة الطباعة المحظورة');return false}if(!$('customerName').value.trim()){notify('اكتب اسم العميل أولًا');$('customerName').focus();return false}if(!/^01\d{9}$/.test($('customerPhone').value.trim())){notify('اكتب رقم موبايل مصري صحيح (11 رقم)');$('customerPhone').focus();return false}return true}
function recordOrder(code){
 const item={code,date:new Date().toISOString(),name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),qty:Math.max(1,+$('quantity').value||1),color:color[0],size,total:price()*Math.max(1,+$('quantity').value||1),views:[...new Set(designs.map(d=>d.view))]};
 const found=store.orders.findIndex(o=>o.code===code);
 if(found>=0)store.orders[found]=item;else store.orders.unshift(item);
 persist();renderOrders();
}
// V13: upload ZIP first; add a real signed download URL to the owner WhatsApp message.
const ORDER_CLOUD=window.TEKO_CLOUD||{};
const CLOUD_URL=String(ORDER_CLOUD.functionUrl||ORDER_CLOUD.workerUrl||'').replace(/\/+$/,'');
const CLOUD_ACTIVE=(()=>{
 try{
  const url=new URL(CLOUD_URL);
  const preview=ORDER_CLOUD.previewEnabled===true&&new URLSearchParams(window.location.search).get('tekoCloudTest')==='1';
  return (ORDER_CLOUD.enabled===true||preview)&&url.protocol==='https:'&&!!ORDER_CLOUD.turnstileSiteKey;
 }catch{return false}
})();
let turnstileToken=null,turnstileWidget=null,cloudUploading=false;
function cloudMessage(text){
 const el=$('cloudStatus');
 if(el){el.textContent=text;if(CLOUD_ACTIVE)el.hidden=false}
}
function refreshChallenge(){
 turnstileToken=null;
 if(window.turnstile&&turnstileWidget!==null){
  try{window.turnstile.reset(turnstileWidget)}catch{}
 }
}
function setupOrderCloud(){
 if(!CLOUD_ACTIVE){
  cloudMessage('التخزين السحابي لم يُفعّل بعد؛ يتم تنزيل ZIP وإرفاقه كمستند.');
  return;
 }
 $('cloudSecurity').hidden=false;
 const notice=$('cloudNotice');
 if(notice)notice.innerHTML='بعد الضغط على الزر، سيتم رفع ملف الطلب ZIP لمساحة تخزين خاصة وإضافة <b>رابط تحميل آمن إلى رسالة واتساب</b>. الرابط صالح لمدة 7 أيام. اضغط إرسال داخل واتساب لإتمام الطلب.';
 cloudMessage('أكمل التحقق الأمني لرفع ملف ZIP وتوليد رابط التحميل.');
 const script=document.createElement('script');
 script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 script.async=true;
 script.onload=()=>{
  if(!window.turnstile){cloudMessage('تعذر تحميل التحقق الأمني. جرّب تحديث الصفحة أو تعطيل مانع الإعلانات.');return}
  try{
   turnstileWidget=window.turnstile.render('#cloudTurnstile',{
    sitekey:ORDER_CLOUD.turnstileSiteKey,
    callback(token){turnstileToken=token;cloudMessage('✓ التحقق جاهز. اضغط تجهيز ومشاركة الطلب للرفع على Supabase.')},
    'expired-callback'(){turnstileToken=null;cloudMessage('انتهت صلاحية التحقق؛ أكمله مرة أخرى.')},
    'error-callback'(){turnstileToken=null;cloudMessage('تعذر التحقق الأمني؛ حاول مرة أخرى.')}
   });
  }catch(error){cloudMessage('تعذر إعداد التحقق الأمني: '+(error.message||'خطأ'))}
 };
 script.onerror=()=>cloudMessage('تعذر تحميل خدمة التحقق الأمني. راجع الاتصال بالإنترنت.');
 document.head.appendChild(script);
}
async function supabaseAction(action,body){
 const response=await fetch(CLOUD_URL,{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action,...body}),
  cache:'no-store'
 });
 let data;
 try{data=await response.json()}catch{throw new Error('خدمة التخزين أرجعت رد غير صالح.')}
 if(!response.ok)throw new Error(data.error||'تعذر التواصل مع تخزين Supabase');
 return data;
}
async function uploadZipForSupabase(code){
 const zip=await buildOrderPackage(code);
 const maxBytes=40*1024*1024;
 if(zip.size>maxBytes)throw new Error('ملف الطلب أكبر من 40 ميجابايت؛ قلّل الصور قبل الإرسال.');
 cloudMessage('جاري تجهيز رابط رفع آمن من Supabase...');
 const request=await supabaseAction('init',{size:zip.size,turnstileToken});
 const expectedOrigin=new URL(ORDER_CLOUD.supabaseOrigin).origin;
 const upload=new URL(request.uploadUrl||'');
 if(upload.protocol!=='https:'||upload.origin!==expectedOrigin||
    !upload.pathname.startsWith('/storage/v1/object/upload/sign/teko-orders/orders/')||
    !upload.searchParams.get('token')||
    typeof request.path!=='string'||!/^orders\/[a-f0-9-]{36}\.zip$/.test(request.path)||
    Number(request.size)!==zip.size||!request.proof||!request.expires){
  throw new Error('خدمة التخزين أرجعت بيانات رفع غير صالحة.');
 }
 cloudMessage('جاري رفع ملف ZIP إلى التخزين الخاص...');
 const uploaded=await fetch(upload.toString(),{
  method:'PUT',
  headers:{'Content-Type':'application/zip'},
  body:zip
 });
 if(!uploaded.ok){
  let message='';
  try{const body=await uploaded.json();message=body.message||body.error||''}catch{}
  throw new Error('فشل رفع ZIP: '+(message||'التحقق من صلاحيات التخزين مطلوب.'));
 }
 cloudMessage('تم رفع الملف، جاري إصدار رابط التحميل...');
 const result=await supabaseAction('finish',{
  path:request.path,size:zip.size,expires:request.expires,proof:request.proof
 });
 const link=new URL(result.downloadUrl||'');
 if(link.protocol!=='https:'||link.origin!==expectedOrigin||
    !link.pathname.startsWith('/storage/v1/object/sign/teko-orders/orders/')||
    !link.searchParams.get('token')){
  throw new Error('تم الرفع، لكن رابط التنزيل غير صالح. لا تُرسل الطلب قبل معالجة الخطأ.');
 }
 return link.toString();
}
async function uploadZipForOrder(code){
 if(ORDER_CLOUD.provider==='supabase')return uploadZipForSupabase(code);
 // Legacy Cloudflare Worker path remains available only when explicitly configured.
 const zip=await buildOrderPackage(code);
 if(zip.size>20*1024*1024)throw new Error('ملف الطلب أكبر من 20 ميجابايت.');
 cloudMessage('جاري رفع ملف ZIP...');
 const response=await fetch(CLOUD_URL+'/upload',{
  method:'POST',headers:{'Content-Type':'application/zip','X-TEKO-Turnstile':turnstileToken},body:zip
 });
 let data;
 try{data=await response.json()}catch{throw new Error('الرد من التخزين غير صالح')}
 if(!response.ok)throw new Error(data.error||'تعذر رفع الملف');
 const link=new URL(data.downloadUrl||'');
 if(link.protocol!=='https:'||link.origin!==new URL(CLOUD_URL).origin||
    !link.pathname.startsWith('/download/'))throw new Error('رابط تحميل غير صالح');
 return link.toString();
}
$('whatsappBtn').addEventListener('click',async()=>{
 if(!validateOrder()||cloudUploading||packageBusy)return;
 const code=orderCode();
 if(!CLOUD_ACTIVE){
  await prepareTemporaryCheckout(code);
  return;
 }
 if(!turnstileToken){
  notify('أكمل التحقق الأمني أسفل زر واتساب قبل إرسال الطلب.');
  $('cloudSecurity').scrollIntoView({behavior:'smooth',block:'center'});
  return;
 }
 // Open in the user gesture, before awaiting the upload, to avoid popup blockers.
 const tab=window.open('about:blank','_blank');
 if(tab){
  try{
   tab.opener=null;
   tab.document.title='TEKO STORE — جاري تجهيز الطلب';
   tab.document.body.innerHTML='<p style="font:18px Tahoma,sans-serif;text-align:center;margin-top:15vh" dir="rtl">جاري رفع ملفات الطلب وإعداد رسالة واتساب... يمكن الرجوع للمتجر حتى يكتمل الرفع.</p>';
  }catch{}
 }
 cloudUploading=true;
 const button=$('whatsappBtn'),oldLabel=button.textContent;
 button.disabled=true;button.textContent='جاري رفع الطلب وتجهيز الرابط...';
 try{
  const link=await uploadZipForOrder(code);
  recordOrder(code);
  const wa='https://wa.me/201557229102?text='+encodeURIComponent(orderMessage(code,link));
  cloudMessage('اتجهز رابط التحميل بنجاح وتم إدراجه في رسالة واتساب.');
  if(tab&&!tab.closed)tab.location.replace(wa);
  else window.location.href=wa;
  notify('تم رفع ZIP وإنشاء رابط تحميل حقيقي للمالك داخل رسالة واتساب.');
 }catch(error){
  if(tab&&!tab.closed)tab.close();
  cloudMessage('لم يكتمل رفع الملف؛ لم تُرسل رسالة برابط غير صالح. '+(error.message||''));
  notify('فشل رفع ملف الطلب: '+(error.message||'جرّب مرة أخرى'));
 }finally{
  refreshChallenge();
  cloudUploading=false;
  button.disabled=false;button.textContent=oldLabel;
 }
});
setupOrderCloud();
if(CLOUD_ACTIVE&&ORDER_CLOUD.enabled!==true){
 cloudMessage('وضع اختبار Supabase — الطلبات الحقيقية على الرابط العادي لم تتغير. أكمل التحقق وجرب ملف ZIP صغيرًا.');
}
// V15: one checkout button, without additional sharing controls.
// WhatsApp links cannot attach local files directly: ZIP downloads, then the owner message opens.
async function prepareTemporaryCheckout(code=orderCode()){
 if(!validateOrder()||packageBusy||cloudUploading)return;
 packageBusy=true;
 const button=$('whatsappBtn'),label=button.textContent;
 button.disabled=true;button.textContent='جاري تجهيز الطلب...';
 // Open during the click, before asynchronous ZIP work, to avoid popup blockers.
 let tab=null;
 try{
  tab=window.open('about:blank','_blank');
  if(tab){
   tab.opener=null;
   tab.document.title='TEKO STORE — تجهيز الطلب';
   tab.document.body.innerHTML='<p dir="rtl" style="font:16px Tahoma,Arial,sans-serif;text-align:center;margin:12vh auto;max-width:460px;padding:20px">جاري تجهيز ملفات طلبك... سيتم فتح رسالة واتساب بعد تنزيل ZIP.</p>';
  }
 }catch(error){tab=null}
 try{
  const message=orderMessage(code);
  const zip=await buildOrderPackage(code);
  const filename='TEKO-ORDER-'+code+'.zip';
  saveBlob(zip,filename);
  recordOrder(code);
  const whatsappUrl='https://wa.me/201557229102?text='+encodeURIComponent(message);
  if(tab&&!tab.closed)tab.location.replace(whatsappUrl);
  else window.location.href=whatsappUrl;
  notify('تم تنزيل ZIP وفتح واتساب بالتفاصيل. أرفق الملف كمستند واضغط إرسال.');
 }catch(error){
  if(tab&&!tab.closed)tab.close();
  notify('تعذر تجهيز ZIP: '+(error.message||'أعد المحاولة'));
 }finally{
  button.disabled=false;button.textContent=label;packageBusy=false;
 }
}
function renderOrders(){$('orders').innerHTML=store.orders.length?store.orders.map(o=>`<div class="order"><b>${escapeHTML(o.code)}</b> · ${escapeHTML(o.name)} · ${o.total} ج.م<br>${escapeHTML(o.color)} · ${escapeHTML(o.size)} · ${o.qty} قطعة · محفوظ محليًا</div>`).join(''):'لا توجد طلبات محلية حتى الآن.'}
$('adminToggle').addEventListener('click',()=>{$('admin').classList.toggle('show');if($('admin').classList.contains('show'))$('admin').scrollIntoView({behavior:'smooth'})});
$('savePrice').addEventListener('click',()=>{store.price=Math.max(0,Number($('adminPrice').value)||650);store.discount=Math.max(0,Math.min(95,Number($('adminDiscount').value)||0));persist();renderPrice();notify('تم تحديث السعر محليًا في هذه التجربة')});
$('adminAddDesign').addEventListener('click',async()=>{const name=$('adminDesignName').value.trim(),file=$('adminDesignFile').files[0];if(!name||!file){notify('أدخل الاسم واختر ملف التصميم');return}if(file.size>2*1024*1024){notify('ملفات المعرض التجريبي أقل من 2 ميجا؛ التخزين السحابي يدعم أحجام أكبر');return}const src=await fileData(file);store.gallery.unshift({id:id(),name,src});persist();renderGallery();$('adminDesignName').value='';$('adminDesignFile').value='';notify('تمت الإضافة إلى معرض هذا المتصفح')});
// Initialize
renderAll();renderPrice();renderGallery();renderOrders();loadImages();
