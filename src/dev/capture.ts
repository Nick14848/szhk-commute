/** Local recording utility, never an entry in the production build. */
import type { Game } from "../game/engine";

const frame = document.querySelector<HTMLIFrameElement>("#phone")!;
const button = document.querySelector<HTMLButtonElement>("#record")!;
const status = document.querySelector<HTMLElement>("#status")!;
const download = document.querySelector<HTMLAnchorElement>("#download")!;
const playback = document.querySelector<HTMLVideoElement>("#playback")!;
const output = document.querySelector<HTMLCanvasElement>("#export")!;
const outputCtx = output.getContext("2d")!;
let ctx = outputCtx;
const W = 360, H = 640;
let raf = 0;
let objectUrl = "";
const layers = new Map<string, { canvas: HTMLCanvasElement; dirty: boolean }>();
let observeUi: MutationObserver | null = null;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const game = () => (frame.contentWindow as (Window & { __game?: Game }) | null)?.__game;
const doc = () => frame.contentDocument!;
const cs = (el: Element) => frame.contentWindow!.getComputedStyle(el);
const visible = (el: Element) => {
  const style = cs(el);
  return style.display !== "none" && style.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
};
const colorVisible = (color: string) => color !== "transparent" && color !== "rgba(0, 0, 0, 0)";

/** Paint the actual computed DOM rectangles/text over the original game canvas.
 * This avoids screen-sharing permissions and doesn't record any other app/tab.
 */
function paintElement(el: Element) {
  if (!visible(el)) return;
  const style = cs(el);
  const r = el.getBoundingClientRect();
  ctx.save();
  ctx.globalAlpha *= Number(style.opacity) || 0;
  const radius = Math.max(0, parseFloat(style.borderTopLeftRadius) || 0);
  if (colorVisible(style.backgroundColor)) {
    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, radius); ctx.fill();
  }
  for (const [edge, x, y, w, h] of [
    ["Top", r.x, r.y, r.width, parseFloat(style.borderTopWidth)],
    ["Bottom", r.x, r.bottom - parseFloat(style.borderBottomWidth), r.width, parseFloat(style.borderBottomWidth)],
    ["Left", r.x, r.y, parseFloat(style.borderLeftWidth), r.height],
    ["Right", r.right - parseFloat(style.borderRightWidth), r.y, parseFloat(style.borderRightWidth), r.height],
  ] as const) {
    const color = style[`border${edge}Color`];
    if (w > 0 && h > 0 && colorVisible(color)) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  }
  if (style.overflowX === "hidden" || style.overflowX === "auto" || style.overflowY === "hidden" || style.overflowY === "auto") {
    ctx.beginPath(); ctx.rect(r.x, r.y, r.width, r.height); ctx.clip();
  }
  if (el.tagName === "CANVAS") {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(el as HTMLCanvasElement, r.x, r.y, r.width, r.height);
  } else {
    if (el.id === "rail") paintRoute(el);
    for (const node of el.childNodes) {
      if (node.nodeType === 1) paintElement(node as Element);
      else if (node.nodeType === 3 && node.textContent?.trim()) {
        const range = doc().createRange(); range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        ctx.fillStyle = style.color;
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.textBaseline = "alphabetic";
        const size = parseFloat(style.fontSize);
        const metrics = ctx.measureText(node.textContent);
        const ascent = metrics.fontBoundingBoxAscent || size * .9;
        const descent = metrics.fontBoundingBoxDescent || size * .2;
        const y = box.y + (box.height - ascent - descent) / 2 + ascent;
        const stroke = parseFloat(style.getPropertyValue("-webkit-text-stroke-width")) || 0;
        if (stroke) {
          ctx.strokeStyle = style.getPropertyValue("-webkit-text-stroke-color");
          ctx.lineWidth = stroke; ctx.lineJoin = "round";
          ctx.strokeText(node.textContent, box.x, y);
        }
        ctx.fillText(node.textContent, box.x, y);
      }
    }
  }
  ctx.restore();
}

