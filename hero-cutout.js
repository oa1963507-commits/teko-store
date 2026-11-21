/* TEKO STORE V34 — non-destructive hero cutout.
   Keeps the original product photo intact for editing, printing and product cards.
   Only removes the neutral-gray studio backdrop in the homepage hero. */
(()=>{
"use strict";
const photo=document.getElementById("heroHoodie");
if(!photo)return;
const original=photo.getAttribute("src");
let objectUrl=null;
const canvas=document.createElement("canvas");
const onError=()=>{
  photo.classList.add("is-fallback");
  photo.classList.remove("is-processing");
  photo.setAttribute("data-cutout-status","fallback");
};
function process(){
  try{
    const width=photo.naturalWidth,height=photo.naturalHeight;
    if(!width||!height)throw Error("Missing photo dimensions");
    const scale=Math.min(1,1100/Math.max(width,height));
    const w=Math.max(100,Math.round(width*scale)),h=Math.max(100,Math.round(height*scale));
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx)throw Error("No 2D context");
    ctx.drawImage(photo,0,0,w,h);
    const image=ctx.getImageData(0,0,w,h);
    const pixels=image.data,total=w*h;
    const background=new Uint8Array(total);
    const queue=new Int32Array(total);
    let head=0,tail=0;
    // The original product photo has a cool neutral-gray backdrop; the garment is burgundy.
    // Flood-fill ONLY gray pixels connected to the outer edges, retaining dark inner folds.
    const isNeutral=(p)=>{
      const a=p*4,r=pixels[a],g=pixels[a+1],b=pixels[a+2];
      const redBias=r-Math.max(g,b);
      const luminance=(r+g+b)/3;
      return (redBias<13 && Math.abs(g-b)<54 && luminance>23) ||
        (luminance>205 && redBias<24 && Math.abs(g-b)<64);
    };
    function add(index){
      if(background[index]||!isNeutral(index))return;
      background[index]=1;queue[tail++]=index;
    }
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}
    for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
    while(head<tail){
      const p=queue[head++],x=p%w,y=(p/w)|0;
      if(x>0)add(p-1);
      if(x<w-1)add(p+1);
      if(y>0)add(p-w);
      if(y<h-1)add(p+w);
    }
    if(tail<total*.12||tail>total*.84)
      throw Error("Mask not confident; preserve the original");
    // Anti-alias the silhouette, reducing the common light halo from studio cutouts.
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p=y*w+x,alphaIndex=p*4+3;
        if(background[p]){pixels[alphaIndex]=0;continue;}
        let neighbours=0;
        if(x>0&&background[p-1])neighbours++;
        if(x<w-1&&background[p+1])neighbours++;
        if(y>0&&background[p-w])neighbours++;
        if(y<h-1&&background[p+w])neighbours++;
        if(neighbours)pixels[alphaIndex]=Math.max(130,255-neighbours*35);
      }
    }
    ctx.putImageData(image,0,0);
    canvas.toBlob(blob=>{
      if(!blob){onError();return;}
      objectUrl=URL.createObjectURL(blob);
      photo.onload=()=>{
        photo.classList.add("is-cutout");
        photo.classList.remove("is-processing");
        photo.setAttribute("data-cutout-status","ready");
        photo.onload=null;
      };
      photo.onerror=onError;
      photo.src=objectUrl;
    },"image/png");
  }catch(error){
    console.warn("TEKO hero cutout fallback:",error);
    onError();
  }
}
photo.classList.add("is-processing");
if(photo.complete&&photo.naturalWidth)process();
else{
 photo.addEventListener("load",process,{once:true});
 photo.addEventListener("error",onError,{once:true});
}
window.addEventListener("pagehide",()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)},{once:true});
// Keep the source asset discoverable; no conversion ever touches editor images.
photo.dataset.originalSrc=original;
})();