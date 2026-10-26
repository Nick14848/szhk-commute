import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "szhk-ui-"));
try {
  const outfile = join(dir, "native.mjs");
  await esbuild.build({ entryPoints: ["src/ui/nativeInput.ts"], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent" });
  const { suppressNativeSelection } = await import(pathToFileURL(outfile).href);
  const doc = new EventTarget();
  const app = new EventTarget();
  const pad = new EventTarget();
  const canvas = new EventTarget();
  const inside = {};
  let cleared = 0;
  let selection = { isCollapsed: true };
  doc.getSelection = () => selection;
  app.ownerDocument = doc;
  app.contains = (node) => node === inside;
  const dispose = suppressNativeSelection(app, [pad, canvas]);
  const canceled = (target, type) => !target.dispatchEvent(new Event(type, { cancelable: true }));
  for (const type of ["contextmenu", "selectstart", "dragstart", "copy"]) assert(canceled(app, type), `${type} blocked across the app`);
  assert(canceled(pad, "touchstart") && canceled(canvas, "touchstart"), "native touch defaults canceled only on play surfaces");
  assert(!canceled(app, "touchstart"), "menus/route retain native scrolling");
  selection = { isCollapsed: false, anchorNode: inside, removeAllRanges: () => cleared++ };
  doc.dispatchEvent(new Event("selectionchange"));
  assert.equal(cleared, 1, "nearest HUD text selection cleared");
  selection.anchorNode = {};
  doc.dispatchEvent(new Event("selectionchange"));
  assert.equal(cleared, 1, "outside selection left alone");
  dispose();
  assert(!canceled(app, "contextmenu") && !canceled(pad, "touchstart"), "HMR disposal removes guards");

  const html = readFileSync("index.html", "utf8");
  assert.match(html, /id="btn-duck"[^>]*>蹲<\/button>/);
  assert.match(html, /id="btn-jump"[^>]*>跳<\/button>/);
  assert.match(html, /class="pause-icon" aria-hidden="true"/);
  const css = readFileSync("src/style.css", "utf8");
  assert.match(css, /#app, #app \* \{[^}]*-webkit-user-select: none;[^}]*-webkit-touch-callout: none;/);

  // Render the real result builder with a tiny DOM, checking every tier boundary.
  const screenFile = join(dir, "screens.mjs");
  await esbuild.build({ entryPoints: ["src/ui/screens.ts"], bundle: true, format: "esm", platform: "node", outfile: screenFile, logLevel: "silent",
    plugins: [{ name: "isolate-bedroom-renderer", setup(build) {
      build.onResolve({ filter: /render\/bedroom$/ }, () => ({ path: "bedroom", namespace: "ui-test" }));
      build.onLoad({ filter: /.*/, namespace: "ui-test" }, () => ({ contents: "export function showBedroom() {}" }));
    } }],
  });
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.textContent = ""; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener() {}
    focus() {}
  }
  globalThis.document = { createElement: (tag) => new Node(tag) };
  const { showResult } = await import(pathToFileURL(screenFile).href);
  const all = (node) => [node, ...node.children.flatMap(all)];
  for (const [score, title] of [[0, "通勤小白"], [300, "渐入佳境"], [700, "深港通勤"], [1200, "大水教父"], [2200, "薄肌教父"], [4000, "版本答案"]]) {
    const overlay = new Node("div");
    overlay.classList = { add() {} };
    showResult(overlay, { score, best: 5000, waters: 1 }, () => {});
    const tree = all(overlay);
    assert.equal(tree.filter((n) => n.tagName === "li").length, 6);
    const current = tree.find((n) => n.attributes["aria-current"] === "true");
    assert(current.children.some((n) => n.textContent === title));
    assert(tree.some((n) => n.textContent === "0–299 分"));
    assert(tree.some((n) => n.textContent === "4000+ 分"));
    assert.equal(overlay.scrollTop, 0);
  }
  delete globalThis.document;
  console.log("UI checks passed: app-wide selection guard, native-touch defaults, single-word keys, pause icon, six achievement bands.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
