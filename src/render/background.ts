import { fontTC, tokens } from "../design/tokens";
import { SIGNS, STATIONS } from "../data/copy";
import { hash } from "../game/entities";
import {
  DAY_LEN,
  SEGMENTS,
  STATION_LEN,
  TRAIN_START,
  boundaryX,
  travelatorRanges,
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
  ctx.fillRect(0, v.T, v.W, v.H - v.T);

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
      ctx.rect(Math.max(0, x0), v.T, Math.min(v.W, x1) - Math.max(0, x0), v.H - v.T);
      ctx.clip();
      drawStage(seg.id, { ctx, v, cam, base, time, reduced });
      ctx.restore();
    }
    drawJoin(ctx, v, cam, base);
  }

  ctx.fillStyle = tokens.ink;
  ctx.fillRect(0, v.G, v.W, 1);
  // Deliberate slab joints instead of scattered pixel noise.
  ctx.fillStyle = "#68798120";
  tile(cam, 64, v.W, (x) => ctx.fillRect(x, v.G + 12, 1, v.H - v.G - 12));
  ctx.fillRect(0, v.G + 22, v.W, 1);
}

function drawJoin(ctx: Ctx, v: View, cam: number, base: number) {
  drawGate(ctx, v, cam, base + SEGMENTS[0]!.end, "出境查验");
  drawGate(ctx, v, cam, base + SEGMENTS[2]!.end, "入境查验");
  // One shared glass vestibule hides the material seam into the footbridge.
  const x = Math.round(base + SEGMENTS[1]!.end - cam);
  if (x > -56 && x < v.W + 56) {
    ctx.fillStyle = "#C8D4D9";
    ctx.fillRect(x - 44, v.T, 88, v.G - v.T);
    ctx.fillStyle = "#E8F0EF";
    ctx.fillRect(x - 36, v.T + 14, 72, v.G - v.T - 30);
    ctx.fillStyle = "#9AAFB9";
    for (const dx of [-44, -2, 40]) ctx.fillRect(x + dx, v.T + 8, 4, v.G - v.T - 8);
    ctx.fillStyle = "#273943";
    ctx.fillRect(x - 44, v.T + 5, 88, 9);
    ctx.fillStyle = "#F7F7F2";
    ctx.font = `600 6px ${fontTC}`;
    ctx.textAlign = "center";
    ctx.fillText("深港天橋  →", x, v.T + 12);
  }
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
  const cx = Math.round(x);
  ctx.fillStyle = "#677D89";
  ctx.fillRect(cx - 17, ground - 2, 34, 2);
  for (const dx of [-16, 2]) {
    const door = cx + dx;
    ctx.fillStyle = "#5F7682";
    ctx.fillRect(door, ground - 23, 3, 23);
    ctx.fillRect(door + 11, ground - 23, 3, 23);
    ctx.fillStyle = "#D8E0E1";
    ctx.fillRect(door + 1, ground - 22, 2, 18);
    ctx.fillRect(door + 11, ground - 22, 2, 18);
    // Two closed, double-opening glass leaves per stage of the channel.
    ctx.fillStyle = "#80ADBD";
    ctx.fillRect(door + 3, ground - 19, 4, 18);
    ctx.fillRect(door + 7, ground - 19, 4, 18);
    ctx.fillStyle = "#E2F0EE";
    ctx.fillRect(door + 4, ground - 18, 1, 15);
    ctx.fillRect(door + 9, ground - 18, 1, 15);
    ctx.fillStyle = "#547885";
    ctx.fillRect(door + 7, ground - 19, 1, 18);
    ctx.fillStyle = "#C55C4D";
    ctx.fillRect(door, ground - 23, 3, 2);
  }
  // First door: card reader. Second: small face screen + fingerprint pad.
  ctx.fillStyle = "#163F59";
  ctx.fillRect(cx - 18, ground - 16, 5, 7);
  ctx.fillStyle = "#8DD0E1";
  ctx.fillRect(cx - 17, ground - 15, 3, 3);
  ctx.fillStyle = "#344C5C";
  ctx.fillRect(cx + 3, ground - 28, 11, 7);
  ctx.fillStyle = "#86BFC5";
  ctx.fillRect(cx + 4, ground - 27, 9, 5);
  ctx.fillStyle = "#E3F1EA";
  ctx.fillRect(cx + 7, ground - 26, 2, 2);
  ctx.fillRect(cx + 6, ground - 24, 4, 1);
  ctx.fillStyle = "#344C5C";
  ctx.fillRect(cx + 14, ground - 14, 4, 5);
  ctx.fillStyle = "#8DD0C6";
  ctx.fillRect(cx + 15, ground - 13, 2, 3);
}

