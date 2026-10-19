// Deterministic, seamless local normal/roughness maps. RGB = tangent normal,
// alpha = perceptual roughness. No external assets or runtime generators.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const size = 1024;
const crc = b => { let c = 0xffffffff; for (const v of b) { c ^= v; for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; };
const chunk = (name,data) => { const t=Buffer.from(name),n=Buffer.alloc(4),c=Buffer.alloc(4); n.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t,data]))); return Buffer.concat([n,t,data,c]); };
const hash = (x,y) => { let n=Math.imul(x,374761393)^Math.imul(y,668265263); n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; };
for (const [name,strength,rough] of [['brushed',.24,.34],['powder',.065,.39],['steel',.075,.22],['graphite',.055,.35]]) {
 const heights = new Float32Array(size*size);
 for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const grain=hash(x,y);
  heights[y*size+x]=name==='brushed'
   ? .64*hash(0,y)+.22*Math.sin(y*Math.PI*2*173/size)+.10*Math.sin(x*Math.PI*2*3/size+y*.4)+grain*.04
   : name==='steel' ? .65*hash(0,y)+.35*grain : grain;
 }
 const raw=Buffer.alloc((size*4+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(a,b)=>heights[((b+size)%size)*size+(a+size)%size];
  const dx=(at(x+1,y)-at(x-1,y))*strength,dy=(at(x,y+1)-at(x,y-1))*strength;
  const len=Math.hypot(dx,dy,1),i=y*(size*4+1)+1+x*4;
  raw[i]=Math.round((.5-dx/len*.5)*255);raw[i+1]=Math.round((.5-dy/len*.5)*255);raw[i+2]=Math.round((.5+.5/len)*255);
  raw[i+3]=Math.round((rough+(at(x,y)-.5)*(name==='brushed'?.2:.09))*255);
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 writeFileSync(new URL(`../assets/models/reference-v2/textures/${name}-surface.png`,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
