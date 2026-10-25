import { UI, loadSave } from "../data/copy";
import { prefersReducedMotion } from "../design/tokens";
import { PAL, actorFrame, drawAnchored } from "./sprites";

type Phase = "sleep" | "alarm" | "wake" | "walk" | "leave";

type Audio = { resume: () => void; alarm: () => void };

let timer = 0;
let running = false;

export function cancelBedroom() {
  running = false;
  if (timer) cancelAnimationFrame(timer);
  timer = 0;
}

/** 首次打开的出租屋。返回取消函数。 */
export function showBedroom(
  overlay: HTMLElement,
  audio: Audio,
  onBegin: () => void,
  sound: { label: () => string; toggle: () => void },
) {
  cancelBedroom();
  const save = loadSave();
  const reduced = prefersReducedMotion();
  const screen = document.createElement("main");
  screen.className = "screen bedroom";
  const canvas = document.createElement("canvas");
  canvas.className = "room";
  const title = document.createElement("h1");
  title.textContent = UI.titleTrad;
  const by = document.createElement("p");
  by.className = "sign-by";
  by.textContent = UI.by;
  const start = document.createElement("button");
  start.type = "button";
  start.className = "exit";
  start.textContent = UI.start;
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = save ? UI.best(save.bestScore, save.bestStation) : UI.noRecord;
  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "link";
  mute.textContent = sound.label();
  mute.addEventListener("click", () => {
    sound.toggle();
    mute.textContent = sound.label();
  });
  screen.append(canvas, title, by, start, meta, mute);
  overlay.replaceChildren(screen);
  overlay.classList.add("on");

  const ctx = canvas.getContext("2d");
  if (!ctx) return cancelBedroom;
  let phase: Phase = "sleep";
  let startedAt = 0;
  let begun = false;
  running = true;

  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, overlay.clientWidth);
    const h = Math.max(1, Math.min(overlay.clientHeight, 640));
    const viewH = Math.min(360, Math.max(220, h * 0.5));
    canvas.style.width = `${Math.min(w, 720)}px`;
    canvas.style.height = `${viewH}px`;
    canvas.width = Math.round(Math.min(w, 720) * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (now: number) => {
    if (!running) return;
    fit();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 8 || h < 8) {
      timer = requestAnimationFrame(draw);
      return;
    }
    const t = startedAt ? (now - startedAt) / 1000 : 0;
    if (phase === "alarm" && t > (reduced ? 0.4 : 0.8)) phase = "wake";
    if (phase === "wake" && t > (reduced ? 0.7 : 1.6)) phase = "walk";
    if (phase === "walk" && t > (reduced ? 1.1 : 2.6)) phase = "leave";
    if (phase === "leave" && t > (reduced ? 1.4 : 3.2) && !begun) {
      begun = true;
      running = false;
      onBegin();
      return;
    }

    ctx.fillStyle = "#E7D3B4";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#C4A27A";
    ctx.fillRect(0, h * 0.72, w, h);
    ctx.fillStyle = "#8EBFDA";
    const winX = w * 0.62;
    const winY = h * 0.12;
    const winW = Math.min(160, w * 0.28);
    const winH = h * 0.34;
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = "#F4E7D2";
    ctx.lineWidth = 6;
    ctx.strokeRect(winX - 3, winY - 3, winW + 6, winH + 6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(winX, winY, winW, winH);
    ctx.clip();
    ctx.fillStyle = "#D5E4C4";
    ctx.fillRect(winX, winY + winH * 0.62, winW, winH);
    const walk = Math.floor(now / 180);
    ctx.imageSmoothingEnabled = false;
    const passer = actorFrame(walk % 2 === 0 ? "kid" : "walker", walk, "walk");
    const px = winX + ((now / 40) % (winW + 40)) - 20;
    drawAnchored(ctx, passer, px, winY + winH * 0.78);
    ctx.restore();

    const bedX = w * 0.08;
    const bedY = h * 0.62;
    const bedW = Math.min(340, w * 0.5);
    ctx.fillStyle = "#F7F1E6";
    ctx.fillRect(bedX, bedY - 18, bedW, 16);
    ctx.fillStyle = "#8E5A3C";
    ctx.fillRect(bedX - 6, bedY, bedW + 12, 28);
    ctx.fillStyle = "#F4F7FB";
    ctx.fillRect(bedX + 8, bedY - 8, bedW * 0.55, 22);

    const clockX = bedX + bedW + 28;
    const shake = phase === "alarm" && !reduced ? Math.sin(now / 40) * 3 : 0;
    ctx.fillStyle = "#243044";
    ctx.fillRect(clockX + shake, bedY - 36, 54, 28);
    ctx.fillStyle = "#F2C230";
    ctx.font = "700 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("08:00", clockX + 27 + shake, bedY - 22);

    ctx.imageSmoothingEnabled = false;
    if (phase === "sleep" || phase === "alarm") {
      ctx.save();
      ctx.translate(bedX + 28, bedY - 8);
      ctx.scale(3, 3);
      drawSleeper(ctx, 0, 0);
      ctx.restore();
    } else if (phase === "wake") {
      drawAnchored(ctx, actorFrame("player", 0, "idle"), bedX + bedW * 0.45, bedY + 26);
    } else {
      const step = Math.floor(t * 8);
      const x = bedX + bedW * 0.45 + (phase === "leave" ? w * 0.35 : (t - 1.6) * 80);
      drawAnchored(ctx, actorFrame("player", step, "walk"), Math.min(w - 20, x), h * 0.72);
    }

    if (phase === "leave") {
      ctx.fillStyle = `rgba(231, 211, 180, ${Math.min(1, (t - 2.6) / 0.5)})`;
      ctx.fillRect(0, 0, w, h);
    }
    timer = requestAnimationFrame(draw);
  };
  const onHide = () => {
    if (!running) return;
    if (document.hidden) {
      if (timer) cancelAnimationFrame(timer);
      timer = 0;
    } else if (!timer) {
      timer = requestAnimationFrame(draw);
    }
  };
  document.addEventListener("visibilitychange", onHide);
  const stop = () => {
    document.removeEventListener("visibilitychange", onHide);
    cancelBedroom();
  };
  timer = requestAnimationFrame(draw);

  start.addEventListener("click", () => {
    if (startedAt) return;
    try {
      audio.resume();
      audio.alarm();
    } catch {
      /* 音频失败也不挡住起床 */
    }
    startedAt = performance.now();
    phase = reduced ? "wake" : "alarm";
    start.disabled = true;
  });

  return stop;
}

function drawSleeper(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = PAL.out;
  ctx.beginPath();
  ctx.arc(x + 10, y - 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.skin;
  ctx.beginPath();
  ctx.arc(x + 10, y - 6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.hair;
  ctx.fillRect(x + 4, y - 14, 12, 5);
  ctx.fillStyle = PAL.out;
  ctx.fillRect(x + 14, y - 8, 2, 1);
  ctx.fillStyle = PAL.jacket;
  ctx.fillRect(x + 16, y - 4, 36, 10);
  ctx.fillStyle = "#F4F7FB";
  ctx.fillRect(x + 18, y - 2, 28, 8);
}
