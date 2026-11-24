/* TEKO STORE — five approved print islands; expanded green chest, hood and yoke.
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
   make('front-upper-chest','أعلى الصدر بالكامل يمين ووسط وشمال',[
    // Extended approved chest allows both outer logo positions.
    [.275,.216],[.725,.216],[.748,.247],[.761,.317],
    [.758,.370],[.736,.425],[.722,.450],[.278,.450],
    [.264,.425],[.242,.370],[.239,.317],[.252,.247]
   ],['خياطة الرقبة','خياطة الكتف']),
   make('front-pocket-panel','واجهة الجيب الأمامي',[
    [.363,.590],[.636,.590],[.674,.734],[.696,.753],
    [.678,.782],[.323,.782],[.304,.753],[.325,.734]
   ],['الجيب الأمامي'])
  ]),
  back:Object.freeze([
   make('back-hood-outer','الكابيشو من الخلف',[
    // Rear hood cloth surface, including its lower point.
    [.354,.084],[.637,.084],[.685,.108],[.698,.148],
    [.681,.189],[.640,.229],[.586,.263],[.542,.285],
    [.505,.293],[.495,.293],[.457,.285],[.413,.263],
    [.360,.229],[.318,.189],[.302,.149],[.314,.108]
   ],['الكابيشو','خياطة أسفل الكابيشو']),
   make('back-upper-yoke','أعلى الظهر أسفل الكابيشو',[
    // Upper back is independent from the hood panel.
    [.337,.290],[.663,.290],[.680,.332],[.686,.416],
    [.666,.495],[.334,.495],[.314,.416],[.320,.332]
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
