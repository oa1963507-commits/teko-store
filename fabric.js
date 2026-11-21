/* TEKO STORE V7 — garment-aware ink compositing.
   This is a photographic mockup simulation, not a 3D material/UV solver.
   It preserves original artwork while responding to folds, studio light and fabric relief. */
(function(){
 'use strict';
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const luma=(data,i)=>data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;
 function print(output,hoodie,artwork,bounds,highQuality=false){
  const x=bounds.x*1122,y=bounds.y*1402,w=bounds.w*1122,h=bounds.h*1402;
  if(!artwork||!(w>1&&h>1))return;
  // Fast drag preview; full-resolution output on download.
  const scale=highQuality?1:Math.min(1,440/Math.max(w,h));
  const W=Math.max(3,Math.round(w*scale)),H=Math.max(3,Math.round(h*scale));
  const source=makeCanvas(W,H),sourceCtx=source.getContext('2d',{willReadFrequently:true});
  sourceCtx.drawImage(artwork,0,0,W,H);
  const pad=Math.max(16,Math.round(Math.min(W,H)*.09));
  const pw=W+pad*2,ph=H+pad*2,sx=W/w,sy=H/h;
  // Include a padded area of the actual hoodie to prevent blur halos along print edges.
  const fabricCanvas=makeCanvas(pw,ph);
  const fabricCtx=fabricCanvas.getContext('2d',{willReadFrequently:true});
  fabricCtx.drawImage(hoodie,pad-x*sx,pad-y*sy,1122*sx,1402*sy);
  const small=makeCanvas(pw,ph),smallCtx=small.getContext('2d',{willReadFrequently:true});
  smallCtx.filter='blur(1.2px)';
  smallCtx.drawImage(fabricCanvas,0,0);smallCtx.filter='none';
  const large=makeCanvas(pw,ph),largeCtx=large.getContext('2d',{willReadFrequently:true});
  largeCtx.filter='blur('+Math.max(6,Math.round(Math.min(W,H)*.06))+'px)';
  largeCtx.drawImage(fabricCanvas,0,0);largeCtx.filter='none';
  try{
   const ink=sourceCtx.getImageData(0,0,W,H).data;
   const cloth=fabricCtx.getImageData(pad,pad,W,H).data;
   const fine=smallCtx.getImageData(pad,pad,W,H).data;
   const folds=largeCtx.getImageData(pad,pad,W,H).data;
   const result=makeCanvas(W,H),resultCtx=result.getContext('2d');
   const resultImg=resultCtx.createImageData(W,H),dst=resultImg.data;
   const shadeLum=new Float32Array(W*H);
   let avg=0,count=0;
   for(let i=0;i<W*H;i++){
    const val=luma(folds,i*4);shadeLum[i]=val;
    if(i%5===0){avg+=val;count++;}
   }
   avg=count?avg/count:130;
   const radius=clamp(Math.round(W*.016),2,8);
   for(let yy=0;yy<H;yy++){
    const up=Math.max(0,yy-radius),down=Math.min(H-1,yy+radius);
    for(let xx=0;xx<W;xx++){
     const p=yy*W+xx,i=p*4;
     const l=shadeLum[p];
     const lX=shadeLum[yy*W+Math.min(W-1,xx+radius)]-shadeLum[yy*W+Math.max(0,xx-radius)];
     const lY=shadeLum[down*W+xx]-shadeLum[up*W+xx];
     // Inverse-map the ink over the photograph's local fold gradients.
     const ox=clamp(lX*.27,-5.5,5.5),oy=clamp(lY*.22,-4.5,4.5);
     const ax=Math.round(xx+ox),ay=Math.round(yy+oy);
     if(ax<0||ay<0||ax>=W||ay>=H)continue;
     const from=(ay*W+ax)*4,alpha=ink[from+3];
     if(alpha<1)continue;
     const mid=luma(fine,i),hi=luma(cloth,i);
     // Distinguish broad folds, draping shadows, middle-frequency folds and fine weave.
     const foldStrength=clamp((l-avg)*.020,-.39,.23);
     const midStrength=clamp((mid-l)*.017,-.13,.13);
     const knitStrength=clamp((hi-mid)*.046,-.15,.15);
     const shade=clamp(1+foldStrength+midStrength+knitStrength,.53,1.24);
     // Tiny pigment/fiber highlights keep dark photographic blacks from looking like stickers.
     const fiberHighlight=clamp((hi-mid)*.20,0,7);
     dst[i]=clamp(ink[from]*shade+fiberHighlight,0,255);
     dst[i+1]=clamp(ink[from+1]*shade+fiberHighlight,0,255);
     dst[i+2]=clamp(ink[from+2]*shade+fiberHighlight,0,255);
     dst[i+3]=Math.round(alpha*clamp(.965+(hi-mid)*.002,.91,.985));
    }
   }
   resultCtx.putImageData(resultImg,0,0);
   output.drawImage(result,x,y,w,h);
  }catch(error){
   // Canvas security or unsupported filter: never discard the customer's artwork.
   output.drawImage(artwork,x,y,w,h);
  }
 }
 window.TEKO_FABRIC={print,version:7};
})();