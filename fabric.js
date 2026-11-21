/* TEKO STORE V6 — live fabric-aware print simulator.
   The mockup remains an approximation: true 3D folding needs UV/normal/displacement scans.
   Copyright (c) TEKO STORE. */
(function(){
 'use strict';
 function canvas(w,h){let c=document.createElement('canvas');c.width=w;c.height=h;return c}
 const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
 const lum=(p,i)=>p[i]*.2126+p[i+1]*.7152+p[i+2]*.0722;
 function print(dst,garment,artwork,box,highQuality=false){
  const x=box.x*1122,y=box.y*1402,w=box.w*1122,h=box.h*1402;
  if(w<=1||h<=1||!artwork)return;
  const scale=highQuality?1:Math.min(1,380/Math.max(w,h));
  const W=Math.max(2,Math.round(w*scale)),H=Math.max(2,Math.round(h*scale));
  const source=canvas(W,H),sc=source.getContext('2d',{willReadFrequently:true});
  sc.drawImage(artwork,0,0,W,H);
  const garmentCrop=canvas(W,H),g=garmentCrop.getContext('2d',{willReadFrequently:true});
  g.drawImage(garment,x,y,w,h,0,0,W,H);
  const blurred=canvas(W,H),b=blurred.getContext('2d',{willReadFrequently:true});
  b.filter='blur('+Math.max(2,Math.round(Math.min(W,H)*.065))+'px)';
  b.drawImage(garmentCrop,0,0);b.filter='none';
  try{
   const ink=sc.getImageData(0,0,W,H).data;
   const fabric=g.getImageData(0,0,W,H).data;
   const soft=b.getImageData(0,0,W,H).data;
   const rendered=canvas(W,H),rc=rendered.getContext('2d');
   const img=rc.createImageData(W,H),pixels=img.data;
   let average=0,count=0;
   for(let yy=3;yy<H;yy+=5)for(let xx=3;xx<W;xx+=5){
    average+=lum(soft,(yy*W+xx)*4);count++;
   }
   average=count?average/count:125;
   for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){
    const p=(yy*W+xx)*4,light=lum(soft,p);
    const xL=Math.max(0,xx-2),xR=Math.min(W-1,xx+2);
    const yT=Math.max(0,yy-2),yB=Math.min(H-1,yy+2);
    // Gentle fold displacement of 0-2.4 pixels, guided by the actual photograph.
    const gx=lum(soft,(yy*W+xR)*4)-lum(soft,(yy*W+xL)*4);
    const gy=lum(soft,(yB*W+xx)*4)-lum(soft,(yT*W+xx)*4);
    const sx=bound(Math.round(xx+bound(gx*.11,-2.4,2.4)),0,W-1);
    const sy=bound(Math.round(yy+bound(gy*.11,-2.4,2.4)),0,H-1);
    const a=(sy*W+sx)*4,alpha=ink[a+3];if(!alpha)continue;
    // Low-frequency folds + local high-frequency knit relief are separate signals.
    const knit=lum(fabric,p)-light;
    const shade=bound(Math.pow((light+24)/(average+24),.76)+bound(knit*.005,-.11,.11),.52,1.28);
    pixels[p]=bound(ink[a]*shade,0,255);
    pixels[p+1]=bound(ink[a+1]*shade,0,255);
    pixels[p+2]=bound(ink[a+2]*shade,0,255);
    pixels[p+3]=Math.round(alpha*bound(.95+knit*.0007,.86,.985));
   }
   rc.putImageData(img,0,0);dst.drawImage(rendered,x,y,w,h);
  }catch(err){
   // Always show the artwork, even on restricted browser canvas engines.
   dst.drawImage(artwork,x,y,w,h);
  }
 }
 window.TEKO_FABRIC={print};
})();