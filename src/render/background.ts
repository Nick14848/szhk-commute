import { fontTC, tokens } from "../design/tokens";
import { SIGNS, STATIONS } from "../data/copy";
import { hash } from "../game/entities";
import {
  DAY_LEN,
  SEGMENTS,
  STATION_LEN,
  TRAIN_START,
  boundaryX,
  travelatorRange,
  type StageId,
} from "../game/stages";
import type { View } from "./view";

const FRAME = "#C9C9C9";
type Ctx = CanvasRenderingContext2D;

type Scene = {
  ctx: Ctx;
  v: View;
  cam: number;
  /** 这一天在世界坐标里的起点 */
  base: number;
  time: number;
  reduced: boolean;
};

export function drawWorld(ctx: Ctx, v: View, cam: number, time: number, reduced: boolean) {
  ctx.fillStyle = tokens.bg;
  ctx.fillRect(0, 0, v.W, v.H);

  const firstDay = Math.floor(cam / DAY_LEN);
  const lastDay = Math.floor((cam + v.W) / DAY_LEN);
  for (let d = firstDay; d <= lastDay; d++) {
    const base = d * DAY_LEN;
    for (const seg of SEGMENTS) {
      const x0 = Math.round(base + seg.start - cam);
      const x1 = Math.round(base + seg.end - cam);
      if (x1 <= 0 || x0 >= v.W) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.max(0, x0), 0, Math.min(v.W, x1) - Math.max(0, x0), v.H);
      ctx.clip();
      drawStage(seg.id, { ctx, v, cam, base, time, reduced });
      ctx.restore();
    }
    drawJoin(ctx, v, cam, base);
  }

  ctx.fillStyle = tokens.ink;
  ctx.fillRect(0, v.G, v.W, 1);
  speckles(ctx, v, cam);
}

function drawJoin(ctx: Ctx, v: View, cam: number, base: number) {
  drawGate(ctx, v, cam, base + SEGMENTS[0]!.end, "出境查验");
  drawGate(ctx, v, cam, base + SEGMENTS[2]!.end, "入境查验");
}

/** 闸机立柱的屏幕范围。吊牌用它裁切，不按包围盒整块消失。 */
function gateBands(s: Scene) {
  return [SEGMENTS[0]!.end, SEGMENTS[2]!.end].map((door) => Math.round(s.base + door - s.cam));
}

