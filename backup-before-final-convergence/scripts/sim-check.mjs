import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "szhk-sim-"));
async function bundle(entry, name) {
  const outfile = join(dir, name);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}
const mod = await bundle("src/game/balance.ts", "balance.mjs");
const score = await bundle("src/game/score.ts", "score.mjs");
const copy = await bundle("src/data/copy.ts", "copy.mjs");
rmSync(dir, { recursive: true, force: true });

const fails = [];
const check = (name, ok, detail = "") => {
  if (!ok) fails.push(`${name} ${detail}`);
};

check("scale 1", mod.parseTimeScale(1) === 1);
check("scale 1.1 stays 1", mod.parseTimeScale(1.1) === 1, String(mod.parseTimeScale(1.1)));
check("scale 12", mod.parseTimeScale(12) === 12);
check("scale abc", mod.parseTimeScale(Number("abc")) === 1);
check("scale negative", mod.parseTimeScale(-2) === 1);
check("scale huge", mod.parseTimeScale(99) === 1);

const frames = (hz, seconds) => {
  const dt = 1 / hz;
  return Array.from({ length: Math.round(hz * seconds) }, () => dt);
};
const a = mod.integrate(frames(30, 10));
const b = mod.integrate(frames(60, 10));
const c = mod.integrate(frames(120, 10));
const hi = Math.max(a.distance, b.distance, c.distance);
const lo = Math.min(a.distance, b.distance, c.distance);
check("30/60/120 distance", (hi - lo) / b.distance < 0.01, JSON.stringify({ a, b, c }));
check(
  "30/60/120 sim time",
  Math.abs(a.sim - b.sim) / b.sim < 0.01 && Math.abs(c.sim - b.sim) / b.sim < 0.01,
  JSON.stringify({ a: a.sim, b: b.sim, c: c.sim }),
);

const hitch = mod.integrate([0.5]);
check("long frame is capped", hitch.sim <= 4 / 60 + 1e-6, JSON.stringify(hitch));

check("walker can be single-jumped at ease speed", mod.canClear("walker", 62, false) === true);
check("queue needs the second jump at ease speed", mod.canClear("queue", 62, false) === false);
check("queue is allowed when double jump is available", mod.canClear("queue", 62, true) === true);
check("sign is ducked, not a jump test", mod.canClear("sign", 62, false) === true);
check("boarding snap stays small", mod.boardingLanding(1000, 1010) === 1012);
check("boarding far away does not snap", mod.boardingLanding(1000, 1200) === null);

const ease = mod.speedAt(80, 1);
check("ease speed is not the old viewport-scaled value", ease > 55 && ease < 85, String(ease));
check("speed function does not take a view width", mod.speedAt.length === 2);
const raw = score.distancePoints(1000, 1) + score.pickupPoints(25, 1) * 4 + score.pickupPoints(60, 1);
check("unscaled example is 240", raw === 240, String(raw));
check("floor score", score.finalScore(raw) === 240);
check("concession doubles points", score.pickupPoints(25, 2) === 50 && score.multiplier(true) === 2 && score.multiplier(false) === 1);
check("a bottle always counts as one", score.bottlesGained() === 1);
check("frozen distance scores nothing", score.distancePoints(0, 4) === 0);
for (const [n, name] of [
  [299, "深漂萌新"],
  [300, "通勤小白"],
  [699, "通勤小白"],
  [700, "大水"],
  [1199, "大水"],
  [1200, "薄肌"],
  [2199, "薄肌"],
  [2200, "深港双城卷王"],
  [3999, "深港双城卷王"],
  [4000, "八达通永动机"],
]) {
  check(`title ${n}`, copy.titleFor(n).name === name, copy.titleFor(n).name);
}

const phone = mod.speedAt(400, 3);
const desktop = mod.speedAt(400, 3);
check("same world position gives the same speed", phone === desktop, `${phone} ${desktop}`);

if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}
console.log(
  "sim ok",
  JSON.stringify({
    d30: Math.round(a.distance),
    d60: Math.round(b.distance),
    d120: Math.round(c.distance),
    ease: Math.round(ease * 10) / 10,
    hitchSim: Math.round(hitch.sim * 1000) / 1000,
  }),
);
