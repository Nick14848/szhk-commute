import { tokens } from "../design/tokens";
import type { View } from "./view";

export type DoorKind = "depart" | "pillars" | "glass" | "stair" | "train" | "tunnel";

/**
 * cover 是 0 到 1。1 时左右两扇各占半个画面，在中间合上。
 * 不要用整屏宽度乘 cover，否则 0.5 就已经挡死。
 */
export function drawDoor(
  ctx: CanvasRenderingContext2D,
  v: View,
  kind: DoorKind,
  cover: number,
) {
  const amount = Math.max(0, Math.min(1, cover));
  if (amount <= 0.02) return;
  const half = v.W / 2;
  const span = Math.max(1, Math.round(half * amount));
  const top = v.T;
  const h = v.H - top;

  if (kind === "glass") {
    ctx.fillStyle = "#D5E4EA";
    ctx.fillRect(0, top, span, h);
    ctx.fillRect(v.W - span, top, span, h);
    ctx.fillStyle = tokens.white;
    ctx.fillRect(span - 2, top, 2, h);
    ctx.fillRect(v.W - span, top, 2, h);
    return;
  }

  if (kind === "stair") {
    ctx.fillStyle = "#C5CED4";
    const steps = 6;
    const band = Math.round(h / steps);
    for (let i = 0; i < steps; i++) {
      const y = top + i * band;
      const w = Math.round(span * (0.55 + (i % 2) * 0.45));
      ctx.fillRect(0, y, w, band - 1);
      ctx.fillRect(v.W - w, y, w, band - 1);
    }
    return;
  }

  ctx.fillStyle = kind === "tunnel" ? "#1A1A1A" : "#2C3138";
  ctx.fillRect(0, top, span, h);
  ctx.fillRect(v.W - span, top, span, h);
  if (kind === "depart" || kind === "pillars") {
    ctx.fillStyle = tokens.line;
    ctx.fillRect(Math.max(0, span - 3), top, 3, h);
    ctx.fillRect(v.W - span, top, 3, h);
  }
  if (kind === "train") {
    ctx.fillStyle = tokens.alert;
    ctx.fillRect(Math.max(0, span - 4), v.G - 36, 4, 8);
    ctx.fillRect(v.W - span, v.G - 36, 4, 8);
  }
}