/** 自助通道闸机：顶梁、左右机柜、玻璃翼门、侧面读证口。人走近时翼门打开。 */
function drawGate(ctx: Ctx, v: View, cam: number, worldX: number, label: string) {
  const x = Math.round(worldX - cam);
  if (x < -90 || x > v.W + 90) return;
  const g = v.G;
  const approach = (v.W * 0.78 - x) / (v.W * 0.34);
  const openT = Math.max(0, Math.min(1, approach));
  const wing = Math.round(6 - openT * 4);
  ctx.fillStyle = "#D7D4CC";
  ctx.fillRect(x - 58, v.T, 116, g - v.T);
  const top = g - 86;

  ctx.fillStyle = "#A8B4BC";
  ctx.fillRect(x - 42, g - 7, 84, 7);
  ctx.fillStyle = "#F2C230";
  ctx.fillRect(x - 36, g - 3, 72, 2);
  ctx.fillStyle = "#243044";
  ctx.fillRect(x - 24, g - 6, 10, 2);
  ctx.fillRect(x + 14, g - 6, 10, 2);
  if (openT > 0.35) {
    ctx.fillStyle = tokens.exit;
    ctx.fillRect(x - 8, g - 5, 4, 2);
    ctx.fillRect(x - 4, g - 5, 2, 2);
    ctx.fillRect(x - 2, g - 6, 2, 2);
    ctx.fillRect(x, g - 5, 4, 2);
  }

  const posts = [x - 38, x + 22];
  for (const px of posts) {
    ctx.fillStyle = "#6E7A82";
    ctx.fillRect(px, top + 14, 16, g - 7 - (top + 14));
    ctx.fillStyle = "#D5DEE4";
    ctx.fillRect(px + 2, top + 16, 12, g - 12 - (top + 16));
    ctx.fillStyle = "#243044";
    ctx.fillRect(px + 3, top + 24, 10, 14);
    ctx.fillStyle = tokens.exit;
    ctx.fillRect(px + 6, top + 27, 4, 2);
    ctx.fillRect(px + 7, top + 29, 2, 4);
    ctx.fillStyle = "#243044";
    ctx.fillRect(px + 5, top + 18, 6, 4);
    ctx.fillStyle = "#7EB6E0";
    ctx.fillRect(px + 7, top + 19, 2, 2);
  }

  ctx.fillStyle = "#1E4E8C";
  ctx.fillRect(x - 40, top, 80, 14);
  ctx.fillStyle = "#8E9AA3";
  ctx.fillRect(x - 38, top + 14, 76, 2);
  ctx.fillStyle = "#F7F7F7";
  ctx.font = `700 7px ${fontTC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, top + 7);

  const glassTop = top + 20;
  const glassH = g - 16 - glassTop;
  ctx.fillStyle = "#C5DCE6";
  ctx.fillRect(x - 22, glassTop, wing, glassH);
  ctx.fillRect(x + 22 - wing, glassTop, wing, glassH);
  ctx.fillStyle = "#F7F7F7";
  ctx.fillRect(x - 22, glassTop, 1, glassH);
  ctx.fillRect(x + 21, glassTop, 1, glassH);
  ctx.fillStyle = "#9BB4C0";
  ctx.fillRect(x - 22 + Math.min(wing - 1, 3), glassTop + 4, 1, glassH - 8);
  ctx.fillRect(x + 21 - Math.min(wing - 1, 3), glassTop + 4, 1, glassH - 8);

  const rx = x - 18;
  ctx.fillStyle = "#243044";
  ctx.fillRect(rx, g - 40, 12, 16);
  ctx.fillStyle = "#101820";
  ctx.fillRect(rx + 2, g - 38, 8, 7);
  ctx.fillStyle = tokens.exit;
  ctx.fillRect(rx + 3, g - 36, 6, 3);
  ctx.fillStyle = "#F2C230";
  ctx.fillRect(rx + 2, g - 30, 8, 2);
  ctx.fillStyle = "#6E7A82";
  ctx.fillRect(rx, g - 26, 12, 3);
}

/** 自助通道里要跳过去的闸门。红灯、合上的翼门，和背景里打开的通道分开。 */
export function drawObstacleGate(ctx: Ctx, x: number, ground: number) {
  const left = Math.round(x) - 9;
  const top = ground - 22;
  ctx.fillStyle = "#6E7A82";
  ctx.fillRect(left, ground - 3, 18, 3);
  ctx.fillStyle = "#243044";
  ctx.fillRect(left, top, 3, 19);
  ctx.fillRect(left + 15, top, 3, 19);
  ctx.fillStyle = "#D7263D";
  ctx.fillRect(left, top + 2, 3, 3);
  ctx.fillRect(left + 15, top + 2, 3, 3);
  ctx.fillStyle = "#C5DCE6";
  ctx.fillRect(left + 3, top + 5, 6, 14);
  ctx.fillRect(left + 9, top + 5, 6, 14);
  ctx.fillStyle = "#F7F7F7";
  ctx.fillRect(left + 5, top + 7, 1, 10);
  ctx.fillRect(left + 11, top + 7, 1, 10);
  ctx.fillStyle = "#1E4E8C";
  ctx.fillRect(left - 1, top - 5, 20, 5);
  ctx.fillStyle = "#F2C230";
  ctx.fillRect(left + 7, top - 3, 4, 2);
  ctx.fillStyle = "#D7263D";
  ctx.fillRect(left + 3, top + 11, 12, 2);
}

function drawStage(id: StageId, s: Scene) {
  if (id === "hall") hall(s);
  else if (id === "gates") gates(s);
  else if (id === "bridge") bridge(s);
  else if (id === "platform") platform(s);
  else train(s);
}

function floor(s: Scene, color: string = tokens.floor) {
  s.ctx.fillStyle = color;
  s.ctx.fillRect(0, s.v.G + 1, s.v.W, s.v.H - s.v.G - 1);
}

function ceiling(s: Scene) {
  const { ctx, v, cam } = s;
  ctx.fillStyle = tokens.far;
  ctx.fillRect(0, v.T + 2, v.W, 1);
  tile(cam * 0.6, 48, v.W, (x) => ctx.fillRect(x, v.T + 4, 20, 2));
}

function signY(v: View) {
  return Math.max(v.T + 16, v.G - 92);
}

function columns(s: Scene, spacing: number, parallax: number) {
  const { ctx, v, cam } = s;
  ctx.fillStyle = "#EAEAEA";
  tile(cam * parallax, spacing, v.W, (x) => {
    ctx.fillRect(x, v.T + 3, 10, v.G - v.T - 3);
    ctx.fillStyle = tokens.far;
    ctx.fillRect(x, v.T + 3, 1, v.G - v.T - 3);
    ctx.fillRect(x + 9, v.T + 3, 1, v.G - v.T - 3);
    ctx.fillStyle = "#EAEAEA";
  });
}

function lamps(s: Scene, _time: number, color: string) {
  const { ctx, v, cam } = s;
  tile(cam * 0.5, 64, v.W, (x) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, v.T + 12, 3, 3);
  });
}

function hall(s: Scene) {
  const { ctx, v, cam, time } = s;
  ctx.fillStyle = "#E4D9C8";
  ctx.fillRect(0, 0, v.W, v.G);
  floor(s, "#E8E0D4");
  ctx.fillStyle = "#D9D0C4";
  ctx.fillRect(0, v.T, v.W, 10);
  ceiling(s);
  columns(s, 170, 0.3);
  tile(cam * 0.2, 180, v.W, (x, i) => {
    const y = v.G - 22;
    ctx.fillStyle = i % 2 ? "#8A8178" : "#6E7A82";
    ctx.fillRect(x, y, 6, 16);
    ctx.fillRect(x + 1, y - 5, 4, 5);
  });
  lamps(s, time, tokens.exit);
  tile(cam * 0.35, 150, v.W, (x, i) => booth(ctx, x, v.G, hash(i) > 0.5));
  tile(cam * 0.5, 220, v.W, (x) => {
    ctx.fillStyle = "#243044";
    ctx.fillRect(x, v.T + 18, 70, 22);
    ctx.fillStyle = tokens.line;
    ctx.fillRect(x, v.T + 18, 70, 3);
    ctx.fillStyle = "#F7F7F7";
    ctx.font = `700 9px ${fontTC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(SIGNS.departure, x + 35, v.T + 30);
  });
  ctx.fillStyle = tokens.yellow;
  ctx.fillRect(0, v.G + 4, v.W, 4);
  ctx.fillStyle = tokens.floor;
  tile(cam, 4, v.W, (x) => {
    ctx.fillRect(x + 1, v.G + 5, 1, 1);
    ctx.fillRect(x + 3, v.G + 7, 1, 1);
  });
}

