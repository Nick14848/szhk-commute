import { UI, loadSave } from "../data/copy";
import { fontSC, prefersReducedMotion } from "../design/tokens";
import { PAL, PLAYER_PACK, PLAYER_PACK_D, drawAnchored, playerSprite } from "./sprites";

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
    ? { alarm: 0.1, wake: 0.12, sit: 0.1, stand: 0.12, walk: 0.3, leave: 0.12 }
    : { alarm: 0.22, wake: 0.28, sit: 0.22, stand: 0.26, walk: 0.9, leave: 0.18 };
  const order: PhaseName[] = ["alarm", "wake", "sit", "stand", "walk", "leave"];

  const screen = document.createElement("main");
  screen.className = "screen bedroom";
  const canvas = document.createElement("canvas");
  canvas.className = "room";
  const title = document.createElement("h1");
  title.textContent = UI.titleTrad;
  const tagline = document.createElement("p");
  tagline.className = "brand-tagline";
  tagline.textContent = UI.lede;
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
  screen.append(title, tagline, canvas, meta, row);
  overlay.replaceChildren(screen);
  overlay.classList.add("on");

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  let timer = 0;
  let running = true;
  let begun = false;
  let started = false;
  let elapsed = 0;
  let ambient = 0;
  let last = 0;
  let sized = "";

  const fit = () => {
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const maxH = Math.max(140, overlay.clientHeight * 0.38);
    let cssW = Math.min(640, Math.max(280, overlay.clientWidth - 32));
    let cssH = (ROOM_H / ROOM_W) * cssW;
    if (cssH > maxH) {
      cssH = maxH;
      cssW = (ROOM_W / ROOM_H) * cssH;
    }
    const key = `${Math.round(cssW)}:${dpr}`;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    if (key === sized) return;
    sized = key;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(canvas.width / ROOM_W, 0, 0, canvas.height / ROOM_H, 0, 0);
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
    if (last && !document.hidden) {
      const dt = Math.min(0.05, (now - last) / 1000);
      ambient += dt;
      if (started) elapsed += dt;
    }
    last = document.hidden ? 0 : now;
    fit();
    const { name, p } = started ? phaseAt() : { name: "alarm" as PhaseName, p: 0 };
    if (started && name === "leave" && p >= 1 && !begun) {
      begun = true;
      running = false;
      stopCurrent?.();
      onBegin();
      return;
    }
    drawRoom(ctx, started ? name : "sleep", p, ambient);
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

  drawPort(ctx, elapsed);
  const bedX = 4;
  const bedTop = 104;
  drawBed(ctx, bedX, bedTop, floor);
  drawClock(ctx, 128, bedTop, floor, name === "alarm", elapsed);
  drawDesk(ctx, floor, elapsed);
  drawMess(ctx, floor);
  drawDoor(ctx, floor, "hole");

  const edge = { x: bedX + 70, y: bedTop + 18 };
  const stood = { x: bedX + 96, y: floor };
  const doorX = 286;
  const pickedUp = name === "stand" && p > 0.72;
  const carrying = name === "walk" || name === "leave" || pickedUp;
  if (!carrying) {
    ctx.fillStyle = PAL.out;
    ctx.fillRect(bedX + 70, floor - 12, 12, 12);
    ctx.fillStyle = PLAYER_PACK_D;
    ctx.fillRect(bedX + 72, floor - 10, 8, 8);
    ctx.fillStyle = PLAYER_PACK;
    ctx.fillRect(bedX + 74, floor - 12, 4, 3);
  }
  if (name === "sleep" || name === "alarm" || name === "wake") {
    const rise = name === "wake" ? p : 0;
    const x = bedX + 64 + (edge.x - (bedX + 64)) * rise;
    const y = bedTop + 5 + (edge.y - (bedTop + 5)) * rise;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(-Math.PI / 2 * (1 - rise));
    drawAnchored(ctx, playerSprite("idle", 0, 0, false), 0, 0);
    ctx.restore();
    if (rise < 0.35) {
      px(ctx, bedX + 49, bedTop + 3, 33, 9, "#97B2C8");
      px(ctx, bedX + 49, bedTop + 3, 33, 2, "#C7DAE7");
    }
    if (name !== "wake") drawZzz(ctx, bedX + 40, bedTop - 10, elapsed);
  } else if (name === "sit") {
    drawAnchored(ctx, playerSprite("idle", 0, 0, false), edge.x, edge.y);
  } else if (name === "stand") {
    const x = edge.x + (stood.x - edge.x) * p;
    const y = edge.y + (stood.y - edge.y) * p;
    drawAnchored(ctx, playerSprite("idle", 0, 0, pickedUp), x, y);
  } else {
    const walked = name === "walk" ? p : 1;
    const x = stood.x + (doorX - stood.x) * walked;
    drawAnchored(ctx, playerSprite("walk", Math.floor(x / 8)), x, floor);
  }
  drawDoor(ctx, floor, "slab");
  // A few purposeful room details, not random pixels.
  px(ctx, 18, 30, 57, 29, "#B29271");
  px(ctx, 20, 32, 53, 25, "#D8B791");
  px(ctx, 25, 36, 14, 16, "#F1E9D6");
  px(ctx, 44, 37, 21, 12, "#DDE7E7");
  px(ctx, 27, 39, 10, 1, "#A2ADA9");
  px(ctx, 27, 43, 8, 1, "#A2ADA9");
}

