import { readFileSync, existsSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const needed = ["og.png", "favicon.svg", "favicon.png", "apple-touch-icon.png"];
const missing = needed.filter((name) => !existsSync(new URL(`../public/${name}`, import.meta.url)));
if (missing.length) {
  console.error("missing public files:", missing.join(", "));
  process.exit(1);
}
for (const name of ["og.png", "favicon.svg", "favicon.png", "apple-touch-icon.png"]) {
  if (!html.includes(name)) {
    console.error("index.html does not reference", name);
    process.exit(1);
  }
}

const og = html.match(/property="og:image" content="([^"]+)"/);
const ogUrl = og?.[1] ?? "";
if (ogUrl.startsWith("/")) {
  console.error("og:image is root-absolute; use a relative path, or a full https URL after the domain is known");
  process.exit(1);
}
if (/^https?:\/\//.test(ogUrl) && !ogUrl.startsWith("https://")) {
  console.error("og:image http URL is not a shareable https address");
  process.exit(1);
}

function pngSize(name) {
  const buf = readFileSync(new URL(`../public/${name}`, import.meta.url));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig) || buf.subarray(12, 16).toString("ascii") !== "IHDR") {
    console.error(name, "is not a decodable PNG");
    process.exit(1);
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const expect = {
  "og.png": [1200, 630],
  "favicon.png": [32, 32],
  "apple-touch-icon.png": [180, 180],
};
for (const [name, [w, h]] of Object.entries(expect)) {
  const size = pngSize(name);
  if (size.w !== w || size.h !== h) {
    console.error(name, "size", size, "expected", w, h);
    process.exit(1);
  }
}

const svg = readFileSync(new URL("../public/og.svg", import.meta.url), "utf8");
if (!svg.includes("深港通勤") || svg.includes("\uFFFD")) {
  console.error("og.svg is not valid utf-8 text");
  process.exit(1);
}
console.log("assets ok");
