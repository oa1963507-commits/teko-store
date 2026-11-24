/* TEKO STORE: additive print zones regression tests.
   Run: node --test tests/additional-print-zones.test.cjs
   No browser, images, mock customer data, or external network required. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const code=fs.readFileSync(path.join(root,"app.js"),"utf8");
const extra=fs.readFileSync(path.join(root,"additional-print-zones.js"),"utf8");
const windowMock={};
vm.runInNewContext(extra,{window:windowMock});
const ext=windowMock.TEKO_EXTRA_PRINT;
const geometry=code.slice(code.indexOf("const PRINT_SURFACES="),code.indexOf("function snapshot()"));
if(!geometry.includes("function violations(d)"))throw Error("Could not locate editor print validation");

const SIZES={M:[60,70,58],L:[62,72,60],XL:[64,74,62],"2XL":[66,76,64],"3XL":[68,78,66]};
function editor(size="M",artworks=[]){
 return new Function("window","SIZES","size","PRINT_LIMITS","designs",
  geometry+"\nreturn {violations,areas,PRINT_SURFACES,onPrintablePart,hasErrors,scaleW,getBounds};")(
  windowMock,SIZES,size,{width:40,height:60},artworks);
}
function example(view,cx,cy,widthCm=2.6,heightCm=2.3,size="M"){
 const w=widthCm*.66/SIZES[size][0];
 const h=heightCm*.66/SIZES[size][0]*(1122/1402);
 return {view,x:cx-w/2,y:cy-h/2,w:widthCm,h:heightCm};
}
const approved=[
 ["front","front-hood-inner",.500,.136,2.6,2.3],
 ["front","front-upper-chest",.500,.257,2.3,2.2],
 ["front","front-pocket-panel",.500,.700,4,5],
 ["back","back-hood-outer",.500,.170,4,4],
 ["back","back-upper-yoke",.500,.350,2.2,2.0],
];

test("Exactly five new zones; no new sleeve exceptions",()=>{
 assert.equal(ext.zones.front.length,3);
 assert.equal(ext.zones.back.length,2);
 assert.equal(ext.zones.left.length,0);
 assert.equal(ext.zones.right.length,0);
 assert.equal(approved.length,5);
});
test("Every approved new zone is printable across hoodie sizes",()=>{
 for(const size of Object.keys(SIZES))for(const [view,id,cx,cy,w,h] of approved){
  const d=example(view,cx,cy,w,h,size),api=editor(size);
  assert.equal(ext.match(view,api.getBounds(d))?.id,id,`Expected ${id}, ${size}`);
  assert.deepEqual(api.violations(d),[],`Rejected ${id}, ${size}`);
 }
});
test("Original torso and sleeve placements remain printable",()=>{
 for(const size of Object.keys(SIZES)){
  const api=editor(size);
  const cases=[
   example("front",.5,.43,8,8,size),
   example("back",.5,.48,8,8,size),
   example("front",.18,.48,2.5,2.5,size),
   example("back",.82,.48,2.5,2.5,size)
  ];
  for(const d of cases)assert.equal(api.violations(d).length,0,`Lost legacy ${d.view} in ${size}`);
 }
});
test("Old restrictions remain blocked outside new areas",()=>{
 const api=editor();
 const forbidden=[
  example("front",.5,.226),
  example("front",.29,.66,3,3),
  example("back",.290,.15),
  example("front",.16,.83,3,3),
  example("left",.37,.67,2.6,2.3),
  example("right",.65,.67,2.6,2.3)
 ];
 for(const d of forbidden){
  assert.equal(ext.match(d.view,api.getBounds(d)),null,"Accidental zone override");
  assert.ok(api.violations(d).length>0,`Unexpected allowed restriction: ${JSON.stringify(d)}`);
 }
});
test("Artwork crossing the pocket boundary remains invalid",()=>{
 const api=editor();
 const partial=example("front",.33,.69,12,8);
 assert.equal(ext.match("front",api.getBounds(partial)),null);
 assert.ok(api.violations(partial).some(r=>r.label==="الجيب الأمامي"));
});
test("Existing 40 x 60 cm dimension ceiling still applies",()=>{
 const api=editor();
 const tooTall=example("front",.5,.44,5,61);
 const tooWide=example("back",.5,.45,41,3);
 assert.ok(api.violations(tooTall).some(r=>r.label.includes("40 × 60")));
 assert.ok(api.violations(tooWide).some(r=>r.label.includes("40 × 60")));
});
test("Production blocking logic still rejects mixed illegal prints",()=>{
 const legal=example("front",.5,.70,4,5);
 const illegal=example("front",.29,.66,3,3);
 assert.equal(editor("M",[legal]).hasErrors(),false);
 assert.equal(editor("M",[legal,illegal]).hasErrors(),true);
});
test("New visual guide stays optional and cannot change export files",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const idxNew=html.indexOf('<script src="additional-print-zones.js?v=49">');
 const idxEditor=html.indexOf('<script src="app.js?v=49">');
 assert.ok(idxNew>0&&idxEditor>idxNew,"Zone module must run before editor");
 assert.match(html,/id="additionalPrintZonesBtn"/);
 assert.match(code,/showTools&&showAdditionalZoneGuides/);
});

test("Uploaded screenshot 1: centered medium logo fits back hood",()=>{
 const api=editor();
 // Approximate source screenshot normalized canvas dimensions (1122×1402).
 // Source image includes a selected square logo x=.417-.583, y=.109-.242.
 const sample={view:"back",x:.417,y:.109,w:.166/api.scaleW(),
  h:.133/(api.scaleW()*(1122/1402))};
 assert.equal(ext.match("back",api.getBounds(sample))?.id,"back-hood-outer");
 assert.deepEqual(api.violations(sample),[]);
});
test("Uploaded screenshot 2: logo spanning hood and back remains invalid",()=>{
 const api=editor();
 const sample={view:"back",x:.418,y:.258,w:.166/api.scaleW(),
  h:.132/(api.scaleW()*(1122/1402))};
 assert.ok(api.violations(sample).some(i=>i.label.includes("عابر بين قماش الكابيشو والظهر")));
});
test("Moving screenshot 2 artwork completely below hood is permitted",()=>{
 const api=editor();
 const sample={view:"back",x:.418,y:.303,w:.166/api.scaleW(),
  h:.132/(api.scaleW()*(1122/1402))};
 assert.equal(ext.match("back",api.getBounds(sample))?.id,"back-upper-yoke");
 assert.deepEqual(api.violations(sample),[]);
});
test("Error box focuses rejected artwork, not the former whole hood ban",()=>{
 assert.match(code,/bounds:getBounds\(d\),issue:violations\(d\)\[0\]/);
 assert.doesNotMatch(code,/currentErrors=showTools\?designs\.filter\(d=>d\.view===view\)\.flatMap\(d=>violations\(d\)\)/);
});

test("Left and right upper-front logo boxes are valid at all hoodie sizes",()=>{
 for(const size of Object.keys(SIZES))for(const cx of [.34,.66]){
  const api=editor(size),d=example("front",cx,.316,12,12,size);
  assert.equal(ext.match("front",api.getBounds(d))?.id,"front-upper-chest");
  assert.deepEqual(api.violations(d),[],"front side "+cx+" size "+size);
 }
});
test("Rear hood tip and upper-back prints independently pass at all sizes",()=>{
 for(const size of Object.keys(SIZES)){
  const api=editor(size);
  for(const [cy,w,h,id] of [
   [.282,1.5,1.5,"back-hood-outer"],[.400,12,12,"back-upper-yoke"]
  ]){
   const d=example("back",.5,cy,w,h,size);
   assert.equal(ext.match("back",api.getBounds(d))?.id,id);
   assert.deepEqual(api.violations(d),[]);
  }
 }
});
test("Spanning rear hood and upper-back seam remains invalid",()=>{
 for(const size of Object.keys(SIZES)){
  const api=editor(size),d=example("back",.5,.294,12,12,size);
  assert.equal(ext.match("back",api.getBounds(d)),null);
  assert.ok(api.violations(d).some(v=>v.label.includes("عابر بين قماش الكابيشو والظهر")));
 }
});
test("Old protected seams outside the approved green remain blocked",()=>{
 for(const size of Object.keys(SIZES)){
  const api=editor(size);
  for(const d of [
   example("front",.218,.336,3,3,size),
   example("front",.5,.201,3,3,size),
   example("back",.29,.15,2.6,2.3,size)
  ]){
   assert.equal(ext.match(d.view,api.getBounds(d)),null);
   assert.ok(api.violations(d).length>0);
  }
 }
});
