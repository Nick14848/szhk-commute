/** The actual game engine, running its fixed steps with inert canvas/audio.
 * No browser state injection and no assertion that this replaces real devices. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";
import assert from "node:assert/strict";

const noop = () => {};
const root = { dataset: {}, style: { setProperty: noop } };
function canvas() {
  const c = { clientWidth: 390, clientHeight: 844, addEventListener: noop, removeEventListener: noop, focus: noop };
  const ctx = new Proxy({ canvas: c, measureText: (s) => ({width: s.length * 7}) }, {get: (o,k) => k in o ? o[k] : noop});
  c.getContext = () => ctx;
  return c;
}
globalThis.document = { documentElement: root, getElementById: () => null, querySelector: () => null, createElement: () => canvas(), addEventListener: noop, removeEventListener: noop };
globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 2, addEventListener: noop, removeEventListener: noop };
Object.defineProperty(globalThis, "navigator", {configurable:true, value: {maxTouchPoints:0}});
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = noop;
globalThis.localStorage = {getItem: () => null, setItem: noop};
const dir = mkdtempSync(join(tmpdir(), "szhk-engine-"));
let Game, ProductionGame, DAY_LEN, STAGES, TRAIN_START, STATION_LEN, TRAVELATORS, hitBox, overlaps, walkSpeed, speedAt;
try {
  const outfile = join(dir, "engine.mjs");
  await esbuild.build({stdin:{contents:'export {Game} from "./src/game/engine.ts"; export {hitBox,overlaps,walkSpeed} from "./src/game/entities.ts"; export {speedAt} from "./src/game/balance.ts";',resolveDir:process.cwd()}, outfile, bundle:true, platform:"node", format:"esm", define:{"import.meta.env.DEV":"true"}, logLevel:"silent"});
  ({Game,hitBox,overlaps,walkSpeed,speedAt} = await import(pathToFileURL(outfile).href));
  const productionFile=join(dir,"engine-production.mjs");
  await esbuild.build({stdin:{contents:'export {Game} from "./src/game/engine.ts";',resolveDir:process.cwd()}, outfile:productionFile, bundle:true, platform:"node", format:"esm", define:{"import.meta.env.DEV":"false"}, logLevel:"silent"});
  ({Game:ProductionGame}=await import(pathToFileURL(productionFile).href));
  const stageFile = join(dir, "stages.mjs");
  await esbuild.build({entryPoints:["src/game/stages.ts"], outfile:stageFile, bundle:true, platform:"node", format:"esm", logLevel:"silent"});
  const stages = await import(pathToFileURL(stageFile).href);
  DAY_LEN = stages.DAY_LEN;
  STAGES = stages.SEGMENTS;
  TRAIN_START = stages.TRAIN_START;
  STATION_LEN = stages.STATION_LEN;
  TRAVELATORS = stages.travelatorRanges();
} finally { rmSync(dir, {recursive:true, force:true}); }

function make(seed) {
  const g = new Game(canvas());
  g.seeded = true; g.seed = seed;
  g.start();
  return g;
}
const capture=make(3);
capture.startCaptureSegment(1700,99);
assert.equal(capture.debug().seed,99);
assert.equal(capture.debug().world,1700);
assert.equal(capture.debug().timeScale,1);
assert.equal(capture.score,0);
assert.equal(capture.entities.length,0,"capture must not fabricate obstacles");
assert.equal(capture.shielded(),false,"capture must not grant invulnerability");
capture.dispose();
const productionCapture=new ProductionGame(canvas());
productionCapture.startCaptureSegment(1700,99);
assert.equal(productionCapture.uiState().phase,"idle","capture entry must be disabled in production");
assert.equal(productionCapture.debug().world,52);
productionCapture.dispose();
const distances = [];
for (const hz of [30,60,120]) {
  const g = make(20261026);
  // No obstacles in a timing-only sample; rules/spawn tested below separately.
  g.collide = noop;
  g.loop(1000);
  for (let i=1; i<=hz*10; i++) g.loop(1000 + i * 1000/hz);
  distances.push(g.distance);
  const at = g.distance;
  g.pause();
  g.loop(20000); g.loop(30000);
  assert.equal(g.distance, at, "paused engine must not advance");
  g.resume(); g.loop(40000); g.loop(40016.67);
  assert.ok(g.distance - at < 3, "resume must not catch up hidden time");
  g.dispose();
}
assert.ok(Math.max(...distances)-Math.min(...distances)<1.5, JSON.stringify(distances));

// Route-duration fixture: collide suppressed ONLY for measuring length, not a pass proof.
const timing = make(20261026);
timing.collide = noop;
timing.beginSeat = noop;
const times = [];
let segment = 0;
for (let frame=0; timing.distance < DAY_LEN && frame<60*400; frame++) {
  timing.step(1/60);
  while (segment < STAGES.length && timing.distance >= STAGES[segment].end) {
    times.push({stage:STAGES[segment].id, elapsed:Math.round(frame/60*100)/100}); segment++;
  }
}
assert.ok(timing.distance >= DAY_LEN, "timing route must finish");
assert.equal(timing.boardedDay, 1, "one train boarding on first day");
assert.ok(times.at(-1).elapsed>225 && times.at(-1).elapsed<280, JSON.stringify(times));
timing.dispose();

// Exercise generated patterns through actual collision code, normal step, no invulnerability.
const runs = [];
for (let seed=1; seed<=20; seed++) {
  const g = make(seed * 20261026);
  g.auto = true;
  let frames = 0;
  for (; frames<60*400 && g.distance<DAY_LEN && g.phase!=="over"; frames++) g.step(1/60);
  runs.push({seed:g.seed, reached:Math.round(g.distance), phase:g.phase, hit:g.deadEntity?.kind, h:Math.round(g.player.h), vy:Math.round(g.player.vy), jumps:g.player.jumps});
  assert.equal(g.errors.length, 0);
  assert.ok(Number.isFinite(g.distance) && Number.isFinite(g.score));
  g.dispose();
}
assert.ok(runs.some((r) => r.reached >= DAY_LEN), `at least one collision-enabled full-route fixture: ${JSON.stringify(runs)}`);

// Bounded input search over freshly generated obstacle windows. This checks the
// combination, not just canClear(kind) in isolation; no shielding/collision bypass.
function traversable(g, allowDouble) {
  const hazards = g.entities.filter((e) => !["water","octopus","permit","concession"].includes(e.kind));
  if (!hazards.length) return true;
  // The shared world path includes the real smooth area acceleration, rather
  // than treating a whole boundary window as a constant-speed approximation.
  const positions=[g.distance];
  const speeds=[];
  for (let frame=0; frame<420; frame++) {
    const speed=speedAt(positions[frame],Math.max(.2,g.runTime)+frame/60);
    speeds.push(speed);
    positions.push(positions[frame]+speed/60);
  }
  const nodes = [{p:new g.player.constructor(), cost:0}];
  let states = nodes;
  const end = Math.max(...hazards.map((e) => e.x)) + 65;
  for (let frame=0; frame<420; frame+=2) {
    const out = new Map();
    for (const state of states) for (const action of [0,1,2]) {
      const p = Object.assign(new g.player.constructor(), state.p);
      p.duckHeld = action === 2;
      const jumped = action === 1 && p.jump(allowDouble);
      let legal = true;
      for (let sub=1; sub<=2; sub++) {
        p.update(1/60,speeds[frame+sub-1]/60);
        const t = (frame+sub)/60;
        const x = positions[frame+sub];
        const box = p.box(x);
        for (const e of hazards) {
          const b = hitBox({...e,x:e.x+walkSpeed(e.kind)*t});
          if (b && overlaps(box,b)) {legal=false;break;}
        }
        if (!legal) break;
        if (x > end + 18*t) return true;
      }
      if (!legal) continue;
      const cost = state.cost + (jumped ? 1 : 0) + (action===2 ? .001 : 0);
      const key = `${Math.round(p.h/2)},${Math.round(p.vy/15)},${p.jumps},${p.pose=== "duck"}`;
      if (!out.has(key) || out.get(key).cost > cost) out.set(key,{p,cost});
    }
    states = [...out.values()].sort((a,b)=>a.cost-b.cost).slice(0,96);
    if (!states.length) return false;
  }
  return false;
}
let windows = 0;
const windowsAt = [1800,3800,6900, ...Array.from({length:14},(_,i)=>TRAIN_START+i*STATION_LEN+200), DAY_LEN+18000];
for (let seed=1; seed<=20; seed++) for (const at of windowsAt) {
  const g = make(seed * 20261026);
  g.warp(at); g.runTime=180; g.prepLeft=0;
  g.speed=speedAt(at,180);
  const allowDouble = seed%2 === 0;
  if (!allowDouble) g.noDoubleUntil=1000;
  g.nextSpawn = at + 68;
  g.spawn();
  assert.ok(traversable(g,allowDouble), `unsolved generated window seed=${seed}, at=${at}, double=${allowDouble}`);
  windows++;
  g.dispose();
}
// Boundary windows exercise both sides of each area lift with/without double
// jump. Include the first gate files and each bridge walkway's entry/exit.
const boundaryAt=[
  ...STAGES.slice(1).flatMap(s=>[s.start-180,s.start-100,s.start+60,s.start+170]),
  ...TRAVELATORS.flatMap(([start,end])=>[start-80,end-80]),
];
let boundaryWindows=0;
for (let seed=1; seed<=8; seed++) for (const at of boundaryAt) for (const allowDouble of [false,true]) {
  const g=make(seed*4099);
  g.warp(at); g.runTime=180; g.prepLeft=0; g.speed=speedAt(at,180);
  if (!allowDouble) g.noDoubleUntil=1000;
  g.nextSpawn=at+68;
  g.spawn();
  assert.ok(traversable(g,allowDouble), `unsolved boundary window seed=${seed}, at=${at}, double=${allowDouble}`);
  boundaryWindows++;
  g.dispose();
}
// Explicit whole-file fixtures prove an early 3-child double jump and the
// single-jump fallback, not just each child's individual collision box.
for (const [at,count,allowDouble] of [[1760,3,true],[1760,2,false],[4300,3,false],[18000,3,false]]) {
  const g=make(39);
  g.warp(at); g.runTime=180; g.speed=speedAt(at,180);
  g.entities=Array.from({length:count},(_,i)=>g.make("kid",at+68+i*11,0,.2+i*.17));
  assert.ok(traversable(g,allowDouble), `whole child file at=${at} count=${count} double=${allowDouble}`);
  g.dispose();
}

// Spawn complete routes without collisions only to audit content distribution.
// Passability is independently tested above with actual player boxes and physics.
let permitsGenerated = 0, threeKidFiles = 0;
const threeKidFilesByArea=Array.from({length:5},()=>0);
const trainPeopleByStation = Array.from({length:14},()=>0);
for (let seed=1; seed<=40; seed++) {
  const g = make(seed*3571);
  g.runTime=180;
  g.prepLeft=0;
  const seen = new Set();
  const permits = [];
  const kids = [];
  for (let at=52; at<DAY_LEN*2; at+=40) {
    g.distance=at; g.cam=at-52; g.speed=speedAt(at,180);
    g.spawn();
    for (const e of g.entities) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (e.kind==="permit") permits.push(e.x);
      if (e.kind==="kid") kids.push(e.x);
      const local=e.x%DAY_LEN;
      if (local>=TRAIN_START && ["walker","office","luggage","kid","elder","inspector","staff","queue"].includes(e.kind)) {
        trainPeopleByStation[Math.min(13,Math.floor((local-TRAIN_START)/STATION_LEN))] += e.kind==="queue" ? 3 : 1;
      }
      if (e.kind==="caution") assert.ok(STAGES.slice(0,2).some((s)=>e.x%DAY_LEN>=s.start && e.x%DAY_LEN<s.end), `wet floor outside checkpoint ${e.x}`);
    }
  }
  for (const day of [0,1]) assert.ok(permits.filter(x=>Math.floor(x/DAY_LEN)===day).length<=2, `permit daily cap seed=${seed}`);
  for (let i=1; i<permits.length; i++) assert.ok(permits[i]-permits[i-1]>=2400, `permit chain seed=${seed}`);
  for (let i=2; i<kids.length; i++) if (Math.abs(kids[i]-kids[i-1]-11)<.001 && Math.abs(kids[i-1]-kids[i-2]-11)<.001) {
    threeKidFiles++;
    threeKidFilesByArea[STAGES.findIndex(s=>kids[i]%DAY_LEN>=s.start && kids[i]%DAY_LEN<s.end)]++;
  }
  permitsGenerated+=permits.length;
  g.dispose();
}
assert.ok(permitsGenerated>0, "rare permits still appear");
assert.ok(threeKidFiles>=300, `three-child files should appear regularly: ${threeKidFiles}`);
assert.ok(threeKidFilesByArea[0]===0 && threeKidFilesByArea[1]>50 && threeKidFilesByArea[2]>100, `early gate/bridge files: ${JSON.stringify(threeKidFilesByArea)}`);
const earlyTrainPeople=trainPeopleByStation.slice(0,3).reduce((a,b)=>a+b,0);
const lateTrainPeople=trainPeopleByStation.slice(-3).reduce((a,b)=>a+b,0);
assert.ok(lateTrainPeople>earlyTrainPeople*1.08, `late stations must look busier: ${JSON.stringify(trainPeopleByStation)}`);
// Explicit seat failure fixture: all already-generated foreground groups are cleared.
const losing = make(21);
losing.distance = 11000; losing.cam = 11000-52; losing.speed = 96; losing.prepLeft=0;
losing.entities = [0,11,22].map((d) => losing.make("kid",11035+d,0,.1));
losing.beginSeat(); losing.seat.done=true; losing.seat.won=false; losing.seatHold=0;
losing.tickSeat(1/60);
assert.equal(losing.entities.length,0);
assert.equal(losing.canDouble(),false);
losing.playTime = losing.noDoubleUntil;
assert.equal(losing.canDouble(),true);
losing.dispose();
console.log("engine ok", JSON.stringify({distances:distances.map(x=>Math.round(x)), routeNoCollision:times, searchedObstacleWindows:windows,boundaryWindows,contentAudit:{routes:80,permitsGenerated,threeKidFiles,threeKidFilesByArea,trainPeopleByStation}, normalCollisionSeeds:runs}));
