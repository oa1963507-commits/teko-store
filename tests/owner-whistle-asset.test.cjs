const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sound=fs.readFileSync(path.join(root,"owner-sound.js"),"utf8");
const match=sound.match(/KEY="teko_owner_sound_v1",URL="([^"]+)"/);
test("Owner's uploaded whistle must be accessible as a real MP3 asset",async()=>{
 assert.ok(match,"The approved MP3 must be configured");
 const url=match[1];
 let bytes;
 if(/^https:\/\//.test(url)){
  assert.ok(url.startsWith("https://kopsyfhpcilafuesgjti.supabase.co/storage/v1/object/public/"),"Do not use an untrusted audio host");
  const resp=await fetch(url,{signal:AbortSignal.timeout(12000)});
  assert.equal(resp.status,200,"Whistle audio must be publicly downloadable before release");
  bytes=Buffer.from(await resp.arrayBuffer());
 }else{
  assert.ok(url.startsWith("./assets/notifications/"));
  const asset=path.resolve(root,url);
  assert.ok(fs.existsSync(asset),"Approved whistle MP3 is missing from the deployed site");
  bytes=fs.readFileSync(asset);
 }
 assert.ok(bytes.length>1200&&bytes.length<512000,"Missing/empty MP3 audio");
 const id3=bytes.subarray(0,3).toString("ascii")==="ID3";
 const frame=bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0;
 assert.ok(id3||frame,"Audio must be encoded as actual MP3 data");
});
