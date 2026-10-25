import { GROUND_Y, PLAYER_VIEW_X, WORLD_H, WORLD_W } from "../game/balance";

export type Rect = { x: number; y: number; w: number; h: number };

export type View = {
  dpr: number;
  cssW: number;
  cssH: number;
  /** 一个世界像素占多少设备像素（整数） */
  pd: number;
  W: number;
  H: number;
  G: number;
  T: number;
  playerX: number;
  hudCss: number;
  safeTop: number;
  safeBottom: number;
  coarse: boolean;
  /** 舞台在画布 backing store 上的左上角（设备像素） */
  offsetX: number;
  offsetY: number;
  /** 高度不够，地面仍留在屏幕里，顶被裁掉 */
  short: boolean;
  controls: { duck: Rect; jump: Rect; big: boolean } | null;
};

const HUD_BODY = 96;

export function computeView(
  cssW: number,
  cssH: number,
  dprRaw: number,
  safeTop: number,
  safeBottom: number,
  coarse: boolean,
  hudBody = HUD_BODY,
): View {
  const dpr = Math.min(3, Math.max(1, dprRaw || 1));
  const hudCss = safeTop + hudBody;
  const padCss = coarse ? 96 : 28;
  const bottomGap = padCss + safeBottom;
  const availW = Math.max(1, cssW * dpr);
  const availH = Math.max(1, (cssH - hudCss - bottomGap) * dpr);
  let pd = Math.floor(Math.min(availW / WORLD_W, availH / WORLD_H));
  if (pd < 1) pd = 1;
  const stageW = WORLD_W * pd;
  const stageH = WORLD_H * pd;
  const offsetX = Math.floor((cssW * dpr - stageW) / 2);
  const top = Math.floor(hudCss * dpr);
  const bottom = Math.floor((cssH - bottomGap) * dpr);
  let offsetY = top;
  if (offsetY + stageH > bottom) offsetY = bottom - stageH;

  return {
    dpr,
    cssW,
    cssH,
    pd,
    W: WORLD_W,
    H: WORLD_H,
    G: GROUND_Y,
    T: 0,
    playerX: PLAYER_VIEW_X,
    hudCss,
    safeTop,
    safeBottom,
    coarse,
    offsetX,
    offsetY,
    short: cssH < 360,
    controls: null,
  };
}

export function inRect(r: Rect, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** 世界像素 -> CSS 像素（不含舞台偏移） */
export function toCss(v: View, art: number) {
  return (art * v.pd) / v.dpr;
}

/** 舞台里的世界坐标 -> 整张画布的 CSS 坐标 */
export function worldToCss(v: View, artX: number, artY: number) {
  return {
    x: (v.offsetX + artX * v.pd) / v.dpr,
    y: (v.offsetY + artY * v.pd) / v.dpr,
  };
}
