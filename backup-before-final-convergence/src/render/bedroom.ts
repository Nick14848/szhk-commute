import { UI, loadSave } from "../data/copy";
import { fontSC, prefersReducedMotion } from "../design/tokens";
import { PAL, actorFrame, drawAnchored } from "./sprites";

type PhaseName = "alarm" | "wake" | "sit" | "stand" | "walk" | "leave";

type Audio = { resume: () => void; alarm: () => void };

const ROOM_W = 320;
const ROOM_H = 180;

let stopCurrent: (() => void) | null = null;

export function cancelBedroom() {
  stopCurrent?.();
  stopCurrent = null;
}

export function showBedroom(
  overlay: HTMLElement,
  audio: Audio,
  onBegin: () => void,
  sound: { label: () => string; toggle: () => void },
) {
  cancelBedroom();
  const save = loadSave();
  const reduced = prefersReducedMotion();
  const durations: Record<PhaseName, number> = reduced
    ? { alarm: 0.28, wake: 0.24, sit: 0.28, stand: 0.2, walk: 0.55, leave: 0.24 }
    : { alarm: 0.55, wake: 0.45, sit: 0.55, stand: 0.35, walk: 1.2, leave: 0.4 };
  const order: PhaseName[] = ["alarm", "wake", "sit", "stand", "walk", "leave"];

  const screen = document.createElement("main");
  screen.className = "screen bedroom";
  const canvas = document.createElement("canvas");
  canvas.className = "room";
  const title = document.createElement("h1");
  title.textContent = UI.titleTrad;
  const by = document.createElement("p");
  by.className = "sign-by";
  by.textContent = UI.by;
  const row = document.createElement("div");
  row.className = "bed-actions";
  const start = document.createElement("button");
  start.type = "button";
  start.className = "exit";
  start.textContent = UI.start;
  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "link";
  mute.textContent = sound.label();
  mute.addEventListener("click", () => {
    sound.toggle();
    mute.textContent = sound.label();
  });
  row.append(start);
  mute.className = "link sound-corner";
  screen.append(mute);
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = save ? UI.best(save.bestScore, save.bestStation) : UI.noRecord;
  screen.append(canvas, title, by, row, meta);
  overlay.replaceChildren(screen);
  overlay.classList.add("on");

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  let timer = 0;
  let running = true;
  let begun = false;
  let started = false;
  let elapsed = 0;
  let last = 0;
  let sized = "";

  const fit = () => {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const cssW = Math.min(720, Math.max(280, overlay.clientWidth - 32));
    const scale = Math.max(1, Math.floor(cssW / ROOM_W));
    const key = `${scale}:${dpr}`;
    canvas.style.width = `${ROOM_W * scale}px`;
    canvas.style.height = `${ROOM_H * scale}px`;
    if (key === sized) return;
    sized = key;
    canvas.width = ROOM_W * scale * dpr;
    canvas.height = ROOM_H * scale * dpr;
    ctx.setTransform((scale * dpr), 0, 0, (scale * dpr), 0, 0);
    ctx.imageSmoothingEnabled = false;
  };

  const phaseAt = () => {
    let t = elapsed;
    for (const name of order) {
      const dur = durations[name];
      if (t <= dur) return { name, p: Math.max(0, Math.min(1, t / dur)) };
      t -= dur;
    }
    return { name: "leave" as PhaseName, p: 1 };
  };

  const draw = (now: number) => {
    if (!running) return;
    if (last && started && !document.hidden) elapsed += Math.min(0.05, (now - last) / 1000);
    last = document.hidden ? 0 : now;
    fit();
    const { name, p } = started ? phaseAt() : { name: "alarm" as PhaseName, p: 0 };
    if (started && name === "leave" && p >= 1 && !begun) {
      begun = true;
      running = false;
      onBegin();
      return;
    }
    drawRoom(ctx, started ? name : "sleep", p, elapsed);
    if (name === "leave") {
      ctx.fillStyle = `rgba(231,211,180,${p})`;
      ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    }
    timer = requestAnimationFrame(draw);
  };

  const onHide = () => {
    if (!running) return;
    if (document.hidden) {
      if (timer) cancelAnimationFrame(timer);
      timer = 0;
      last = 0;
    } else if (!timer) timer = requestAnimationFrame(draw);
  };
  document.addEventListener("visibilitychange", onHide);
  const stop = () => {
    running = false;
    if (timer) cancelAnimationFrame(timer);
    document.removeEventListener("visibilitychange", onHide);
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  timer = requestAnimationFrame(draw);

  start.addEventListener("click", () => {
    if (started) return;
    started = true;
    elapsed = 0;
    last = 0;
    start.disabled = true;
    void Promise.resolve()
      .then(() => audio.resume())
      .then(() => audio.alarm())
      .catch(() => undefined);
  });

  return stop;
}

function drawRoom(ctx: CanvasRenderingContext2D, name: PhaseName | "sleep", p: number, elapsed: number) {
  const floor = 144;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#E7D3B4";
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  ctx.fillStyle = "#D7C09A";
  ctx.fillRect(0, floor - 4, ROOM_W, 4);
  ctx.fillStyle = "#C4A078";
  ctx.fillRect(0, floor, ROOM_W, ROOM_H - floor);
  ctx.fillStyle = "#A68462";
  ctx.fillRect(0, floor, ROOM_W, 2);
  ctx.fillStyle = "#B08968";
  for (let x = 16; x < ROOM_W; x += 24) ctx.fillRect(x, floor + 2, 1, ROOM_H - floor - 2);

  ctx.fillStyle = "#8E979E";
  ctx.fillRect(150, 0, 1, 10);
  ctx.fillStyle = "#F6E7B2";
  ctx.fillRect(140, 10, 22, 7);
  ctx.fillStyle = "#E7C56A";
  ctx.fillRect(143, 12, 16, 3);

  drawPort(ctx);
  const bedX = 4;
  const bedTop = 104;
  drawBed(ctx, bedX, bedTop, floor);
  drawClock(ctx, 128, bedTop, floor, name === "alarm", elapsed);
  drawDesk(ctx, floor, elapsed);
  drawMess(ctx, floor);
  drawDoor(ctx, floor);

  if (name === "sleep" || name === "alarm" || name === "wake") {
    drawSleeper(ctx, bedX + 14, bedTop + 2, name === "wake", elapsed);
    if (name !== "wake") drawZzz(ctx, bedX + 52, bedTop - 6, elapsed);
  } else if (name === "sit") {
    drawAnchored(ctx, actorFrame("player", 0, "idle"), bedX + 52, bedTop + 16);
  } else if (name === "stand") {
    drawAnchored(ctx, actorFrame("player", 0, "idle"), bedX + 64, floor);
  } else {
    const walked = name === "walk" ? p : 1;
    const x = bedX + 64 + walked * 180;
    drawAnchored(ctx, actorFrame("player", Math.floor((walked * 180) / 8), "walk"), x, floor);
  }
}

function drawPort(ctx: CanvasRenderingContext2D) {
  const x = 168;
  const y = 8;
  const w = 92;
  const h = 50;
  ctx.fillStyle = "#C4A27A";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = "#F7F1E6";
  ctx.fillRect(x, y, w, h);
  const skyH = 22;
  ctx.fillStyle = "#8EC4DE";
  ctx.fillRect(x + 2, y + 2, w - 4, skyH);
  ctx.fillStyle = "#C5D0D6";
  ctx.fillRect(x + 2, y + skyH, w - 4, h - skyH - 4);
  ctx.fillStyle = "#B7C3CC";
  ctx.fillRect(x + 8, y + 16, 16, 22);
  ctx.fillRect(x + 28, y + 10, 24, 28);
  ctx.fillRect(x + 56, y + 18, 18, 20);
  ctx.fillStyle = "#9AA8B2";
  ctx.fillRect(x + 30, y + 28, 20, 10);
  ctx.fillStyle = "#1E4E8C";
  ctx.fillRect(x + 18, y + 12, 48, 10);
  ctx.fillStyle = "#F7F7F7";
  ctx.font = `700 7px ${fontSC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("福田口岸", x + 42, y + 17);
  ctx.fillStyle = "#5C6770";
  ctx.fillRect(x + 22, y + 30, 3, 12);
  ctx.fillRect(x + 62, y + 30, 3, 12);
  ctx.fillStyle = "#1E4E8C";
  ctx.fillRect(x + 22, y + 30, 43, 3);
  ctx.fillStyle = "#A8B0B6";
  ctx.fillRect(x + 6, y + 36, w - 14, 2);
  ctx.fillStyle = "#8E979E";
  ctx.fillRect(x + 10, y + 38, 18, 2);
  ctx.fillRect(x + 40, y + 38, 28, 2);
  ctx.fillStyle = "#C4A27A";
  ctx.fillRect(x - 4, y + h - 2, w + 8, 4);
}

function drawBed(ctx: CanvasRenderingContext2D, bedX: number, bedTop: number, floor: number) {
  ctx.fillStyle = "#6E432C";
  ctx.fillRect(bedX, bedTop - 16, 7, 40);
  ctx.fillStyle = "#8E5A3C";
  ctx.fillRect(bedX + 6, bedTop, 112, 18);
  ctx.fillRect(bedX + 10, bedTop + 18, 5, floor - bedTop - 18);
  ctx.fillRect(bedX + 108, bedTop + 18, 5, floor - bedTop - 18);
  ctx.fillStyle = "#6E432C";
  ctx.fillRect(bedX + 6, bedTop + 15, 112, 3);
  ctx.fillStyle = "#C5D8EA";
  ctx.fillRect(bedX + 10, bedTop + 2, 102, 12);
  ctx.fillStyle = "#F7F1E6";
  ctx.fillRect(bedX + 12, bedTop - 8, 32, 14);
  ctx.fillStyle = "#E7D8C4";
  ctx.fillRect(bedX + 14, bedTop - 6, 28, 2);
}

function drawClock(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  floor: number,
  ringing: boolean,
  elapsed: number,
) {
  ctx.fillStyle = "#6E5344";
  ctx.fillRect(x, top + 6, 30, 10);
  ctx.fillRect(x + 2, top + 16, 4, floor - top - 16);
  ctx.fillRect(x + 24, top + 16, 4, floor - top - 16);
  ctx.fillStyle = "#5A4336";
  ctx.fillRect(x + 3, top + 10, 24, 1);
  ctx.fillStyle = "#C9A227";
  ctx.fillRect(x + 13, top + 11, 3, 3);

  const shake = ringing && Math.sin(elapsed * 42) > 0 ? 1 : 0;
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(x + 4 + shake, top + 4, 3, 2);
  ctx.fillRect(x + 21 + shake, top + 4, 3, 2);
  ctx.fillStyle = "#243044";
  ctx.fillRect(x + 4 + shake, top - 12, 22, 16);
  ctx.fillStyle = ringing ? "#F2C230" : "#D7B44A";
  ctx.fillRect(x + 6 + shake, top - 10, 18, 10);
  ctx.fillStyle = "#243044";
  ctx.font = "700 5px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("08", x + 7 + shake, top - 5);
  ctx.fillText("00", x + 16 + shake, top - 5);
  if (Math.floor(elapsed * 2) % 2 === 0) {
    px(ctx, x + 14 + shake, top - 7, 1, 1, "#243044");
    px(ctx, x + 14 + shake, top - 4, 1, 1, "#243044");
  }
  if (!ringing) return;
  px(ctx, x + 28, top - 10, 2, 2, "#243044");
  px(ctx, x + 31, top - 13, 2, 2, "#243044");
  px(ctx, x + 28, top - 2, 2, 2, "#243044");
  px(ctx, x + 31, top + 1, 2, 2, "#243044");
}

function drawDesk(ctx: CanvasRenderingContext2D, floor: number, elapsed: number) {
  const deskTop = 116;
  ctx.fillStyle = "#C4A27A";
  ctx.fillRect(166, deskTop, 90, 6);
  ctx.fillRect(170, deskTop + 6, 4, floor - deskTop - 6);
  ctx.fillRect(248, deskTop + 6, 4, floor - deskTop - 6);
  ctx.fillStyle = "#A68462";
  ctx.fillRect(166, deskTop + 4, 90, 2);

  ctx.fillStyle = "#C8CCD0";
  ctx.fillRect(172, deskTop - 3, 62, 3);
  ctx.fillStyle = "#A8AEB4";
  ctx.fillRect(176, deskTop - 2, 54, 1);
  ctx.fillStyle = "#243044";
  ctx.fillRect(174, deskTop - 46, 58, 43);
  ctx.fillStyle = "#F7F7F7";
  ctx.fillRect(176, deskTop - 44, 54, 39);
  ctx.fillStyle = "#10A37F";
  ctx.fillRect(176, deskTop - 44, 54, 8);
  ctx.fillStyle = "#F7F7F7";
  ctx.font = `700 6px ${fontSC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ChatGPT", 203, deskTop - 40);
  ctx.fillStyle = "#E8F6F1";
  ctx.fillRect(178, deskTop - 34, 50, 22);
  ctx.fillStyle = "#1A1A1A";
  ctx.font = `5px ${fontSC}`;
  ctx.textAlign = "left";
  ctx.fillText("把我当成什么都不", 180, deskTop - 28);
  ctx.fillText("懂得的老奶奶...", 180, deskTop - 20);
  ctx.fillStyle = "#F4F1EA";
  ctx.fillRect(178, deskTop - 10, 50, 4);
  const blink = Math.floor(elapsed * 2) % 2 === 0;
  ctx.fillStyle = blink ? "#10A37F" : "#C8CCD0";
  ctx.fillRect(180, deskTop - 9, 1, 2);

  const bottleX = 242;
  ctx.fillStyle = "#B7C3CC";
  ctx.fillRect(bottleX, deskTop - 1, 8, 1);
  ctx.fillStyle = "#D7EEF6";
  ctx.fillRect(bottleX, deskTop - 18, 7, 18);
  ctx.fillStyle = "#3E8FD4";
  ctx.fillRect(bottleX, deskTop - 21, 7, 3);
  ctx.fillStyle = "#F7F7F7";
  ctx.fillRect(bottleX + 1, deskTop - 14, 2, 8);
}

function drawMess(ctx: CanvasRenderingContext2D, floor: number) {
  meituan(ctx, 8, floor);
  meituan(ctx, 86, floor);
  meituan(ctx, 196, floor);
  flatBottle(ctx, 40, floor - 5);
  wad(ctx, 62, floor - 7);
  flatBottle(ctx, 154, floor - 5);
  wad(ctx, 292, floor - 7);
  ctx.fillStyle = "#F7F7F7";
  ctx.fillRect(74, floor - 3, 10, 2);
  ctx.fillStyle = "#D7D0C4";
  ctx.fillRect(75, floor - 2, 7, 1);
  ctx.fillStyle = PAL.out;
  ctx.fillRect(176, floor - 14, 12, 12);
  ctx.fillStyle = PAL.jacket;
  ctx.fillRect(178, floor - 12, 8, 8);
  ctx.fillStyle = PAL.jacketD;
  ctx.fillRect(180, floor - 14, 4, 3);
}

function meituan(ctx: CanvasRenderingContext2D, x: number, floor: number) {
  ctx.fillStyle = "#8A6848";
  ctx.fillRect(x + 2, floor - 2, 24, 2);
  ctx.fillStyle = "#FFC300";
  ctx.fillRect(x + 2, floor - 18, 22, 4);
  ctx.fillRect(x, floor - 16, 26, 14);
  ctx.fillStyle = "#E6A800";
  ctx.fillRect(x + 12, floor - 15, 1, 12);
  ctx.fillStyle = "#243044";
  ctx.fillRect(x + 6, floor - 22, 2, 6);
  ctx.fillRect(x + 18, floor - 22, 2, 6);
  ctx.fillRect(x + 6, floor - 22, 14, 2);
  ctx.font = `700 6px ${fontSC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("外卖", x + 13, floor - 8);
}

function flatBottle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#D7EEF6";
  ctx.fillRect(x, y, 16, 5);
  ctx.fillStyle = "#3E8FD4";
  ctx.fillRect(x + 14, y, 3, 5);
  ctx.fillStyle = "#F7F7F7";
  ctx.fillRect(x + 2, y + 1, 5, 1);
}

function wad(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#F4F1EA";
  ctx.fillRect(x, y, 9, 6);
  ctx.fillRect(x + 2, y - 2, 5, 3);
  ctx.fillStyle = "#E4D8C4";
  ctx.fillRect(x + 1, y + 2, 6, 1);
  ctx.fillRect(x + 4, y, 1, 4);
}

function drawDoor(ctx: CanvasRenderingContext2D, floor: number) {
  const x = 264;
  const top = 36;
  const w = 46;
  ctx.fillStyle = "#5C6770";
  ctx.fillRect(x, top, w, floor - top);
  ctx.fillStyle = "#9AA6AE";
  ctx.fillRect(x + 3, top + 3, w - 6, floor - top - 3);
  ctx.fillStyle = "#7A868E";
  ctx.fillRect(x + 7, top + 28, w - 14, floor - top - 46);
  ctx.fillStyle = "#243044";
  ctx.fillRect(x + 20, top + 14, 6, 6);
  ctx.fillStyle = "#9EC8DE";
  ctx.fillRect(x + 21, top + 15, 4, 4);
  ctx.fillStyle = "#C9A227";
  ctx.fillRect(x + 4, top + 16, 3, 5);
  ctx.fillRect(x + 4, floor - 28, 3, 5);
  ctx.fillRect(x + w - 14, floor - 58, 4, 4);
  ctx.fillRect(x + w - 18, floor - 57, 12, 2);
  ctx.fillStyle = "#6E7A82";
  ctx.fillRect(x - 2, floor - 3, w + 4, 3);
}

function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, elapsed: number) {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const marks = ["z", "z", "Z"];
  for (let i = 0; i < marks.length; i++) {
    const t = (elapsed * 0.45 + i * 0.33) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = "#243044";
    ctx.font = `700 ${7 + i}px ${fontSC}`;
    ctx.fillText(marks[i]!, x + i * 8 + t * 6, y - t * 26);
  }
  ctx.globalAlpha = 1;
}

function drawSleeper(ctx: CanvasRenderingContext2D, x: number, y: number, awake: boolean, elapsed: number) {
  const breath = Math.sin(elapsed * 1.6) > 0 ? 1 : 0;
  const hx = x + 16;
  const hy = y - 14;
  px(ctx, x + 32, y + 1 + breath, 48, 13, "#F7F7F7");
  px(ctx, x + 32, y + 1 + breath, 48, 3, "#E7EEF5");
  px(ctx, x + 48, y + 4 + breath, 18, 12, "#EEF3F8");
  px(ctx, x + 52, y + 8 + breath, 10, 6, "#D5DEE6");
  px(ctx, hx + 4, hy + 10, 8, 6, PAL.skin);
  px(ctx, x + 22, y + breath, 28, 14, PAL.jacket);
  px(ctx, x + 22, y + breath, 28, 3, PAL.jacketD);
  px(ctx, x + 44, y + 6 + breath, 14, 5, PAL.jacket);
  disc(ctx, x + 58, y + 8 + breath, 3, PAL.skin);
  px(ctx, x + 76, y + 6, 8, 7, PAL.pants);
  px(ctx, x + 82, y + 7, 16, 9, PAL.out);
  px(ctx, x + 83, y + 8, 14, 5, PAL.shoe);
  px(ctx, x + 83, y + 12, 14, 3, PAL.shoeD);
  disc(ctx, hx, hy, 12, PAL.out);
  disc(ctx, hx, hy, 11, PAL.skin);
  px(ctx, hx - 11, hy - 12, 16, 5, PAL.hair);
  px(ctx, hx - 12, hy - 8, 6, 8, PAL.hair);
  px(ctx, hx - 4, hy - 12, 6, 3, PAL.hair);
  if (awake) {
    px(ctx, hx + 3, hy - 2, 3, 3, PAL.out);
    px(ctx, hx + 4, hy - 2, 1, 1, "#F7F7F7");
  } else {
    px(ctx, hx + 3, hy - 1, 4, 1, PAL.out);
  }
  px(ctx, hx + 9, hy + 1, 2, 2, PAL.skinD);
  px(ctx, hx + 4, hy + 5, 3, 1, PAL.out);
  px(ctx, hx + 2, hy + 3, 2, 1, "#E7A0A0");
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy <= r * r) ctx.fillRect(cx + xx, cy + yy, 1, 1);
    }
  }
}
