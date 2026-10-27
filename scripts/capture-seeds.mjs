// Find reproducible normal-collision clips for the local video exporter.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";
const noop=()=>{};
function canvas() {
  const c={clientWidth:360,clientHeight:640,addEventListener:noop,removeEventListener:noop,focus:noop};
  const ctx=new Proxy({canvas:c,measureText:s=>({width:s.length*7})},{get:(o,k)=>k in o?o[k]:noop});
  c.getContext=()=>ctx; return c;
}
globalThis.document={documentElement:{dataset:{},style:{setProperty:noop}},getElementById:()=>null,querySelector:()=>null,createElement:()=>canvas(),addEventListener:noop,removeEventListener:noop};
globalThis.window={matchMedia:()=>({matches:false}),devicePixelRatio:2,addEventListener:noop,removeEventListener:noop};
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{maxTouchPoints:0}});
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=noop;
globalThis.localStorage={getItem:()=>null,setItem:noop};
const dir=mkdtempSync(join(tmpdir(),"szhk-clips-"));
try {
  const outfile=join(dir,"engine.mjs");
  await esbuild.build({entryPoints:["src/game/engine.ts"],outfile,bundle:true,format:"esm",platform:"node",define:{"import.meta.env.DEV":"true"},logLevel:"silent"});
  const {Game}=await import(pathToFileURL(outfile).href);
  for(const [at,sec] of [[300,7],[1650,8],[3190,9],[7220,7],[10080,10],[22800,7]]) {
    const choices=[];
    for(let i=0;i<40;i++) {
      const seed=i===0?40522052:20261027+i*3571;
      const g=new Game(canvas());g.startCaptureSegment(at,seed);
      let duckFrames=0,doubleFrames=0;
      for(let f=0;f<60*sec&&g.phase!=="over";f++) {g.step(1/60); if(g.player.pose==="duck")duckFrames++; if(g.player.jumps===2)doubleFrames++;}
      if(g.phase!=="over"&&g.phase!=="dead")choices.push({seed,world:Math.round(g.distance),phase:g.phase,stats:g.stats,score:Math.floor(g.score),duckFrames,doubleFrames});
      g.dispose();
      if(choices.length>=3)break;
    }
    console.log(JSON.stringify({at,sec,choices}));
  }
} finally {rmSync(dir,{recursive:true,force:true});}
