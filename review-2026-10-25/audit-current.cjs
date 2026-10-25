// Read-only source audit. Minimal DOM/audio stubs; this is not a browser or FPS test.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const modules = new Map();
const listeners = new Map();
let screen = { w: 390, h: 844, dpr: 3, coarse: true };
class Canvas {
  constructor() { this.width = 0; this.height = 0; this.ops = []; }
  get clientWidth() { return screen.w; }
  get clientHeight() { return screen.h; }
  addEventListener() {}
  getContext() {
    const canvas = this;
    const ctx = {
      fillStyle: '#000000',
      fillRect(x,y,w,h) { canvas.ops.push({x,y,w,h,color:this.fillStyle}); },
      drawImage(img,x,y) { for(const o of img.ops ?? []) canvas.ops.push({...o,x:o.x+x,y:o.y+y}); },
      strokeRect() {}, measureText(s) { return {width:s.length*7}; }
    };
    return new Proxy(ctx, { get(t,p) { return p in t ? t[p] : ()=>{}; } });
  }
}
global.window = {
  get devicePixelRatio() { return screen.dpr; },
  matchMedia(q) { return { matches: q.includes('pointer: coarse') && screen.coarse }; },
  addEventListener(name, fn) { if(!listeners.has(name)) listeners.set(name,[]); listeners.get(name).push(fn); },
  visualViewport: { addEventListener() {} }
};
Object.defineProperty(global,'navigator',{value:{maxTouchPoints:0},configurable:true});
global.document = { createElement:()=>new Canvas(), getElementById:()=>null, querySelector:()=>null };
global.localStorage = {getItem:()=>null,setItem:()=>{}};
global.requestAnimationFrame = ()=>1;
function load(file) {
  if(modules.has(file)) return modules.get(file).exports;
  const module = {exports:{}}; modules.set(file,module);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const req = (p)=>p.startsWith('.') ? load(path.resolve(path.dirname(file),p+'.ts')) : require(p);
  new Function('require','module','exports',code)(req,module,module.exports);
  return module.exports;
}
const { Game } = load(path.join(root,'src/game/engine.ts'));
const { computeView } = load(path.join(root,'src/render/view.ts'));
const { SPR, actorFrame } = load(path.join(root,'src/render/sprites.ts'));
const { mulberry32, hitBox, walkSpeed } = load(path.join(root,'src/game/entities.ts'));
const { PHYS } = load(path.join(root,'src/game/player.ts'));
function gameAt(config) {
  screen = config;
  const game = new Game(new Canvas());
  game.sfx = new Proxy({muted:true},{get:(t,p)=>p in t?t[p]:()=>{}});
  game.draw = ()=>{};
  return game;
}
const configs = [
 {w:390,h:844,dpr:1,coarse:true},
 {w:390,h:844,dpr:3,coarse:true},
 {w:430,h:932,dpr:3,coarse:true},
 {w:1280,h:720,dpr:1,coarse:false},
 {w:1440,h:900,dpr:2,coarse:false},
 {w:844,h:390,dpr:3,coarse:true},
];
const sizes = configs.map(config=>{
 const g=gameAt(config); const v=g.v; const speed=g.scrollSpeed(g.px());
 return {...config,W:+v.W.toFixed(2),pd:v.pd,worldSpeed:+speed.toFixed(2),cssSpeed:+(speed*v.pd/v.dpr).toFixed(2),groundCss:+(v.G*v.pd/v.dpr).toFixed(2)};
});
const loops = [30,60,120].map(hz=>{
 const g=gameAt(configs[1]); g.start(); g.invUntil=1000;
 g.last=1000;
 for(let i=1;i<=hz*10;i++) g.loop(1000+i*1000/hz);
 return {hz,simulationSeconds:+g.time.toFixed(4),cam:+g.cam.toFixed(2),speed:+g.speed.toFixed(2)};
});
const fastCases=[1,1.1,12,NaN].map(fast=>{
 const g=gameAt(configs[1]); g.start();g.invUntil=10000;g.setDebug(false,fast);g.last=1000;
 for(let i=1;i<=60;i++) g.loop(1000+i*1000/60);
 return {requested:String(fast),stored:String(g.fast),simSeconds:+g.time.toFixed(4),cam:+g.cam.toFixed(2)};
});
const frameSizes=['playerA','playerB','playerC','playerD','playerJump','duckA','duckB','playerSit','grandma'].map(name=>({name,w:SPR[name].w,h:SPR[name].h}));
function pixels(sprite) {
 const result=new Map();
 for(const o of sprite.img.ops) for(let y=Math.max(0,o.y);y<Math.min(sprite.h,o.y+o.h);y++) for(let x=Math.max(0,o.x);x<Math.min(sprite.w,o.x+o.w);x++) result.set(`${x},${y}`,o.color);
 return result;
}
const duckSame=JSON.stringify([...pixels(SPR.duckA)])===JSON.stringify([...pixels(SPR.duckB)]);
const middleRunSame=JSON.stringify([...pixels(SPR.playerB)])===JSON.stringify([...pixels(SPR.playerD)]);
const g=gameAt(configs[1]);let firstViewCalls=0;g.onView=()=>firstViewCalls++;g.start();
const firstStartViewCallbacks=firstViewCalls;
g.setPadDuck(true);g.start();const padDuckAfterRestart=g.player.duckHeld;g.syncDuck();
const heldAfterSync=g.player.duckHeld;
// Exact canvas geometry with fractional DPR: source-level layout check only.
const shortView=computeView(844,390,3,0,0,true);
const resizeGame=gameAt(configs[1]);resizeGame.cam=1430;const before=resizeGame.px();
screen=configs[5];resizeGame.v=resizeGame.measure();const after=resizeGame.px();
const autoRuns=[configs[1],configs[3],configs[5]].map(config=>{
 const g=gameAt(config);g.rng=mulberry32(11);g.start();g.setDebug(true,1,true);
 let steps=0;
 while(g.phase!=='dead' && g.phase!=='over' && !g.smoked && steps++<60*600) g.step(1/60);
 return {viewport:`${config.w}x${config.h}@${config.dpr}`,seconds:+g.time.toFixed(2),phase:g.phase,smoked:g.smoked,cam:Math.round(g.cam),place:g.debug().place,hit:g.deadEntity?.kind??null,errors:g.errors};
});
const lowView=computeView(844,240,1,0,0,true);
const reachGame=gameAt(configs[1]);
const atFanling=5300+1300*2+200;
const reachSpeed=reachGame.scrollSpeed(atFanling);
const reachability=['phone','queue','daigou'].map(kind=>{
 const b=hitBox({kind,x:0,y:0,phase:0});
 const aboveSeconds=2*Math.sqrt(PHYS.jump**2-2*PHYS.gravity*b.y1)/PHYS.gravity;
 const crossingSeconds=(b.x1-b.x0+10)/(reachSpeed-walkSpeed(kind));
 return {kind,speed:+reachSpeed.toFixed(3),singleJumpAboveTopSeconds:+aboveSeconds.toFixed(3),crossingSeconds:+crossingSeconds.toFixed(3),singleJumpPossible:crossingSeconds<=aboveSeconds};
});
console.log(JSON.stringify({sizes,loops,fastCases,frameSizes,duckFramesIdentical:duckSame,playerBDIdentical:middleRunSame,firstStartViewCallbacks,padDuckAfterRestart,heldAfterSync,resizeWorldX:{before,after},shortView:{H:shortView.H,T:shortView.T,G:shortView.G,groundCss:shortView.G*shortView.pd/shortView.dpr},veryShortView:{cssH:240,G:lowView.G,groundCss:lowView.G*lowView.pd/lowView.dpr},autoRuns,reachability},null,2));
// Render existing sprite pixels at integer 6x for inspection; no production assets changed.
const names=['playerA','playerB','playerC','playerD','playerJump','duckA','duckB','playerSit','maskA','phoneA'];
const scale=6,cellW=300,cellH=240,cols=5,rows=Math.ceil(names.length/cols);
const png=new PNG({width:cols*cellW,height:rows*cellH});
for(let y=0;y<png.height;y++) for(let x=0;x<png.width;x++) {
 const i=(y*png.width+x)*4,c=(Math.floor(x/12)+Math.floor(y/12))%2?218:237;
 png.data[i]=c;png.data[i+1]=c;png.data[i+2]=c;png.data[i+3]=255;
}
names.forEach((name,n)=>{
 const sprite=SPR[name],ox=(n%cols)*cellW+24,oy=Math.floor(n/cols)*cellH+24;
 for(const [key,color] of pixels(sprite)) {
  const [x,y]=key.split(',').map(Number);const hex=color.slice(1);const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  for(let yy=0;yy<scale;yy++) for(let xx=0;xx<scale;xx++) {
   const i=((oy+y*scale+yy)*png.width+ox+x*scale+xx)*4;
   png.data[i]=rgb[0];png.data[i+1]=rgb[1];png.data[i+2]=rgb[2];png.data[i+3]=255;
  }
 }
});
fs.writeFileSync(path.join(__dirname,'04-current-sprite-atlas.png'),PNG.sync.write(png));