function drawPort(ctx: CanvasRenderingContext2D, _elapsed: number) {
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
  ctx.fillRect(x + 12, y + 8, 60, 16);
  ctx.fillStyle = "#F7F7F7";
  ctx.font = `700 10px ${fontSC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("福田口岸", x + 42, y + 16);
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
  const bedW = 84;
  ctx.fillStyle = "#6E432C";
  ctx.fillRect(bedX, bedTop - 16, 7, 40);
  ctx.fillStyle = "#8E5A3C";
  ctx.fillRect(bedX + 6, bedTop, bedW, 16);
  ctx.fillRect(bedX + 10, bedTop + 16, 5, floor - bedTop - 16);
  ctx.fillRect(bedX + bedW - 4, bedTop + 16, 5, floor - bedTop - 16);
  ctx.fillStyle = "#6E432C";
  ctx.fillRect(bedX + 6, bedTop + 13, bedW, 3);
  ctx.fillStyle = "#C5D8EA";
  ctx.fillRect(bedX + 10, bedTop + 2, bedW - 12, 10);
  ctx.fillStyle = "#F7F1E6";
  ctx.fillRect(bedX + 12, bedTop - 6, 22, 10);
  ctx.fillStyle = "#E7D8C4";
  ctx.fillRect(bedX + 14, bedTop - 4, 18, 2);
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

  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(x + 4, top + 4, 3, 2);
  ctx.fillRect(x + 25, top + 4, 3, 2);
  ctx.fillStyle = "#243044";
  ctx.fillRect(x + 2, top - 14, 30, 18);
  ctx.fillStyle = "#D7B44A";
  ctx.fillRect(x + 4, top - 12, 26, 14);
  ctx.fillStyle = "#243044";
  ctx.font = "700 8px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("8:08", x + 17, top - 5);
  if (!ringing) return;
  px(ctx, x + 28, top - 10, 2, 2, "#243044");
  px(ctx, x + 31, top - 13, 2, 2, "#243044");
  px(ctx, x + 28, top - 2, 2, 2, "#243044");
  px(ctx, x + 31, top + 1, 2, 2, "#243044");
}

function drawMac(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#C8CCD0";
  ctx.fillRect(x + 12, y - 3, 18, 3);
  ctx.fillRect(x + 18, y - 8, 4, 5);
  ctx.fillStyle = "#E6E8EB";
  ctx.fillRect(x, y - 30, 40, 22);
  ctx.fillStyle = "#F4F5F6";
  ctx.fillRect(x, y - 30, 40, 2);
  ctx.fillStyle = "#0C0D10";
  ctx.fillRect(x + 2, y - 27, 36, 14);
  ctx.fillStyle = "#3A3D42";
  ctx.fillRect(x + 19, y - 29, 2, 1);
  ctx.fillStyle = "#C8CCD0";
  ctx.fillRect(x + 2, y - 13, 36, 5);
}

function drawDesk(ctx: CanvasRenderingContext2D, floor: number, _elapsed: number) {
  const deskTop = 116;
  ctx.fillStyle = "#C4A27A";
  ctx.fillRect(166, deskTop, 90, 6);
  ctx.fillRect(170, deskTop + 6, 4, floor - deskTop - 6);
  ctx.fillRect(248, deskTop + 6, 4, floor - deskTop - 6);
  ctx.fillStyle = "#A68462";
  ctx.fillRect(166, deskTop + 4, 90, 2);

  drawMac(ctx, 186, deskTop);
  px(ctx, 172, deskTop - 4, 11, 4, "#648A93");
  px(ctx, 172, deskTop - 3, 10, 2, "#F5EDDE");

  const bottleX = 230;
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
  meituan(ctx, 196, floor);
  flatBottle(ctx, 154, floor - 5);
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

function drawDoor(ctx: CanvasRenderingContext2D, floor: number, part: "hole" | "slab") {
  const x = 288;
  if (part !== "slab") {
    ctx.fillStyle = "#1C242C";
    ctx.fillRect(264, 36, 46, floor - 36);
    ctx.fillStyle = "#383F45";
    ctx.fillRect(263, 34, 49, 3);
    ctx.fillRect(263, 34, 3, floor - 34);
  }
  if (part === "hole") return;
  const top = 36;
  const w = 24;
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
  const hx = x + 8;
  const hy = y + 2;
  px(ctx, x + 16, y + 2 + breath, 36, 8, "#F7F7F7");
  px(ctx, x + 16, y + 2 + breath, 36, 2, "#E7EEF5");
  px(ctx, x + 12, y + breath, 22, 10, PAL.jacket);
  px(ctx, x + 12, y + breath, 22, 2, PAL.jacketD);
  px(ctx, x + 30, y + 4 + breath, 8, 4, PAL.jacket);
  px(ctx, x + 36, y + 6, 10, 5, PAL.pants);
  px(ctx, x + 44, y + 7, 10, 5, PAL.shoe);
  px(ctx, x + 44, y + 10, 10, 2, PAL.shoeD);
  disc(ctx, hx, hy, 6, PAL.out);
  disc(ctx, hx, hy, 5, PAL.skin);
  px(ctx, hx - 6, hy - 6, 8, 3, PAL.hair);
  px(ctx, hx - 6, hy - 4, 3, 4, PAL.hair);
  if (awake) px(ctx, hx + 1, hy - 1, 2, 2, PAL.out);
  else px(ctx, hx + 1, hy, 3, 1, PAL.out);
  px(ctx, hx + 4, hy + 1, 1, 1, PAL.skinD);
  px(ctx, hx + 1, hy + 3, 2, 1, PAL.out);
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
