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
const FIRST_SEAT = "#E3D6A6";

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
  }

  ctx.fillStyle = tokens.ink;
  ctx.fillRect(0, v.G, v.W, 1);
  speckles(ctx, v, cam);
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

function lamps(s: Scene, time: number, color: string) {
  const { ctx, v, cam, reduced } = s;
  tile(cam * 0.5, 64, v.W, (x, i) => {
    const on = reduced || Math.floor(time * 1.4 + i * 0.37) % 4 !== 0;
    ctx.fillStyle = on ? color : tokens.mid;
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
  lamps(s, time, tokens.exit);
  tile(cam * 0.35, 150, v.W, (x, i) => booth(ctx, x, v.G, hash(i) > 0.5));
  tile(cam * 0.6, 210, v.W, (x) => sign(s, x, signY(v), SIGNS.departure, SIGNS.departureEn));
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
    const on = s.reduced || Math.floor(time * 2 + i) % 5 !== 0;
    ctx.fillStyle = on ? tokens.exit : tokens.alert;
    ctx.fillRect(x + 1, v.G - 24, 2, 2);
  });
  tile(cam * 0.6, 190, v.W, (x, i) =>
    sign(s, x, signY(v), i % 2 === 0 ? SIGNS.echannel : SIGNS.residents, SIGNS.echannelEn),
  );
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

  const [a, b] = travelatorRange();
  const tx0 = Math.round(base + a - cam);
  const tx1 = Math.round(base + b - cam);
  if (tx1 > 0 && tx0 < v.W) {
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
  tile(cam, 72, v.W, (x) => {
    ctx.fillStyle = FRAME;
    ctx.fillRect(x, v.G - 58, 44, 2);
    ctx.fillRect(x, v.G - 58, 2, 58);
    ctx.fillRect(x + 42, v.G - 58, 2, 58);
    ctx.fillRect(x + 21, v.G - 56, 2, 56);
    ctx.fillStyle = tokens.glass;
    ctx.fillRect(x + 2, v.G - 56, 19, 56);
    ctx.fillRect(x + 23, v.G - 56, 19, 56);
  });
  tile(cam * 0.6, 260, v.W, (x) =>
    sign(s, x, Math.max(v.T + 16, v.G - 84), SIGNS.toAdmiralty, SIGNS.toAdmiraltyEn, true),
  );
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
  floor(s, "#E6E5E1");
  const top = v.G - 78;
  const bottom = v.G - 42;
  const winH = bottom - top;

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

    const sign = sx0 + 50;
    const sy = Math.max(top + 6, bottom - 52);
    if (sign > -90 && sign < v.W + 10 && sceneryFor(i) !== "tunnel") {
      ctx.fillStyle = tokens.mid;
      ctx.fillRect(sign + 10, sy + 22, 2, bottom - sy - 22);
      ctx.fillRect(sign + 62, sy + 22, 2, bottom - sy - 22);
      ctx.fillStyle = "#D9D9D9";
      ctx.fillRect(sign, sy, 74, 22);
      ctx.fillStyle = tokens.ink;
      ctx.font = `600 10px ${fontTC}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(STATIONS[i]!.trad, sign + 37, sy + (showEnglish(v) ? 8 : 11));
      if (showEnglish(v)) {
        ctx.font = `500 5px ${fontTC}`;
        ctx.fillText(STATIONS[i]!.en.toUpperCase(), sign + 37, sy + 17);
      }
    }

    const fc0 = Math.round(sx0 + STATION_LEN * 0.55);
    const fc1 = Math.round(sx0 + STATION_LEN * 0.8);
    if (fc1 > 0 && fc0 < v.W) {
      ctx.fillStyle = FIRST_SEAT;
      ctx.fillRect(fc0, v.G - 13, fc1 - fc0, 4);
      ctx.fillRect(fc0, bottom + 2, fc1 - fc0, 3);
      tile(cam, 240, v.W, (x) => {
        if (x < fc0 || x > fc1 - 60) return;
        ctx.fillStyle = tokens.ink;
        ctx.font = `600 9px ${fontTC}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(SIGNS.first, x + 6, top + 4);
        if (showEnglish(v)) {
          ctx.font = `500 5px ${fontTC}`;
          ctx.fillText(SIGNS.firstEn, x + 6, top + 15);
        }
      });
    }
  }

  ctx.fillStyle = FRAME;
  ctx.fillRect(0, top - 2, v.W, 2);
  ctx.fillRect(0, bottom, v.W, 2);
  tile(cam, 96, v.W, (x) => {
    ctx.fillStyle = FRAME;
    ctx.fillRect(x, top, 3, winH);
  });

  ctx.fillStyle = tokens.mid;
  ctx.fillRect(0, v.T + 8, v.W, 1);
  tile(cam, 24, v.W, (x) => {
    ctx.fillRect(x + 2, v.T + 9, 1, 5);
    ctx.fillRect(x + 1, v.T + 14, 3, 1);
    ctx.fillRect(x + 1, v.T + 17, 3, 1);
    ctx.fillRect(x, v.T + 15, 1, 2);
    ctx.fillRect(x + 4, v.T + 15, 1, 2);
  });
  tile(cam, 120, v.W, (x) => ctx.fillRect(x + 60, v.T + 8, 1, v.G - v.T - 8));

  ctx.fillStyle = tokens.far;
  ctx.fillRect(0, v.G - 13, v.W, 4);
  tile(cam, 120, v.W, (x) => {
    ctx.fillRect(x + 20, v.G - 9, 2, 9);
    ctx.fillRect(x + 100, v.G - 9, 2, 9);
  });
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