function booth(ctx: Ctx, x: number, G: number, tall: boolean) {
  const h = tall ? 34 : 28;
  ctx.fillStyle = tokens.far;
  ctx.fillRect(x, G - h, 40, h);
  ctx.fillStyle = tokens.bg;
  ctx.fillRect(x + 6, G - h + 5, 28, 10);
  ctx.fillStyle = tokens.far;
  ctx.fillRect(x + 19, G - h + 5, 2, 10);
}

function gates(s: Scene) {
  const { ctx, v, cam, time } = s;
  ctx.fillStyle = "#D7E0E6";
  ctx.fillRect(0, 0, v.W, v.G);
  floor(s, "#E3E7EA");
  ctx.fillStyle = "#D5DEE4";
  ctx.fillRect(0, v.T, v.W, 8);
  ceiling(s);
  columns(s, 200, 0.3);
  lamps(s, time, tokens.exit);
  tile(cam * 0.45, 28, v.W, (x, i) => {
    ctx.fillStyle = tokens.far;
    ctx.fillRect(x, v.G - 26, 4, 26);
    ctx.fillRect(x + 4, v.G - 16, 8, 3);
    ctx.fillStyle = tokens.exit;
    ctx.fillRect(x + 1, v.G - 24, 2, 2);
  });
  tile(cam * 0.6, 220, v.W, (x) => {
    sign(s, x, signY(v), SIGNS.echannel, SIGNS.echannelEn);
  });
}

