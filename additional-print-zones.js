/* TEKO STORE — five additional print islands from the approved hoodie references.
   This file ONLY extends the original printable surfaces; it does not alter them.
   Coordinates are normalized to the existing 1122×1402 front/back mockups.
   All edges have a safety inset; final production calibration is still required. */
(()=>{
 'use strict';
 const make=(id,label,polygon,unblocks=[])=>Object.freeze({
  id,label,polygon:Object.freeze(polygon.map(([x,y])=>Object.freeze([x,y]))),
  unblocks:Object.freeze(unblocks)
 });
 const zones=Object.freeze({
  front:Object.freeze([
   make('front-hood-inner','داخل الكابيشو من الأمام',[
    [.413,.100],[.585,.100],[.609,.122],[.598,.147],
    [.563,.173],[.442,.173],[.407,.146],[.399,.123]
   ]),
   make('front-upper-chest','الشريط العلوي للصدر',[
    [.349,.243],[.654,.243],[.668,.251],[.668,.273],
    [.336,.273],[.336,.251]
   ],['خياطة الرقبة']),
   make('front-pocket-panel','واجهة الجيب الأمامي',[
    [.363,.590],[.636,.590],[.674,.734],[.696,.753],
    [.678,.782],[.323,.782],[.304,.753],[.325,.734]
   ],['الجيب الأمامي'])
  ]),
  back:Object.freeze([
   make('back-hood-outer','الكابيشو من الخلف',[
    // Follow the broad cloth panels above the pointed end of the hood;
    // unlike the initial V46 guide, a medium centered logo now fits.
    [.354,.086],[.637,.086],[.681,.111],[.690,.150],
    [.673,.185],[.626,.223],[.577,.252],[.530,.278],
    [.470,.278],[.422,.252],[.374,.223],[.328,.184],
    [.312,.149],[.320,.111]
   ],['الكابيشو']),
   make('back-upper-yoke','أعلى الظهر أسفل الكابيشو',[
    // A separate cloth surface BELOW the hood itself, including the
    // customer-approved upper back panel; still no cross-surface prints.
    [.338,.294],[.663,.294],[.668,.338],[.669,.424],
    [.654,.456],[.346,.456],[.331,.424],[.331,.338]
   ],['خياطة أسفل الكابيشو'])
  ]),
  left:Object.freeze([]),
  right:Object.freeze([])
 });
 function insidePoly(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const [xi,yi]=poly[i],[xj,yj]=poly[j];
   if(((yi>y)!==(yj>y))&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
 }
 function containsRect(rect,polygon){
  if(!rect||![rect.x,rect.y,rect.w,rect.h].every(Number.isFinite)||
     rect.w<=0||rect.h<=0)return false;
  // As with the existing garment polygon checks, validate a fine grid across
  // the complete artwork rectangle, not just its center or top-left corner.
  for(let a=0;a<=6;a++)for(let b=0;b<=6;b++){
   if(!insidePoly(rect.x+rect.w*a/6,rect.y+rect.h*b/6,polygon))return false;
  }
  return true;
 }
 function match(view,rect){
  return (zones[view]||[]).find(z=>containsRect(rect,z.polygon))||null;
 }
 window.TEKO_EXTRA_PRINT=Object.freeze({zones,match,containsRect});
})();
