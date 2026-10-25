// Read-only audit of the current source through a synthetic host.
// Not a browser, renderer certification, human playthrough, or mobile-device test.
// No real localStorage, audio, network, or game-source writes are performed.
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
globalThis.document = {
  hidden: false,
  createElement: canvas,
  getElementById: () => null,
  querySelector: () => null,
  documentElement: { dataset: {}, style: { setProperty: noop } },
};
globalThis.window = {
  devicePixelRatio: 1, addEventListener: noop, removeEventListener: noop,
  matchMedia: () => ({ matches: false }),
};
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = noop;
const bundle = await esbuild.build({
  stdin: {
    contents: 'export {Game} from "./src/game/engine.ts"; export {Player} from "./src/game/player.ts"; export * from "./src/game/balance.ts"; export * from "./src/game/stages.ts";',
    resolveDir: process.cwd(),
  }, bundle: true, write: false, format: 'esm', platform: 'node',
  define: { 'import.meta.env.DEV': 'false' },
});
const m = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function run() {
  const g = new m.Game(canvas());
  g.audio.muted = true;
  g.seeded = true;
  g.seed = 20261025;
  g.start();
  g.nextSpawn = Infinity; // Explicitly disable obstacles for isolated clock/physics checks.
  return g;
}
function actualLoop(hz) {
  const g = run();
  const inputs = [1.0, 1.35, 3.0, 3.35];
  let next = 0;
  g.loop(1000);
  for (let frame = 1; frame <= hz * 10; frame++) {
    const t = frame / hz;
    while (next < inputs.length && t >= inputs[next]) { g.press(); next++; }
    g.loop(1000 + t * 1000);
  }
  const r = { hz, distance: g.distance, score: g.score, playTime: g.playTime, simTime: g.simTime };
  g.dispose();
  return r;
}
const results = { host: 'synthetic/no rendering or human/device verification', actualGameLoopNoObstacles: [30, 60, 120].map(actualLoop) };
{
  const p = new m.Player();
  p.reset(); p.holdJump(true);
  for (let i = 0; i < 24; i++) p.update(m.STEP, 1);
  p.holdJump(true);
  let highest = p.h;
  for (let i = 0; i < 45; i++) { p.update(m.STEP, 1); highest = Math.max(highest, p.h); }
  results.doubleJump = {
    maxFootHeight: highest,
    headTopLocalY: m.GROUND_Y - highest - 33,
    translatedClipStillBeginsAtLocalY: 0,
    cameraLiftAtPeak: Math.max(0, 8 - (m.GROUND_Y - highest - 36)),
  };
}
{
  const g = run(); g.prepLeft = 0;
  g.noDoubleUntil = 8; g.permitUntil = 4; g.doubleUntil = 8; g.seatSafeUntil = 6;
  const before = JSON.stringify([g.distance, g.playTime, g.time, g.score]);
  g.pause();
  for (let i = 0; i < 600; i++) g.step(m.STEP);
  results.pauseFreezesClock = before === JSON.stringify([g.distance, g.playTime, g.time, g.score]);
  g.resume();
  for (let i = 0; i < 240; i++) g.step(m.STEP);
  results.afterFourActiveSeconds = { playTime: g.playTime, chips: g.hudModel().chips.map((c) => c.text) };
  g.dispose();
}
results.seat = [];
for (const won of [true, false]) {
  const g = run(); g.prepLeft = 0;
  g.beginSeat(); g.seat.done = true; g.seat.won = won; g.seatHold = 0;
  g.step(m.STEP);
  results.seat.push({ won, phase: g.phase, playTime: g.playTime, shieldUntil: g.seatSafeUntil, noDoubleUntil: g.noDoubleUntil, chips: g.hudModel().chips.map((c) => c.text) });
  g.dispose();
}
{
  const g = run(); g.prepLeft = 0; g.doubleUntil = 8;
  const water = { kind: 'water', x: g.distance, y: 0, phase: 0, travel: 0 };
  g.entities = [water]; g.collide(); g.collide();
  results.waterWithDeal = { score: g.score, bottles: g.waters, taken: water.taken };
  g.dispose();
}
{
  const g = run(); g.prepLeft = 0;
  g.runTime = 60; g.distance = m.TRAIN_START - 8; g.cam = g.distance - m.PLAYER_VIEW_X;
  g.syncLocation(true);
  let maxSnap = 0, pauseFrames = 0;
  for (let i = 0; i < 180; i++) {
    const before = g.distance;
    const boarded = Boolean(g.board);
    g.step(m.STEP);
    if (boarded) { pauseFrames++; maxSnap = Math.max(maxSnap, g.distance - before); }
  }
  results.boarding = { boardedDay: g.boardedDay, pauseFrames, maxSnap, phase: g.phase, world: g.distance, errors: g.errors };
  g.dispose();
}
console.log(JSON.stringify(results, null, 2));
