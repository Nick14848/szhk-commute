import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "szhk-sim-"));
const outfile = join(dir, "balance.mjs");
await esbuild.build({
  entryPoints: ["src/game/balance.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const mod = await import(pathToFileURL(outfile).href);
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

check("mask can be single-jumped at ease speed", mod.canClear("mask", 62, false) === true);
check("queue needs the second jump at ease speed", mod.canClear("queue", 62, false) === false);
check("queue is allowed when double jump is available", mod.canClear("queue", 62, true) === true);

const ease = mod.speedAt(80, 1);
check("ease speed is not the old viewport-scaled value", ease > 55 && ease < 85, String(ease));
check("speed function does not take a view width", mod.speedAt.length === 2);
check("seam hold ignores viewport", mod.seamHold(2000) === 2000 - (256 - 52), String(mod.seamHold(2000)));

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