function bridge(s: Scene) {
  const { ctx, v, cam, base, time, reduced } = s;
  floor(s, "#D5E2EA");
  const top = v.T + 8;
  const sill = v.G - 40;
  ctx.fillStyle = tokens.glass;
  ctx.fillRect(0, top, v.W, sill - top);

  const shore = sill - 14;
  tile(cam * 0.15, 14, v.W, (x, i) => {
    const h = 8 + Math.floor(hash(i) * 34);
    const w = 8 + Math.floor(hash(i + 999) * 5);
    ctx.fillStyle = tokens.far;
    ctx.fillRect(x, shore - h, w, h);
    ctx.fillStyle = tokens.glass;
    for (let y = shore - h + 3; y < shore - 3; y += 5) ctx.fillRect(x + 2, y, w - 4, 1);
  });
  ctx.fillStyle = tokens.water;
  ctx.fillRect(0, shore, v.W, 3);
  ctx.fillStyle = tokens.far;
  ctx.fillRect(0, shore + 3, v.W, sill - shore - 3);

  ctx.fillStyle = FRAME;
  ctx.fillRect(0, top, v.W, 2);
  ctx.fillRect(0, sill, v.W, 2);
  tile(cam, 44, v.W, (x) => ctx.fillRect(x, top, 2, sill - top));

  const bx = Math.round(base + boundaryX() - cam);
  if (bx > -60 && bx < v.W + 60) {
    ctx.fillStyle = tokens.ink;
    ctx.fillRect(bx, v.G + 1, 1, 12);
    ctx.font = `600 7px ${fontTC}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText(SIGNS.sz, bx - 4, v.G + 4);
    ctx.textAlign = "left";
    ctx.fillText(SIGNS.hk, bx + 4, v.G + 4);
  }
  tile(cam * 0.4, 220, v.W, (x) => {
    ctx.fillStyle = "#1E4E8C";
    ctx.fillRect(x, v.T + 16, 2, 18);
    ctx.fillRect(x - 28, v.T + 32, 60, 16);
    ctx.fillStyle = "#F7F7F7";
    ctx.font = `700 8px ${fontTC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("往香港", x + 2, v.T + 40);
  });

  const [a, b] = travelatorRange();
  const tx0 = Math.round(base + a - cam);
  const tx1 = Math.round(base + b - cam);
  if (tx1 > 0 && tx0 < v.W) {
    for (let x = tx0; x < tx1; x += 28) {
      ctx.fillStyle = "#C5D6E0";
      ctx.fillRect(x, v.G - 36, 2, 36);
      ctx.fillStyle = "#E7F2F6";
      ctx.fillRect(x + 2, v.G - 32, 24, 14);
    }
    ctx.fillStyle = "#5C6770";
    ctx.fillRect(tx0, v.G - 36, Math.max(0, tx1 - tx0), 3);
    ctx.fillStyle = "#8E979E";
    const teeth = reduced ? 0 : Math.floor(time * 30) % 4;
    for (let x = tx0 + teeth; x < tx1; x += 4) ctx.fillRect(x, v.G - 2, 2, 2);
    ctx.fillStyle = tokens.mid;
    ctx.fillRect(tx0, v.G + 1, tx1 - tx0, 5);
    ctx.fillStyle = tokens.floor;
    const shift = reduced ? 0 : Math.floor((time * 30) % 8);
    for (let x = tx0 - 8 + shift; x < tx1; x += 8) {
      if (x < tx0) continue;
      ctx.fillRect(x, v.G + 2, 1, 1);
      ctx.fillRect(x + 1, v.G + 3, 1, 1);
      ctx.fillRect(x, v.G + 4, 1, 1);
    }
    ctx.fillStyle = tokens.ink;
    ctx.font = `600 7px ${fontTC}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(SIGNS.travelator, tx0 + 6, v.G + 8);
  }
}

function platform(s: Scene) {
  const { ctx, v, cam } = s;
  ctx.fillStyle = "#E3E1D8";
  ctx.fillRect(0, 0, v.W, v.G);
  floor(s, "#E4E4DE");
  ctx.fillStyle = "#D7D7D2";
  ctx.fillRect(0, v.T, v.W, 6);
  ceiling(s);
  const trainTop = v.G - 74;
  ctx.fillStyle = "#C5CED6";
  ctx.fillRect(0, trainTop, v.W, 56);
  ctx.fillStyle = "#53B7E8";
  ctx.fillRect(0, trainTop + 6, v.W, 4);
  ctx.fillStyle = "#8E979E";
  ctx.fillRect(0, trainTop + 52, v.W, 4);
  tile(cam, 110, v.W, (x) => {
    ctx.fillStyle = "#243044";
    ctx.fillRect(x + 6, trainTop + 16, 28, 18);
    ctx.fillStyle = "#E7EEF2";
    ctx.fillRect(x + 8, trainTop + 18, 24, 14);
    ctx.fillStyle = "#F4F1E8";
    ctx.fillRect(x + 44, trainTop + 12, 22, 44);
    ctx.fillStyle = "#C47A4A";
    ctx.fillRect(x + 45, trainTop + 26, 7, 8);
    ctx.fillStyle = "#F2C230";
    ctx.fillRect(x + 54, trainTop + 14, 2, 40);
    ctx.fillStyle = "#5C6770";
    ctx.fillRect(x + 40, trainTop + 12, 3, 44);
    ctx.fillRect(x + 66, trainTop + 12, 3, 44);
    ctx.fillStyle = "#E7EEF2";
    ctx.fillRect(x + 78, trainTop + 18, 20, 12);
  });
  tile(cam, 110, v.W, (x) => {
    ctx.fillStyle = FRAME;
    ctx.fillRect(x, v.G - 58, 40, 2);
    ctx.fillRect(x, v.G - 58, 2, 58);
    ctx.fillRect(x + 38, v.G - 58, 2, 58);
    ctx.fillRect(x + 70, v.G - 58, 40, 2);
    ctx.fillRect(x + 70, v.G - 58, 2, 58);
    ctx.fillRect(x + 108, v.G - 58, 2, 58);
    ctx.fillStyle = tokens.glass;
    ctx.fillRect(x + 2, v.G - 56, 36, 56);
    ctx.fillRect(x + 72, v.G - 56, 36, 56);
  });
  tile(cam * 0.6, 260, v.W, (x) => {
    sign(s, x, Math.max(v.T + 16, v.G - 84), SIGNS.toAdmiralty, SIGNS.toAdmiraltyEn, true);
  });
  ctx.fillStyle = tokens.yellow;
  ctx.fillRect(0, v.G + 2, v.W, 2);
  ctx.fillStyle = tokens.ink;
  ctx.font = `600 7px ${fontTC}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  tile(cam, 200, v.W, (x) => ctx.fillText(SIGNS.gap, x + 20, v.G + 7));
}

type Scenery = "fields" | "harbour" | "city" | "tunnel";

function sceneryFor(i: number): Scenery {
  if (i <= 2) return "fields";
  if (i <= 6) return "harbour";
  if (i <= 11) return "city";
  return "tunnel";
}

function train(s: Scene) {
  const { ctx, v, cam, base, time, reduced } = s;
  ctx.fillStyle = "#F4F1E8";
  ctx.fillRect(0, -40, v.W, v.G + 40);
  floor(s, "#C5CED6");
  const top = v.G - 96;
  const bottom = v.G - 62;
  const winH = bottom - top;
  const farFloor = v.G - 24;

  const firstIdx = Math.max(0, Math.floor((cam - base - TRAIN_START) / STATION_LEN));
  const lastIdx = Math.min(STATIONS.length - 1, Math.floor((cam + v.W - base - TRAIN_START) / STATION_LEN));
  const drift = reduced ? cam * 0.5 : cam * 0.5 + time * 90;

  for (let i = firstIdx; i <= lastIdx; i++) {
    const sx0 = Math.round(base + TRAIN_START + i * STATION_LEN - cam);
    const sx1 = sx0 + STATION_LEN;
    const x0 = Math.max(0, sx0);
    const x1 = Math.min(v.W, sx1);
    if (x1 <= x0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, top, x1 - x0, winH);
    ctx.clip();
    window(ctx, v, sceneryFor(i), x0, x1, top, bottom, drift);
    ctx.restore();

    const fc0 = Math.round(sx0 + STATION_LEN * 0.55);
    const fc1 = Math.round(sx0 + STATION_LEN * 0.8);
    if (fc1 > 0 && fc0 < v.W && fc0 > -40 && fc0 < v.W) {
      ctx.fillStyle = tokens.ink;
      ctx.font = `600 8px ${fontTC}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(SIGNS.first, fc0 + 4, top + 4);
    }
  }

  ctx.fillStyle = "#E7E4DC";
  ctx.fillRect(0, bottom, v.W, farFloor - bottom);
  ctx.fillStyle = "#2C3138";
  ctx.fillRect(0, top - 3, v.W, 3);
  ctx.fillRect(0, bottom, v.W, 3);
  tile(cam, 92, v.W, (x) => {
    ctx.fillStyle = "#2C3138";
    ctx.fillRect(x, top, 4, winH);
  });

  const origin = base + TRAIN_START;
  const module = 220;
  const firstMod = Math.floor((cam - 30 - origin) / module) - 1;
  for (let m = firstMod; m < firstMod + 6; m++) {
    const wx = origin + m * module;
    const x = Math.round(wx - cam);
    if (x > v.W + module) break;
    ctx.fillStyle = "#C5CED6";
    ctx.fillRect(x, farFloor, module, v.G - farFloor);
    ctx.fillStyle = "#B7C0C8";
    ctx.fillRect(x, farFloor, module, 3);
    for (const local of [16, 48, 80, 112, 144]) {
      const sx = x + local;
      const cushion = farFloor - 8;
      const backTop = bottom + 16;
      ctx.fillStyle = "#8E979E";
      ctx.fillRect(sx + 2, cushion + 6, 2, farFloor - cushion - 6);
      ctx.fillRect(sx + 16, cushion + 6, 2, farFloor - cushion - 6);
      ctx.fillStyle = "#D7DCE1";
      ctx.fillRect(sx, backTop, 4, cushion - backTop);
      ctx.fillRect(sx, cushion, 22, 6);
      ctx.fillStyle = "#B7BDC4";
      ctx.fillRect(sx, cushion, 22, 2);
    }
    const pole = x + 188;
    ctx.fillStyle = "#8E979E";
    ctx.fillRect(pole, top - 8, 4, farFloor - (top - 8));
    ctx.fillRect(pole - 1, top - 8, 6, 3);
    ctx.fillRect(pole - 1, farFloor - 3, 6, 3);
  }

  ctx.fillStyle = tokens.line;
  ctx.fillRect(0, top - 14, v.W, 2);
  const ring0 = Math.floor((cam - origin) / 36) - 1;
  for (let i = ring0; i < ring0 + 12; i++) {
    const local = ((i % 6) + 6) % 6;
    if (local === 5) continue;
    const sx = Math.round(origin + i * 36 - cam);
    ctx.fillStyle = "#8E979E";
    ctx.fillRect(sx + 5, top - 14, 2, 4);
    hollowRing(ctx, sx, top - 10);
  }

  for (let i = firstIdx; i <= lastIdx; i++) {
    if (sceneryFor(i) === "tunnel") continue;
    const label = STATIONS[i]!.trad;
    ctx.font = `600 8px ${fontTC}`;
    const plateW = Math.ceil(ctx.measureText(label).width) + 16;
    const sx0 = Math.round(base + TRAIN_START + i * STATION_LEN - cam);
    const plate = Math.round(sx0 + 72 - plateW / 2);
    if (plate < -plateW || plate > v.W) continue;
    const sy = bottom + 2;
    ctx.fillStyle = "#D9D9D9";
    ctx.fillRect(plate, sy, plateW, 14);
    ctx.fillStyle = tokens.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, plate + plateW / 2, sy + 7);
  }

  ctx.fillStyle = "#D7DCE1";
  ctx.fillRect(0, v.G + 10, v.W, 8);
  ctx.fillStyle = "#B7BDC4";
  ctx.fillRect(0, v.G + 10, v.W, 3);
}

function hollowRing(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#8E979E";
  ctx.fillRect(x + 6, y, 2, 3);
  ctx.fillStyle = tokens.line;
  ctx.fillRect(x + 3, y + 3, 8, 2);
  ctx.fillRect(x + 2, y + 5, 2, 2);
  ctx.fillRect(x + 10, y + 5, 2, 2);
  ctx.fillRect(x + 1, y + 7, 2, 2);
  ctx.fillRect(x + 11, y + 7, 2, 2);
  ctx.fillRect(x + 4, y + 9, 6, 2);
}

function window(
  ctx: Ctx,
  v: View,
  kind: Scenery,
  x0: number,
  x1: number,
  top: number,
  bottom: number,
  drift: number,
) {
  if (kind === "tunnel") {
    ctx.fillStyle = tokens.ink;
    ctx.fillRect(x0, top, x1 - x0, bottom - top);
    ctx.fillStyle = tokens.mid;
    for (let x = x0 - ((drift * 3) % 40); x < x1; x += 40) ctx.fillRect(Math.round(x), top + 10, 12, 1);
    return;
  }
  ctx.fillStyle = tokens.glass;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  ctx.fillStyle = tokens.far;
  if (kind === "harbour") {
    for (let x = x0; x < x1; x++) {
      const h = Math.round(10 + 7 * Math.sin((x + drift) / 41) + 3 * Math.sin((x + drift) / 13));
      ctx.fillRect(x, bottom - 12 - h, 1, h);
    }
    ctx.fillStyle = tokens.water;
    ctx.fillRect(x0, bottom - 12, x1 - x0, 12);
    ctx.fillStyle = tokens.glass;
    for (let x = x0 - (drift % 18); x < x1; x += 18) ctx.fillRect(Math.round(x), bottom - 7, 5, 1);
    return;
  }
  if (kind === "fields") {
    for (let x = x0; x < x1; x++) {
      const h = Math.round(9 + 5 * Math.sin((x + drift) / 53) + 2 * Math.sin((x + drift) / 17));
      ctx.fillRect(x, bottom - h, 1, h);
    }
    return;
  }
  const off = drift * 1.4;
  const start = Math.floor((x0 + off) / 12) - 1;
  for (let i = start; i * 12 - off < x1; i++) {
    const x = Math.round(i * 12 - off);
    const h = 10 + Math.floor(hash(i) * (bottom - top - 12));
    ctx.fillStyle = tokens.far;
    ctx.fillRect(x, bottom - h, 10, h);
  }
}

/** 吊牌：白底墨框，中文主、英文副（屏幕够大才显示英文）。 */
function sign(s: Scene, x: number, y: number, zh: string, en: string, gray = false) {
  const { ctx, v } = s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-20, -40, v.W + 40, v.H + 80);
  for (const sx of gateBands(s)) ctx.rect(sx - 58, -40, 116, v.H + 80);
  ctx.clip("evenodd");
  const english = showEnglish(v);
  ctx.font = `600 9px ${fontTC}`;
  const zw = ctx.measureText(zh).width;
  ctx.font = `500 5px ${fontTC}`;
  const ew = english ? ctx.measureText(en).width : 0;
  const w = Math.ceil(Math.max(zw, ew) + 12);
  const h = english ? 20 : 14;
  const sx = Math.round(x);
  ctx.fillStyle = tokens.mid;
  ctx.fillRect(sx + 4, v.T + 2, 1, y - v.T - 2);
  ctx.fillRect(sx + w - 5, v.T + 2, 1, y - v.T - 2);
  ctx.fillStyle = tokens.ink;
  ctx.fillRect(sx, y, w, h);
  ctx.fillStyle = gray ? "#E2E2E2" : tokens.white;
  ctx.fillRect(sx + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = tokens.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 9px ${fontTC}`;
  ctx.fillText(zh, sx + w / 2, y + 7.5);
  if (english) {
    ctx.font = `500 5px ${fontTC}`;
    ctx.fillText(en, sx + w / 2, y + 15);
  }
  ctx.restore();
}

export function showEnglish(v: View) {
  return (5 * v.pd) / v.dpr >= 7;
}

function speckles(ctx: Ctx, v: View, cam: number) {
  ctx.fillStyle = tokens.mid;
  const start = Math.floor(cam / 6);
  for (let i = start; i * 6 - cam < v.W; i++) {
    const r = hash(i * 7 + 3);
    if (r > 0.28) continue;
    const x = Math.round(i * 6 - cam);
    const y = v.G + 10 + Math.floor(hash(i) * 6);
    ctx.fillRect(x, y, r < 0.1 ? 2 : 1, 1);
  }
}

function tile(offset: number, spacing: number, width: number, fn: (x: number, i: number) => void) {
  const first = Math.floor(offset / spacing) - 1;
  for (let i = first; ; i++) {
    const x = Math.round(i * spacing - offset);
    if (x > width) break;
    fn(x, i);
  }
}
