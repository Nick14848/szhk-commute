// Actual Game/Player/spawn/collision/score logic in a synthetic host.
// Automated input at normal 1/60 simulation steps, not real-time human/browser/device certification.
// Collision, hazards, rewards and physics are not disabled or changed.
import esbuild from 'esbuild';
const noop=()=>{};
function canvas(){
  const c={clientWidth:1280,clientHeight:720,width:1280,height:720,addEventListener:noop,removeEventListener:noop};
  c.ctx=new Proxy({canvas:c,measureText:s=>({width:String(s).length*7})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
  c.getContext=()=>c.ctx;return c;
}
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
globalThis.document={hidden:false,createElement:canvas,getElementById:()=>null,querySelector:()=>null,documentElement:{dataset:{},style:{setProperty:noop}}};
globalThis.window={devicePixelRatio:1,addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false})};
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:0},configurable:true});
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=noop;
const r=await esbuild.build({stdin:{contents:'export {Game} from "./src/game/engine.ts";export {hitBox,walkSpeed} from "./src/game/entities.ts";export {dayOf,placeAt} from "./src/game/stages.ts";export {STEP} from "./src/game/balance.ts";',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false'}});
const m=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const pickups=new Set(['water','octopus','permit','concession']);
const results=[];
for(const seed of [1,7,11,20261025,213333818]){
  const g=new m.Game(canvas());g.audio.muted=true;g.seeded=true;g.seed=seed;g.start();
  let seconds=0,jumps=0,duckSteps=0,lastSeatTap=-Infinity;
  const recent=[];
  const stages=new Set();
  for(let f=0;f<60*600;f++){
    if(g.phase==='over'||m.dayOf(g.distance)>=2)break;
    if(g.phase==='seat'){
      if(seconds-lastSeatTap>=0.1){g.press();lastSeatTap=seconds;}
    }else if(g.phase==='run'&&!g.board&&g.prepLeft<=0){
      const pb=g.player.box(g.distance);
      const next=g.entities.filter(e=>!e.taken&&!pickups.has(e.kind)).map(e=>({e,b:m.hitBox(e)})).filter(o=>o.b&&o.b.x1>pb.x0).sort((a,b)=>a.b.x0-b.b.x0)[0];
      let duck=false;
      if(next){
        const relative=Math.max(20,g.speed-m.walkSpeed(next.e.kind));
        const dist=next.b.x0-pb.x1;
        if(next.e.kind==='sign')duck=dist<relative*0.4;
        else if(g.player.grounded&&dist<relative*0.2+2&&dist>-14){g.press();jumps++;}
        else if(!g.player.grounded&&g.player.vy<0&&g.player.h<45&&g.player.jumps>0&&dist<relative*0.2){g.press();jumps++;}
      }
      g.setPadDuck(duck);if(duck)duckSteps++;
    }
    g.step(m.STEP);seconds+=m.STEP;stages.add(m.placeAt(g.distance).simp);
    if(g.phase==='run'){recent.push({t:Number(seconds.toFixed(2)),h:Number(g.player.h.toFixed(2)),vy:g.player.vy,jumps:g.player.jumps,world:Number(g.distance.toFixed(2))});if(recent.length>6)recent.shift();}
  }
  results.push({seed,completedFirstDay:m.dayOf(g.distance)>=2,phase:g.phase,simulationSeconds:Number(seconds.toFixed(2)),world:Number(g.distance.toFixed(2)),place:m.placeAt(g.distance).simp,score:Math.floor(g.score),waters:g.waters,jumps,duckSeconds:Number((duckSteps/60).toFixed(2)),seats:g.stats.seats,seatWins:g.stats.wins,boardedDay:g.boardedDay,deathKind:g.deadEntity?.kind??null,deathX:g.deadEntity?.x??null,recent,stages:[...stages],errors:g.errors});
  g.dispose();
}
console.log(JSON.stringify({scope:'synthetic host / actual unmodified gameplay / automated inputs / not browser or human timing',results},null,2));
