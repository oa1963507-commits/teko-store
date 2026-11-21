/* TEKO STORE — self-contained ZIP writer for pre-compressed images.
   No external CDN, customer files remain on their device until shared manually. */
(function(){
 'use strict';
 const encoder=new TextEncoder();
 const table=new Uint32Array(256);
 for(let n=0;n<256;n++){
  let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;
  table[n]=c>>>0;
 }
 function checksum(bytes){
  let c=0xFFFFFFFF;
  for(const b of bytes)c=table[(c^b)&255]^(c>>>8);
  return(c^0xFFFFFFFF)>>>0;
 }
 function writeDate(){
  const dt=new Date(),year=Math.min(2107,Math.max(1980,dt.getFullYear()));
  return{time:(dt.getHours()<<11)|(dt.getMinutes()<<5)|Math.floor(dt.getSeconds()/2),
   date:((year-1980)<<9)|((dt.getMonth()+1)<<5)|dt.getDate()};
 }
 function head(length){return new DataView(new ArrayBuffer(length))}
 async function bundle(files){
  if(!Array.isArray(files)||!files.length)throw Error('Empty package');
  if(files.length>65535)throw Error('Too many entries');
  const local=[],central=[];
  let offset=0;
  const stamp=writeDate();
  for(const entry of files){
   const filename=String(entry.name||'attachment').replace(/\\/g,'/').replace(/(^\/+|\.\.\/)/g,'');
   const name=encoder.encode(filename);
   const bytes=new Uint8Array(await entry.blob.arrayBuffer());
   if(name.length>65535||bytes.length>0xFFFFFFFF)throw Error('File too large');
   const crc=checksum(bytes);
   const a=head(30);
   a.setUint32(0,0x04034b50,true);
   a.setUint16(4,20,true);a.setUint16(6,0x0800,true);
   a.setUint16(8,0,true);a.setUint16(10,stamp.time,true);a.setUint16(12,stamp.date,true);
   a.setUint32(14,crc,true);a.setUint32(18,bytes.length,true);a.setUint32(22,bytes.length,true);
   a.setUint16(26,name.length,true);a.setUint16(28,0,true);
   local.push(a.buffer,name,bytes);
   const c=head(46);
   c.setUint32(0,0x02014b50,true);
   c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
   c.setUint16(10,0,true);c.setUint16(12,stamp.time,true);c.setUint16(14,stamp.date,true);
   c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);
   c.setUint16(28,name.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);
   c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);
   c.setUint32(42,offset,true);
   central.push(c.buffer,name);
   offset+=30+name.length+bytes.length;
   if(offset>0xFFFFFFFF)throw Error('ZIP package too large');
  }
  const directorySize=central.reduce((sum,part)=>sum+part.byteLength,0);
  const end=head(22);
  end.setUint32(0,0x06054b50,true);
  end.setUint16(4,0,true);end.setUint16(6,0,true);
  end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);
  end.setUint32(12,directorySize,true);end.setUint32(16,offset,true);end.setUint16(20,0,true);
  return new Blob([...local,...central,end.buffer],{type:'application/zip'});
 }
 window.TEKO_PACKAGE={bundle};
})();