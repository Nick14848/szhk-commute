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
const stages = await bundle("src/game/stages.ts", "stages.mjs");
const view = await bundle("src/render/view.ts", "view.mjs");
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
  [0, "通勤小白"],
  [299, "通勤小白"],
  [300, "渐入佳境"],
  [699, "渐入佳境"],
  [700, "深港双城卷王"],
  [1199, "深港双城卷王"],
  [1200, "大水教父"],
  [2199, "大水教父"],
  [2200, "薄肌教父"],
  [3999, "薄肌教父"],
  [4000, "版本答案"],
]) {
  check(`title ${n}`, copy.titleFor(n).name === name, copy.titleFor(n).name);
}

check("buff seconds", mod.SEAT_WIN_SEC === 6 && mod.SEAT_LOSE_SEC === 8);
check("water points stay one bottle", score.pickupPoints(25, 2) === 50 && score.bottlesGained() === 1);
check("octopus points", score.pickupPoints(60, 1) === 60 && score.pickupPoints(60, 2) === 120);

const far = copy.mergeRecord({ v: 1, bestScore: 1660, bestStation: "九龙塘", bestDay: 1, bestProgress: 1000 }, 40, 200, "福田口岸", 2);
check("score and progress stay independent", far.bestScore === 1660 && far.bestProgress === 1000 && far.bestStation === "九龙塘");
const farther = copy.mergeRecord(far, 40, 5000, "上水", 1);
check("farther progress updates place", farther.bestScore === 1660 && farther.bestProgress === 5000 && farther.bestStation === "上水");
check("bad save rejected", copy.normalizeSave({ bestScore: -1, bestStation: "九龙塘" }) === null);
check("old save kept", copy.normalizeSave({ bestScore: 10, bestStation: "九龙塘", bestDay: 1 })?.bestProgress === undefined);

const legacy = stages.legacyProgress("九龙塘", 1);
const gold = stages.legacyProgress("金钟", 1);
check("legacy station is a start not a full run", legacy < gold && legacy > 0, `${legacy} ${gold}`);
check("unknown station does not invent a terminus", stages.legacyProgress("不存在", 1) === 0);

function stageFits(cssW, cssH, dpr, coarse) {
  const v = view.computeView(cssW, cssH, dpr, 0, 0, coarse, 40);
  const again = view.computeView(cssW, cssH, dpr, 0, 0, coarse, 200);
  const deviceW = cssW * dpr;
  return v.offsetX >= -0.01 && v.offsetX + v.W * v.pd <= deviceW + 0.01 && v.pd === again.pd && v.offsetX === again.offsetX && v.offsetY === again.offsetY;
}
check("390x844 full world", stageFits(390, 844, 2, true));
check("844x390 full world", stageFits(844, 390, 2, true));
check("1280x720 full world", stageFits(1280, 720, 2, false));
check("320x568 full world", stageFits(320, 568, 2, true));

function stageCssWidth(cssW) {
  const v = view.computeView(cssW, 900, 1, 0, 0, true, 0);
  return v.W * v.pd;
}
const nearA = stageCssWidth(383);
const nearB = stageCssWidth(384);
check("nearby phone widths stay close", nearB / nearA < 1.08 && nearA <= 383.01 && nearB <= 384.01, `${nearA} ${nearB}`);

const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => (mem.has(key) ? mem.get(key) : null),
  setItem: (key, value) => {
    if (globalThis.localStorage.failWrite) throw new Error("write failed");
    mem.set(key, String(value));
  },
  removeItem: (key) => mem.delete(key),
};
const key = copy.SAVE_KEY;
function readTen(raw) {
  copy.clearSessionRecord();
  mem.set(key, JSON.stringify(raw));
  let last = null;
  for (let i = 0; i < 10; i++) last = copy.loadSave();
  return last;
}
const kowloon = readTen({ bestScore: 1660, bestStation: "九龙塘", bestDay: 1 });
check("legacy read stays unresolved", kowloon?.bestStation === "九龙塘" && kowloon.bestProgress === undefined && kowloon.bestScore === 1660);
const hung = readTen({ bestScore: 800, bestStation: "紅磡" });
check("traditional station survives rereads", hung?.bestStation === "紅磡" && hung.bestDay === 1 && hung.bestProgress === undefined);
copy.clearSessionRecord();
mem.set(key, "{");
check("bad json does not invent a record", copy.loadSave() === null);
const legacyKowloon = stages.legacyProgress("九龙塘", 1);
copy.clearSessionRecord();
mem.set(key, JSON.stringify({ bestScore: 1660, bestStation: "九龙塘", bestDay: 1 }));
for (let i = 0; i < 10; i++) copy.loadSave();
const afterShort = copy.commitRun(40, 200, "福田口岸", 1, stages.legacyProgress);
const reread = copy.loadSave();
check(
  "short run does not replace kowloon",
  afterShort.bestStation === "九龙塘" && afterShort.bestScore === 1660 && afterShort.bestProgress === legacyKowloon && reread.bestStation === "九龙塘",
  JSON.stringify(afterShort),
);
copy.clearSessionRecord();
mem.set(key, JSON.stringify({ bestScore: 10, bestStation: "不存在", bestDay: 1 }));
const unknown = copy.commitRun(40, 200, "福田口岸", 1, stages.legacyProgress);
check("unknown station stays conservative", unknown.bestScore === 40 && unknown.bestProgress === 200 && unknown.bestStation === "福田口岸");
copy.clearSessionRecord();
mem.set(key, JSON.stringify({ bestScore: 1660, bestStation: "九龙塘", bestDay: 1 }));
copy.loadSave();
globalThis.localStorage.failWrite = true;
const kept = copy.commitRun(3000, 20000, "金钟", 2, stages.legacyProgress);
globalThis.localStorage.failWrite = false;
const disk = JSON.parse(mem.get(key));
const afterFail = copy.loadSave();
check("failed write keeps the session record", disk.bestStation === "九龙塘" && disk.bestProgress === undefined);
check(
  "old disk does not roll the session back",
  kept.bestScore === 3000 && kept.bestProgress === 20000 && afterFail.bestScore === 3000 && afterFail.bestStation === "金钟",
  JSON.stringify(afterFail),
);

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
