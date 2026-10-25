// Read-only inspection of current Game/Player behavior in a synthetic host.
// This is not browser rendering, a human playthrough, or a mobile-device test.
import esbuild from 'esbuild';
const noop = () => {};
function canvas() {
  const c = { clientWidth: 1280, clientHeight: 720, width: 1280, height: 720, addEventListener: noop, removeEventListener: noop };
  c.ctx = new Proxy({ canvas: c, measureText: (s) => ({ width: String(s).length * 7 }) }, {
    get: (o, k) => k in o ? o[k] : noop,
    set: (o, k, v) => (o[k] = v, true),
  });
  c.getContext = () => c.ctx;
  return c;
}
const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
globalThis.document = { hidden: false, createElement: canvas, getElementById: () => null, querySelector: () => null, documentElement: { dataset: {}, style: { setProperty: noop } } };
globalThis.window = { devicePixelRatio: 1, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false }) };
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = noop;
const bundle = await esbuild.build({
  stdin: { contents: 'export {Game} from "./src/game/engine.ts"; export {Player} from "./src/game/player.ts"; export * from "./src/game/balance.ts"; export * from "./src/game/stages.ts"; export {hitBox,overlaps} from "./src/game/entities.ts"; export {loadSave,mergeRecord} from "./src/data/copy.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env.DEV': 'false' },
});
const m = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function run(seed = 20261025) {
  const g = new m.Game(canvas());
  g.audio.muted = true; g.seeded = true; g.seed = seed; g.start();
  return g;
}
const result = { scope: 'current source; synthetic host; no real browser/storage/audio/network writes' };
result.camera = [];
for (const hz of [30, 60, 120]) {
  const g = run(); g.prepLeft = 0; g.nextSpawn = Infinity;
  let minimumHead = Infinity, peak = 0, doubled = false, cutFrames = 0;
  for (let f = 0; f < hz * 2; f++) {
    if (f === 0) g.press();
    if (!doubled && f / hz >= 0.4) { g.press(); doubled = true; }
    if (f === 0) g.loop(1000);
    g.loop(1000 + (f + 1) * 1000 / hz);
    const top = m.GROUND_Y - g.player.h - 33 + g.viewLift;
    minimumHead = Math.min(minimumHead, top);
    peak = Math.max(peak, g.player.h);
    if (top < 0) cutFrames++;
  }
  result.camera.push({ hz, minimumHead, peakFootHeight: peak, cutFrames }); g.dispose();
}
// Search deterministic seeds for the new spawn branch in the gates area.
result.spawnSamples = [];
for (const x of [2000, 2800, m.TRAIN_START + 4 * m.STATION_LEN]) {
  let files = 0, triples = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = run(seed); g.prepLeft = 0; g.runTime = 60;
    g.distance = x - 100; g.cam = g.distance - m.PLAYER_VIEW_X; g.nextSpawn = x;
    g.spawn();
    const kids = g.entities.filter(e => e.kind === 'kid' && e.x >= x && e.x <= x + 22);
    if (kids.length >= 2 && Math.abs(kids[1].x - kids[0].x - 11) < 1e-8) files++;
    if (kids.length === 3) triples++;
    g.dispose();
  }
  result.spawnSamples.push({ x, stage:m.segmentAt(x).id, seeds:200, files, triples });
}
// Brute force actual single-jump clearance against the whole 3-child file.
function singleJumpFile(speed) {
  for (let lead = 6; lead <= 60; lead += 0.5) {
    const p = new m.Player(); p.reset(); p.holdJump(false);
    let px = 0;
    const kids = [0, 11, 22].map(dx => ({kind:'kid', x: lead + dx, y:0, phase:0,travel:0}));
    let ok = true;
    for (let n = 0; n < 180; n++) {
      px += speed * m.STEP; p.update(m.STEP, speed * m.STEP);
      for (const e of kids) {
        e.x += m.npcSpeed('kid') * m.STEP;
        if (m.overlaps(p.box(px), m.hitBox(e))) { ok = false; break; }
      }
      if (!ok) break;
      if (px - 6 > kids[2].x + 4) return {clear:true, jumpLead:lead};
    }
  }
  return {clear:false};
}
result.childFileJump = [86, 96, 102].map(speed=>({speed,singleJump:singleJumpFile(speed),estimatedDoubleClear:m.kidFileClear(3,speed)}));
// Confirm collision widths leave no space for a 12-wide player between children.
result.fileGap = { centers:11, childBodyWidth:8, emptyGap:3, playerWidth:12 };
{
  const g = run(); g.prepLeft = 0; g.nextSpawn = Infinity;
  g.loop(1000);
  for(let f=1;f<=33;f++) {
    if(f===1 || f===25) g.press();
    g.loop(1000+f*1000/60);
  }
  const before = {height:g.player.h,lift:g.viewLift,world:g.distance};
  g.pause();
  g.loop(1000+34*1000/60);
  const after = {height:g.player.h,lift:g.viewLift,world:g.distance};
  result.firstPausedFrame = {before,after,worldFrozen:before.world===after.world,cameraDelta:after.lift-before.lift};
  g.dispose();
}
{
  memory.set('szhk-commute-v1',JSON.stringify({bestScore:1660,bestStation:'九龙塘',bestDay:1}));
  const firstRead=m.loadSave();
  const secondRead=m.loadSave();
  const effectiveProgress=secondRead.bestProgress ?? m.legacyProgress(secondRead.bestStation,secondRead.bestDay);
  const afterShortRun=m.mergeRecord({...secondRead,bestProgress:effectiveProgress},40,200,'福田口岸',1);
  result.legacyRecordReads={firstRead,secondRead,expectedLegacyProgress:m.legacyProgress('九龙塘',1),effectiveProgress,afterShortRun};
}
console.log(JSON.stringify(result,null,2));