function paintRoute(rail: Element) {
  const stops = [...rail.querySelectorAll<HTMLElement>(".rail-stop")];
  const bounds = rail.getBoundingClientRect();
  ctx.save(); ctx.beginPath(); ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height); ctx.clip();
  stops.forEach((stop, i) => {
    const r = stop.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y - 5;
    if (i < stops.length - 1) {
      ctx.fillStyle = stop.classList.contains("done") ? "#53b7e8" : "#ccd9df";
      ctx.fillRect(x, y - 1, r.width, 3);
    }
    if (stop.classList.contains("clip")) return;
    ctx.fillStyle = stop.classList.contains("now") ? "#103f65" : stop.classList.contains("done") ? "#53b7e8" : "#fff";
    ctx.strokeStyle = "#1f4e71"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

function paint() {
  ctx = outputCtx;
  ctx.setTransform(3, 0, 0, 3, 0, 0);
  ctx.fillStyle = "#f5f5f2"; ctx.fillRect(0, 0, W, H);
  const view = doc().querySelector<HTMLCanvasElement>("#view");
  if (view) { ctx.imageSmoothingEnabled = false; ctx.drawImage(view, 0, 0, W, H); }
  for (const id of ["hud", "pad", "layout-note", "overlay", "paused", "credit"]) {
    const el = doc().getElementById(id);
    if (!el || !visible(el)) continue;
    // HUD and keys change only a few times per second. Repeated computed-style
    // and text-range layout on every video frame needlessly drops capture FPS.
    // The result card has a CSS fade-in: caching its first (transparent) frame
    // would hide it throughout the ending. Menus must remain live-painted.
    if (id === "overlay") { paintElement(el); continue; }
    let layer = layers.get(id);
    if (!layer) {
      const canvas = document.createElement("canvas"); canvas.width = output.width; canvas.height = output.height;
      layer = { canvas, dirty: true }; layers.set(id, layer);
    }
    if (layer.dirty) {
      ctx = layer.canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, output.width, output.height);
      ctx.setTransform(3, 0, 0, 3, 0, 0); paintElement(el);
      layer.dirty = false;
      ctx = outputCtx;
    }
    ctx.drawImage(layer.canvas, 0, 0, W, H);
  }
  ctx.fillStyle = "rgba(249,250,248,.94)"; ctx.fillRect(0, H - 9, W, 9);
  ctx.fillStyle = "#65757e"; ctx.font = '7px "PingFang SC",sans-serif'; ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("桌面模拟手机版 · 自动操作 · 特色片段剪辑", W / 2, H - 4.5);
  ctx.textAlign = "left";
}

async function record(mimeType: string) {
  button.disabled = true;
  download.hidden = playback.hidden = true;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  // Fresh real homepage, followed by the ordinary wake-up/start animation.
  frame.src = "/?debug=1";
  await new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  for (let i = 0; !game() && i < 100; i++) await wait(50);
  if (!game()) throw new Error("游戏开发入口未就绪");
  await doc().fonts.ready;
  layers.clear(); observeUi?.disconnect();
  observeUi = new MutationObserver(() => { for (const layer of layers.values()) layer.dirty = true; });
  observeUi.observe(doc().querySelector("#app")!, { subtree: true, childList: true, characterData: true, attributes: true });
  const stream = output.captureStream(0);
  const videoTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
  const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
  let last = 0;
  const render = (stamp: number) => {
    if (stamp - last >= 1000 / 30 - .5) { paint(); videoTrack.requestFrame(); last = stamp; }
    raf = requestAnimationFrame(render);
  };
  raf = requestAnimationFrame(render);
  recorder.start(1000);
  status.textContent = "录制：首页 → 起床出门";
  await wait(1700);
  doc().querySelector<HTMLButtonElement>(".bed-actions .exit")!.click();
  await wait(2800);
  const clips = [
    { label: "福田口岸 · 跳跃与大水", at: 300, seed: 40522052, sec: 7 },
    { label: "自助通关 · 闸机与安检", at: 1650, seed: 20264598, sec: 8 },
    { label: "深港天桥 · 低头与步行道", at: 3190, seed: 20264598, sec: 9 },
    { label: "落马洲 · 上车转场", at: 7220, seed: 40522052, sec: 7 },
    { label: "东铁线 · 阿婆抢座", at: 10080, seed: 40522052, sec: 10 },
    { label: "后程 · 更密集的通勤人群", at: 22800, seed: 40522052, sec: 7 },
  ];
  for (const clip of clips) {
    const restart = doc().querySelector<HTMLButtonElement>("#overlay.on .exit");
    if (restart?.textContent === "重新开始") restart.click();
    game()!.startCaptureSegment(clip.at, clip.seed);
    status.textContent = `录制：${clip.label}\n正常碰撞 · 1 倍速`;
    await wait(clip.sec * 1000);
  }
  // Natural failure/result, not a fabricated achievement/score sheet.
  const restart = doc().querySelector<HTMLButtonElement>("#overlay.on .exit");
  if (restart?.textContent === "重新开始") restart.click();
  game()!.startCaptureSegment(1700, 20261026);
  game()!.setDebug(false, 1);
  status.textContent = "录制：自然失败与本次成就";
  for (let i = 0; i < 150 && game()!.uiState().phase !== "over"; i++) await wait(100);
  await wait(4000);
  recorder.stop(); await stopped;
  observeUi.disconnect();
  cancelAnimationFrame(raf);
  for (const track of stream.getTracks()) track.stop();
  game()!.pause();
  const blob = new Blob(chunks, { type: mimeType });
  objectUrl = URL.createObjectURL(blob);
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  download.href = objectUrl;
  download.download = `深港通勤_手机版特色演示_2026-10-27.${ext}`;
  download.textContent = `下载 ${ext.toUpperCase()} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
  download.hidden = false;
  playback.src = objectUrl; playback.hidden = false;
  status.textContent = `完成：1080×1920 / 目标 30fps\n${mimeType}\n真实引擎自动操作片段，非手机真机录屏。`;
  if (ext === "mp4") {
    const saved = await fetch("/__local_capture", { method: "POST", headers: { "Content-Type": "video/mp4" }, body: blob });
    if (!saved.ok) throw new Error(`本地保存失败：${await saved.text()}`);
    const artifact = await saved.json() as { path: string };
    status.textContent += `\n已保存到本地：${artifact.path}`;
  }
  button.disabled = false;
}

if (!import.meta.env.DEV) {
  status.textContent = "录制工具仅可在本地开发环境打开。";
} else {
  const codec = ["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  status.textContent = codec ? `可用编码：${codec}\n点击开始录制；请保持页面可见。` : "当前浏览器不支持 Canvas 视频导出。";
  button.disabled = !codec;
  button.addEventListener("click", () => {
    if (!codec) return;
    void record(codec).catch((error: unknown) => {
      cancelAnimationFrame(raf); button.disabled = false;
      status.textContent = `导出失败：${String(error)}`;
    });
  });
}