/** Original A-frame wet-floor sign. Legs sit on the collision baseline. */
export function drawCautionSign(ctx: Ctx, x: number, ground: number) {
  const cx = Math.round(x);
  ctx.fillStyle = "#A78323";
  ctx.beginPath();
  ctx.moveTo(cx + 2, ground - 21); ctx.lineTo(cx + 7, ground - 21);
  ctx.lineTo(cx + 11, ground); ctx.lineTo(cx + 7, ground); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#F4CC35";
  ctx.beginPath();
  ctx.moveTo(cx - 5, ground - 21); ctx.lineTo(cx + 3, ground - 21);
  ctx.lineTo(cx + 8, ground); ctx.lineTo(cx - 10, ground); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6A592B";
  ctx.fillRect(cx - 10, ground - 1, 4, 1); ctx.fillRect(cx + 5, ground - 1, 6, 1);
  ctx.fillRect(cx - 2, ground - 19, 3, 1);
  ctx.beginPath();
  ctx.moveTo(cx - 1, ground - 17); ctx.lineTo(cx - 5, ground - 11); ctx.lineTo(cx + 3, ground - 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#F4CC35";
  ctx.fillRect(cx - 1, ground - 15, 1, 2);
  ctx.fillRect(cx - 1, ground - 12, 1, 1);
  ctx.fillStyle = "#493E21";
  ctx.font = `700 5px ${fontTC}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("小心", cx - 1, ground - 8);
  ctx.fillText("地滑", cx - 1, ground - 3);
}

function drawStage(id: StageId, s: Scene) {
  const wall = { hall: "#E4D9C8", gates: "#D7E0E6", bridge: "#E3EEF0", platform: "#E3E1D8", train: "#EDF0ED" };
  s.ctx.fillStyle = wall[id];
  s.ctx.fillRect(0, s.v.T, s.v.W, s.v.G - s.v.T);
  if (id === "hall") hall(s);
  else if (id === "gates") gates(s);
  else if (id === "bridge") bridge(s);
  else if (id === "platform") platform(s);
  else train(s);
  if (id !== "train") stageDetails(id, s);
}

function stageDetails(id: Exclude<StageId, "train">, s: Scene) {
  const {ctx, v, cam, base} = s;
  const seg = SEGMENTS.find((seg) => seg.id === id)!;
  // A single quiet placement along the entire bridge, never in the checkpoint.
  if (id === "bridge") {
    const ax = Math.round(base + seg.start + 1280 - cam);
    if (ax > -70 && ax < v.W + 70) adPoster(ctx, ax, v.G - 121);
  }
  if (id === "gates") {
    const x = Math.round(base + seg.start + 540 - cam);
    if (x > -140 && x < v.W + 140) securityScanner(ctx, x, v.G, s.time, s.reduced);
  }
}

function adPoster(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#A1ADB0"; ctx.fillRect(x - 1, y - 1, 62, 37);
  ctx.fillStyle = "#F6F3E9"; ctx.fillRect(x, y, 60, 35);
  ctx.fillStyle = "#183F56"; ctx.fillRect(x + 3, y + 3, 54, 24);
  ctx.fillStyle = "#F7F6ED";
  ctx.font = `700 10px ${fontTC}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("广告示意", x + 30, y + 15);
  ctx.fillStyle = "#A2B0AE"; ctx.fillRect(x + 7, y + 30, 29, 1); ctx.fillRect(x + 39, y + 30, 14, 1);
}

function securityScanner(ctx: Ctx, x: number, floor: number, time: number, reduced: boolean) {
  // Large, muted background equipment, never a hitbox. Its support feet and
  // shared mounting slab reach the actual floor instead of ending in mid-air.
  ctx.fillStyle = "#B3BEC2"; ctx.fillRect(x - 18, floor - 2, 146, 2);
  ctx.fillStyle = "#C6CFD0"; ctx.fillRect(x - 16, floor - 3, 142, 1);
  ctx.fillStyle = "#8C9EA7"; ctx.fillRect(x - 14, floor - 13, 103, 8);
  ctx.fillStyle = "#3C505C"; ctx.fillRect(x - 12, floor - 13, 99, 3);
  const shift = reduced ? 0 : Math.floor(time * 8) % 4;
  ctx.fillStyle = "#819298";
  for (let roller = x - 10 + shift; roller < x + 85; roller += 4) ctx.fillRect(roller, floor - 12, 1, 2);
  for (const leg of [-8, 77]) {
    ctx.fillRect(x + leg, floor - 5, 4, 4);
    ctx.fillRect(x + leg - 2, floor - 2, 8, 2);
  }
  ctx.fillStyle = "#BAC7CD"; ctx.fillRect(x + 8, floor - 61, 49, 49);
  ctx.fillStyle = "#E2E7E6"; ctx.fillRect(x + 11, floor - 58, 43, 43);
  ctx.fillStyle = "#253D4D"; ctx.fillRect(x + 10, floor - 29, 42, 16);
  ctx.fillStyle = "#435560";
  for (let strip = 0; strip < 7; strip++) ctx.fillRect(x + 12 + strip * 5, floor - 28, 3, 14);
  ctx.fillStyle = "#405B6A"; ctx.fillRect(x + 37, floor - 53, 16, 13);
  ctx.fillStyle = "#8AB4BD"; ctx.fillRect(x + 39, floor - 51, 12, 9);
  ctx.fillStyle = "#6B8C8E"; ctx.fillRect(x - 2, floor - 23, 9, 10);
  ctx.fillStyle = "#D1DAD9"; ctx.fillRect(x, floor - 23, 5, 2);
  // Walk-through arch behind the foreground running lane.
  ctx.fillStyle = "#8198A4"; ctx.fillRect(x + 94, floor - 72, 30, 72);
  ctx.fillStyle = "#D2DDE1"; ctx.fillRect(x + 98, floor - 65, 22, 65);
  ctx.fillStyle = "#B8C9D1"; ctx.fillRect(x + 101, floor - 61, 16, 61);
  ctx.fillStyle = "#647E89"; ctx.fillRect(x + 95, floor - 70, 28, 5);
  ctx.fillStyle = "#91B4A6"; ctx.fillRect(x + 99, floor - 69, 18, 2);
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
  const galleryTop = v.T + 48;
  const galleryH = Math.max(20, v.G - 84 - galleryTop);
  tile(cam * 0.3, 170, v.W, (x) => {
    // High clerestory glazing makes the tall portrait frame an actual hall.
    ctx.fillStyle = "#C7CCC4";
    ctx.fillRect(x + 13, galleryTop - 3, 144, galleryH + 6);
    ctx.fillStyle = "#BCD2D3";
    ctx.fillRect(x + 16, galleryTop, 138, galleryH);
    ctx.fillStyle = "#D7E4DE";
    ctx.fillRect(x + 17, galleryTop + 1, 136, Math.max(1, galleryH * .46));
    ctx.fillStyle = "#A4B5B4";
    for (let i = 1; i < 6; i++) ctx.fillRect(x + 14 + i * 24, galleryTop, 2, galleryH);
    ctx.fillRect(x + 14, galleryTop + Math.floor(galleryH * .46), 140, 2);
    ctx.fillStyle = "#D0C5B5";
    ctx.fillRect(x + 13, v.G - 70, 144, 2);
  });
  tile(cam * 0.32 + 50, 240, v.W, (x) => {
    ctx.fillStyle = "#758B8B";
    ctx.fillRect(x, v.G - 62, 92, 18);
    ctx.fillStyle = "#F6F5E8";
    ctx.font = `700 8px ${fontTC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("福田口岸  FUTIAN PORT", x + 46, v.G - 53);
  });
  tile(cam * 0.2, 180, v.W, (x) => {
    x += 70;
    const y = v.G - 44;
    ctx.fillStyle = "#9DA3A0";
    ctx.fillRect(x - 2, y + 18, 12, 1);
    ctx.fillStyle = "#697D87";
    ctx.fillRect(x, y, 7, 11);
    ctx.fillStyle = "#55646C";
    ctx.fillRect(x, y + 10, 3, 8);
    ctx.fillRect(x + 5, y + 10, 3, 8);
    ctx.fillStyle = "#D5BEA2";
    ctx.fillRect(x + 1, y - 5, 5, 5);
    ctx.fillStyle = "#55646C";
    ctx.fillRect(x, y - 7, 7, 3);
    ctx.fillStyle = "#D9D6B4";
    ctx.fillRect(x + 4, y + 2, 1, 2);
  });
  lamps(s, time, tokens.exit);
  tile(cam * 0.35, 150, v.W, (x, i) => booth(ctx, x, v.G, hash(i) > 0.5));
  tile(cam * 0.5, 250, v.W, (x, i) => {
    const manual = Math.abs(i) % 2 === 0;
    ctx.fillStyle = "#81949D";
    for (const dx of [10, 81]) ctx.fillRect(x + dx, v.T + 2, 1, 16);
    ctx.fillStyle = "#164C89";
    ctx.fillRect(x, v.T + 18, 92, 26);
    ctx.fillStyle = "#43BEDD";
    ctx.fillRect(x, v.T + 42, 92, 2);
    ctx.fillStyle = "#F7F7F7";
    ctx.font = `700 9px ${fontTC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(manual ? "人工查验" : SIGNS.departure, x + 40, v.T + 28);
    ctx.font = `500 6px ${fontTC}`;
    ctx.fillText(manual ? "Manual Channel" : SIGNS.departureEn, x + 40, v.T + 37);
    ctx.fillRect(x + 76, v.T + 29, 9, 2);
    ctx.beginPath(); ctx.moveTo(x + 89, v.T + 30); ctx.lineTo(x + 83, v.T + 25); ctx.lineTo(x + 83, v.T + 35); ctx.closePath(); ctx.fill();
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
  const y = G - 16;
  ctx.fillStyle = "#BCC6C7";
  ctx.fillRect(x, y - 8, 44, 6);
  ctx.fillStyle = "#F0F1E9";
  ctx.fillRect(x + 2, y - 2, 40, 13);
  ctx.fillStyle = "#9AA6A6";
  ctx.fillRect(x, y - 8, 44, 2);
  ctx.fillRect(x + 4, y + 10, 36, 2);
  ctx.fillStyle = "#99BBC6";
  ctx.fillRect(x + 2, y - 36, 40, 27);
  ctx.fillStyle = "#D8E7E6";
  ctx.fillRect(x + 4, y - 34, 36, 23);
  ctx.fillStyle = "#708C97";
  ctx.fillRect(x + 2, y - 36, 40, 2);
  ctx.fillRect(x + 22, y - 34, 2, 25);
  ctx.fillStyle = "#586B74";
  ctx.fillRect(x + 8, y - 20, 8, 10);
  ctx.fillStyle = tall ? "#8DCEBD" : "#9BC9DA";
  ctx.fillRect(x + 9, y - 19, 6, 5);
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
  const panelTop = v.T + 44;
  const panelH = Math.max(18, v.G - 104 - panelTop);
  tile(cam * 0.3, 200, v.W, (x) => {
    ctx.fillStyle = "#CDD8DC";
    ctx.fillRect(x + 16, panelTop, 166, panelH);
    ctx.fillStyle = "#E0E6E6";
    ctx.fillRect(x + 18, panelTop + 2, 162, panelH - 4);
    ctx.fillStyle = "#BACAD0";
    ctx.fillRect(x + 70, panelTop, 1, panelH);
    ctx.fillRect(x + 126, panelTop, 1, panelH);
    ctx.fillStyle = "#BBC9CD";
    ctx.fillRect(x + 38, panelTop + 12, 120, 5);
    ctx.fillStyle = "#839AA5";
    for (let louver = 0; louver < 28; louver++) ctx.fillRect(x + 42 + louver * 4, panelTop + 13, 1, 3);
  });
  lamps(s, time, tokens.exit);
  tile(cam * 0.45, 28, v.W, (x, i) => {
    ctx.fillStyle = tokens.far;
    ctx.fillRect(x, v.G - 26, 4, 26);
    ctx.fillRect(x + 4, v.G - 16, 8, 3);
    ctx.fillStyle = tokens.exit;
    ctx.fillRect(x + 1, v.G - 24, 2, 2);
  });
  tile(cam * 0.6, 220, v.W, (x) => {
    sign(s, x, v.T + 18, SIGNS.echannel, SIGNS.echannelEn);
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

  for (const [a, b] of travelatorRanges()) {
  const tx0 = Math.round(base + a - cam);
  const tx1 = Math.round(base + b - cam);
  if (tx1 > 0 && tx0 < v.W) {
    // Hanging wayfinding at each actual walkway entrance, not an extra HUD.
    const boardY = v.T + 24;
    ctx.fillStyle = "#7F949F";
    for (const dx of [10, 58]) ctx.fillRect(tx0 + dx, v.T + 2, 1, boardY - v.T - 2);
    ctx.fillStyle = "#173F61"; ctx.fillRect(tx0 + 2, boardY, 66, 19);
    ctx.fillStyle = "#F7FAF2";
    ctx.font = `700 8px ${fontTC}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("自助人行道", tx0 + 35, boardY + 9.5);
    for (let x = tx0; x < tx1; x += 28) {
      ctx.fillStyle = "#C5D6E0";
      ctx.fillRect(x, v.G - 24, 2, 24);
      ctx.fillStyle = "#E7F2F6";
      ctx.fillRect(x + 2, v.G - 20, 24, 12);
    }
    ctx.fillStyle = "#5C6770";
    ctx.fillRect(tx0, v.G - 24, Math.max(0, tx1 - tx0), 3);
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
    ctx.fillStyle = "#E4CA67";
    for (const edge of [tx0, tx1 - 4]) ctx.fillRect(edge, v.G - 1, 4, 7);
  }
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
    // The 20-unit bilingual board ends fourteen units above the train roof.
    // Previously it was anchored to the floor and overlapped the door glazing.
    const boardY = Math.max(v.T + 16, trainTop - 34);
    sign(s, x, boardY, SIGNS.toAdmiralty, SIGNS.toAdmiraltyEn, true);
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
  ctx.fillStyle = "#EDF0ED";
  ctx.fillRect(0, v.T, v.W, v.G - v.T);
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

  const origin = base + TRAIN_START;
  // A full six-seat bay plus a generous double-door bay. All fittings use this
  // same origin, so ceiling seams, windows and doors cannot drift out of align.
  const module = 320;
  const firstMod = Math.floor((cam - 30 - origin) / module) - 1;
  const lastMod = Math.ceil((cam + v.W - origin) / module);
  for (let m = firstMod; m <= lastMod; m++) {
    const wx = origin + m * module;
    const x = Math.round(wx - cam);
    ctx.fillStyle = "#D5DDD9";
    for (const dx of [12, 220]) ctx.fillRect(x + dx, v.T + 20, 1, Math.max(0, top - v.T - 42));
    ctx.fillStyle = "#CAD3D1";
    const ventY = Math.max(v.T + 16, top - 28);
    ctx.fillRect(x + 48, ventY, 136, 4);
    ctx.fillStyle = "#8D9E9F";
    for (let i = 0; i < 32; i++) ctx.fillRect(x + 52 + i * 4, ventY + 1, 1, 2);

    ctx.fillStyle = "#C5CED6";
    ctx.fillRect(x, farFloor, module, v.G - farFloor);
    ctx.fillStyle = "#B7C0C8";
    ctx.fillRect(x, farFloor, module, 3);
    // Off-white wall piers separate two broad windows from the doorway. The
    // glazing remains above the bench rather than continuing through the door.
    ctx.fillStyle = "#E6EAE5";
    ctx.fillRect(x, top - 3, 14, farFloor - top + 3);
    ctx.fillRect(x + 218, top - 3, 102, farFloor - top + 3);
    ctx.fillStyle = "#9AA9AD";
    for (const dx of [14, 115, 216]) ctx.fillRect(x + dx, top, 2, winH);
    ctx.fillStyle = "#D9E2DF";
    for (const dx of [16, 117]) ctx.fillRect(x + dx, top + 1, 1, winH - 2);
    ctx.fillStyle = "#9AA9AD";
    ctx.fillRect(x + 14, bottom + 3, 204, 1);
    ctx.fillStyle = "#CAD3CE";
    ctx.fillRect(x + 222, top + 1, 1, farFloor - top - 2);

    const sx = x + 20;
    const benchWidth = 192;
    const cushion = farFloor - 9;
    const backTop = bottom + 7;
    // One continuous six-person metal bench: shared back, seat and supports.
    ctx.fillStyle = "#87969F";
    ctx.fillRect(sx, backTop, benchWidth, cushion - backTop + 7);
    ctx.fillStyle = "#D5DFE2";
    ctx.fillRect(sx + 1, backTop + 1, benchWidth - 2, cushion - backTop);
    ctx.fillStyle = "#BBC8CE";
    ctx.fillRect(sx + 1, cushion, benchWidth - 2, 5);
    ctx.fillStyle = "#E8EEF0";
    ctx.fillRect(sx + 1, cushion, benchWidth - 2, 1);
    ctx.fillStyle = "#7E929C";
    for (let i = 1; i < 6; i++) ctx.fillRect(sx + i * 32, backTop + 3, 1, cushion - backTop + 2);
    for (const foot of [24, 92, 164]) {
      ctx.fillRect(sx + foot, cushion + 6, 4, farFloor - cushion - 6);
      ctx.fillRect(sx + foot - 3, farFloor - 2, 10, 2);
    }
    for (const end of [0, benchWidth - 2]) ctx.fillRect(sx + end, cushion - 5, 2, 11);
    trainDoor(ctx, x + 242, top, farFloor);

    // A small flush service panel adds wall structure, not another ad/screen.
    ctx.fillStyle = "#B7C3C3";
    ctx.fillRect(x + 310, top + 40, 7, 18);
    ctx.fillStyle = "#DEE5DF";
    ctx.fillRect(x + 311, top + 41, 5, 16);
    ctx.fillStyle = "#8A9C9E";
    ctx.fillRect(x + 313, top + 49, 1, 2);

    const pole = x + 229;
    ctx.fillStyle = "#9C9F7B";
    ctx.fillRect(pole, v.T + 13, 3, farFloor - v.T - 13);
    ctx.fillStyle = "#F1D967";
    ctx.fillRect(pole, top - 2, 3, farFloor - top);
    ctx.fillStyle = "#FFF0A5";
    ctx.fillRect(pole, top, 1, farFloor - top - 3);
    for (const dx of [26, 62, 98, 134, 170, 206]) {
      ctx.fillStyle = "#9AA8AD";
      ctx.fillRect(x + dx + 6, top - 14, 2, 5);
      hollowRing(ctx, x + dx, top - 10);
    }

  }

  ctx.fillStyle = "#9AA8AD";
  ctx.fillRect(0, top - 14, v.W, 2);
  ctx.fillStyle = "#CAD4D6";
  ctx.fillRect(0, v.T + 8, v.W, 5);
  ctx.fillStyle = "#F9FCF6";
  tile(cam - origin, module, v.W, (x) => ctx.fillRect(x + 42, v.T + 9, 144, 2));

  ctx.fillStyle = "#D7DCE1";
  ctx.fillRect(0, v.G + 10, v.W, 8);
  ctx.fillStyle = "#B7BDC4";
  ctx.fillRect(0, v.G + 10, v.W, 3);
}

/** Pixel-rounded double doors: broad leafs, dark glazing and restrained edging. */
function trainDoor(ctx: Ctx, x: number, top: number, floor: number) {
  const height = floor - top;
  ctx.fillStyle = "#85969E";
  ctx.fillRect(x, top - 3, 64, height + 3);
  ctx.fillStyle = "#D8E1DD";
  ctx.fillRect(x + 2, top - 1, 60, height - 1);
  ctx.fillStyle = "#EEF2EA";
  ctx.fillRect(x + 3, top, 1, height - 2);
  ctx.fillRect(x + 60, top, 1, height - 2);
  for (const leaf of [6, 36]) {
    ctx.fillStyle = "#293D47";
    ctx.fillRect(x + leaf + 2, top + 5, 16, 30);
    ctx.fillRect(x + leaf, top + 7, 20, 26);
    ctx.fillStyle = "#98B1B8";
    ctx.fillRect(x + leaf + 3, top + 8, 14, 24);
    ctx.fillRect(x + leaf + 2, top + 10, 16, 20);
    ctx.fillStyle = "#C6D7D6";
    ctx.fillRect(x + leaf + 5, top + 10, 1, 18);
    ctx.fillRect(x + leaf + 6, top + 10, 5, 1);
    ctx.fillStyle = "#BDC9C7";
    ctx.fillRect(x + leaf - 1, top + 42, 23, Math.max(1, height - 46));
    ctx.fillStyle = "#D2DCDA";
    ctx.fillRect(x + leaf, top + 43, 21, Math.max(1, height - 48));
  }
  ctx.fillStyle = "#748890";
  ctx.fillRect(x + 31, top, 1, height);
  for (const grip of [28, 35]) ctx.fillRect(x + grip, top + 44, 1, 12);
  ctx.fillStyle = "#D8BF5D";
  for (const edge of [-1, 64]) ctx.fillRect(x + edge, top + 1, 1, height - 2);
  ctx.fillStyle = "#B8C4C1";
  ctx.fillRect(x + 2, top - 8, 60, 4);
  ctx.fillStyle = "#5D7177";
  ctx.fillRect(x + 22, top - 7, 20, 2);
  ctx.fillStyle = "#AFC5B3";
  ctx.fillRect(x + 30, top - 7, 4, 2);
  ctx.fillStyle = "#71858E";
  ctx.fillRect(x, floor - 2, 64, 2);
}

function hollowRing(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#8E979E";
  ctx.fillRect(x + 6, y, 2, 3);
  ctx.fillStyle = "#4F7894";
  ctx.fillRect(x + 5, y + 3, 4, 2);
  ctx.fillRect(x + 3, y + 5, 2, 2);
  ctx.fillRect(x + 9, y + 5, 2, 2);
  ctx.fillRect(x + 1, y + 7, 2, 3);
  ctx.fillRect(x + 11, y + 7, 2, 3);
  ctx.fillRect(x + 3, y + 9, 8, 2);
  ctx.fillStyle = "#87AEC2";
  ctx.fillRect(x + 3, y + 7, 1, 2);
  ctx.fillRect(x + 4, y + 9, 5, 1);
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
  ctx.rect(-20, v.T - 8, v.W + 40, v.H - v.T + 16);
  for (const sx of gateBands(s)) ctx.rect(sx - 58, v.T - 8, 116, v.H - v.T + 16);
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
