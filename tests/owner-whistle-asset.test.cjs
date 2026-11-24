const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sound=fs.readFileSync(path.join(root,"owner-sound.js"),"utf8");
const html=fs.readFileSync(path.join(root,"owner.html"),"utf8");

test("Owner can select and locally persist the exact approved MP3 without a broken hosted asset",()=>{
 assert.match(sound,/SOUND_URL="\.\/assets\/notifications\/teko-owner-alert\.mp3"/);
 assert.match(sound,/indexedDB\.open\(DB,1\)/);
 assert.match(sound,/URL\.createObjectURL\(file\)/);
 assert.match(sound,/await saveFile\(file\)/);
 assert.match(sound,/fileInput\.click\(\)/);
 assert.match(sound,/new Audio\(url\)/);
 assert.doesNotMatch(sound,/createOscillator/);
 assert.match(html,/id="ownerSoundUpload"/);
 assert.match(html,/id="ownerSoundTest"/);
 assert.match(html,/id="ownerSoundFile"/);
});
test("If an approved MP3 is bundled later, verify that it is real audio",()=>{
 const relative="./assets/notifications/teko-owner-alert.mp3";
 const asset=path.resolve(root,relative);
 if(!fs.existsSync(asset))return;
 const bytes=fs.readFileSync(asset);
 assert.ok(bytes.length>1200 && bytes.length<8*1024*1024);
 const id3=bytes.subarray(0,3).toString("ascii")==="ID3";
 const frame=bytes[0]===0xff && (bytes[1]&0xe0)===0xe0;
 assert.ok(id3||frame);
});
