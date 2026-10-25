import { fontSC, fontTC, tokens } from "../design/tokens";
import { BORDER, STATIONS, UI } from "../data/copy";
import type { SeatEvent } from "../game/seatEvent";
import { pixelText } from "./pixelFont";
import { SPR } from "./sprites";
import type { Rect, View } from "./view";

type Ctx = CanvasRenderingContext2D;

export type Chip = { text: string; color: string };

export type HudModel = {
  mode: "port" | "platform" | "train";
  node: number;
  placeTrad: string;
  placeSimp: string;
  placeEn: string;
  score: number;
  hi: number;
  waters: number;
  day: number;
  attempt: number;
  doorBlink: boolean;
  chips: Chip[];
  banner: [string, string] | null;
};

const NODES = BORDER.length + STATIONS.length;

export function drawHud(ctx: Ctx, v: View, m: HudModel) {
  const top = v.safeTop;
  ctx.fillStyle = tokens.bg;
  ctx.fillRect(0, 0, v.cssW, v.hudCss);

  const left = 84;
  const right = v.cssW - 16;
  const ly = top + 14;
  const step = (right - left - 8) / (NODES - 1);
  const nodeX = (i: number) => Math.round(left + 4 + i * step);
  ctx.fillStyle = tokens.far;
  ctx.fillRect(nodeX(0), ly - 1, nodeX(BORDER.length - 1) - nodeX(0), 2);
  ctx.fillStyle = tokens.line;
  ctx.fillRect(nodeX(BORDER.length - 1), ly - 1, nodeX(NODES - 1) - nodeX(BORDER.length - 1), 2);
  for (let i = 0; i < NODES; i++) {
    const x = nodeX(i);
    if (i === m.node) {
      ctx.fillStyle = m.doorBlink ? tokens.alert : tokens.line;
      ctx.fillRect(x - 5, ly - 5, 10, 10);
    } else if (i < m.node) {
      ctx.fillStyle = tokens.ink;
      ctx.fillRect(x - 3, ly - 3, 6, 6);
    } else {
      ctx.fillStyle = tokens.ink;
      ctx.fillRect(x - 3, ly - 3, 6, 6);
      ctx.fillStyle = tokens.bg;
      ctx.fillRect(x - 2, ly - 2, 4, 4);
    }
  }

  const narrow = v.cssW < 430;
  const scoreText = String(Math.floor(m.score)).padStart(5, "0");
  const px = 2;
  const scoreW = pixelText(ctx, scoreText, right, top + 36, px, tokens.ink, "right");
  let textRight = right - scoreW - 16;
  if (!narrow) {
    const hiText = `HI ${String(Math.floor(m.hi)).padStart(5, "0")}`;
    const hiW = pixelText(ctx, hiText, textRight, top + 36, px, tokens.mid, "right");
    textRight -= hiW + 12;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = tokens.inkDeep;
  ctx.font = `600 22px ${fontTC}`;
  let name = m.placeTrad;
  const nameMax = Math.max(48, textRight - left);
  while (name.length > 1 && ctx.measureText(name).width > nameMax) name = name.slice(0, -1);
  const nameW = ctx.measureText(name).width;
  ctx.fillText(name, left, top + 58);
  if (!narrow && name === m.placeTrad) {
    ctx.font = `500 12px ${fontTC}`;
    ctx.fillStyle = tokens.ink;
    const enX = left + nameW + 8;
    if (enX + ctx.measureText(m.placeEn).width < textRight) ctx.fillText(m.placeEn, enX, top + 58);
  }

  const ry = top + 70;
  const iconW = SPR.water.w * 2;
  const iconH = SPR.water.h * 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(SPR.water.img, left, ry, iconW, iconH);
  const ww = pixelText(ctx, `x${String(m.waters).padStart(2, "0")}`, left + iconW + 4, ry + 2, 2, tokens.ink);
  ctx.font = `500 13px ${fontSC}`;
  ctx.fillStyle = tokens.ink;
  ctx.textBaseline = "middle";
  const dayX = left + iconW + ww + 14;
  const dayText = UI.day(m.day);
  ctx.fillText(dayText, dayX, ry + iconH / 2);
  const dayRight = dayX + ctx.measureText(dayText).width + 8;

  let cx = right;
  ctx.font = `600 12px ${fontSC}`;
  for (const chip of m.chips) {
    const w = Math.ceil(ctx.measureText(chip.text).width) + 18;
    if (cx - w < dayRight) break;
    cx -= w;
    ctx.fillStyle = tokens.ink;
    ctx.fillRect(cx, ry, w, 22);
    ctx.fillStyle = tokens.bg;
    ctx.fillRect(cx + 1, ry + 1, w - 2, 20);
    ctx.fillStyle = chip.color;
    ctx.fillRect(cx + 1, ry + 1, 4, 20);
    ctx.fillStyle = tokens.inkDeep;
    ctx.textAlign = "left";
    ctx.fillText(chip.text, cx + 11, ry + 11.5);
    cx -= 6;
  }

  ctx.fillStyle = tokens.far;
  ctx.fillRect(0, v.hudCss - 1, v.cssW, 1);

  if (m.banner) {
    const by = v.hudCss;
    ctx.fillStyle = tokens.inkDeep;
    ctx.fillRect(0, by, v.cssW, 44);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = tokens.white;
    ctx.font = `600 15px ${fontTC}`;
    ctx.fillText(fit(ctx, m.banner[0], v.cssW - 32), 16, by + 20);
    ctx.fillStyle = "#CFCFCF";
    ctx.font = `500 11px ${fontTC}`;
    ctx.fillText(fit(ctx, m.banner[1], v.cssW - 32), 16, by + 36);
  }
}

function fit(ctx: Ctx, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export function drawControls(ctx: Ctx, v: View, duckHeld: boolean) {
  const c = v.controls;
  if (!c) return;
  button(ctx, c.duck, UI.duck, "down", duckHeld, c.big);
  button(ctx, c.jump, UI.jump, "up", false, c.big);
}

function button(ctx: Ctx, r: Rect, label: string, dir: "up" | "down", pressed: boolean, big: boolean) {
  const x = Math.round(r.x);
  const y = Math.round(r.y);
  const w = Math.round(r.w);
  const h = Math.round(r.h);
  const sink = pressed ? 3 : 0;
  ctx.fillStyle = tokens.ink;
  ctx.fillRect(x + 3, y + 3, w, h);
  ctx.fillRect(x + sink, y + sink, w, h);
  ctx.fillStyle = pressed ? tokens.ink : tokens.white;
  ctx.fillRect(x + sink + 2, y + sink + 2, w - 4, h - 4);
  const fg = pressed ? tokens.white : tokens.ink;
  const cx = x + sink + w / 2;
  const cy = y + sink + h / 2;
  ctx.fillStyle = fg;
  ctx.font = `600 ${big ? 24 : 18}px ${fontSC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const arrowGap = big ? 22 : 16;
  ctx.fillText(label, cx - arrowGap / 2, cy + 1);
  arrow(ctx, cx + arrowGap - 2, cy, dir, big ? 3 : 2, fg);
}

function arrow(ctx: Ctx, x: number, y: number, dir: "up" | "down", p: number, color: string) {
  ctx.fillStyle = color;
  const rows = dir === "up" ? [1, 3, 5] : [5, 3, 1];
  rows.forEach((n, i) => {
    ctx.fillRect(Math.round(x - (n * p) / 2), Math.round(y - 1.5 * p + i * p), n * p, p);
  });
}

export function drawKeyHint(ctx: Ctx, v: View, text: string) {
  ctx.fillStyle = tokens.ink;
  ctx.font = `500 13px ${fontSC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, v.cssW / 2, v.cssH - v.safeBottom - 20);
}

export function drawSeatOverlay(ctx: Ctx, v: View, seat: SeatEvent, note: string | null, keys: boolean) {
  const top = v.hudCss + 32;
  const barW = Math.min(300, v.cssW - 64);
  const x = Math.round((v.cssW - barW) / 2);
  ctx.fillStyle = tokens.steelDark;
  ctx.fillRect(x - 16, top - 10, barW + 32, 146);
  ctx.strokeStyle = tokens.steelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 16, top - 10, barW + 32, 146);
  ctx.fillStyle = tokens.brandYellow;
  ctx.fillRect(x - 16, top - 10, barW + 32, 3);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = tokens.brandWhite;
  ctx.font = `600 18px ${fontSC}`;
  ctx.fillText(UI.seatTitle, v.cssW / 2, top + 18);
  bar(ctx, x, top + 46, barW, UI.you, seat.player, tokens.brandYellow);
  bar(ctx, x, top + 82, barW, UI.grandma, seat.grandma, tokens.alert);
  ctx.textAlign = "center";
  ctx.fillStyle = tokens.brandWhite;
  ctx.font = `600 15px ${fontSC}`;
  ctx.fillText(note ?? (keys ? UI.seatHintKeys : UI.seatHint), v.cssW / 2, top + 116);
}

function bar(ctx: Ctx, x: number, y: number, w: number, label: string, amount: number, color: string) {
  ctx.fillStyle = tokens.brandWhite;
  ctx.font = `600 13px ${fontSC}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, x, y - 6);
  ctx.fillStyle = tokens.ink;
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = tokens.bg;
  ctx.fillRect(x + 2, y + 2, w - 4, 8);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.round((w - 4) * Math.min(1, amount)), 8);
}

export function drawBubble(ctx: Ctx, v: View, text: string, ax: number, ay: number) {
  ctx.font = `600 16px ${fontTC}`;
  const tw = Math.ceil(ctx.measureText(text).width);
  const w = tw + 20;
  const h = 34;
  let x = Math.round(ax - w / 2);
  x = Math.max(8, Math.min(v.cssW - w - 8, x));
  const y = Math.round(Math.max(v.hudCss + 8, ay - h - 10));
  ctx.fillStyle = tokens.ink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = tokens.white;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const tx = Math.round(Math.max(x + 10, Math.min(x + w - 16, ax - 3)));
  ctx.fillStyle = tokens.ink;
  ctx.fillRect(tx, y + h, 6, 2);
  ctx.fillRect(tx + 1, y + h + 2, 4, 2);
  ctx.fillRect(tx + 2, y + h + 4, 2, 2);
  ctx.fillStyle = tokens.white;
  ctx.fillRect(tx + 2, y + h - 2, 2, 2);
  ctx.fillStyle = tokens.inkDeep;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}
