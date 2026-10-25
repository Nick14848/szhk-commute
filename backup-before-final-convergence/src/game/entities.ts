import { HURT, npcSpeed, strideOf } from "./balance";
import { actorFrame, SPR, type Sprite } from "../render/sprites";
import type { Kind } from "./stages";

export type Entity = {
  kind: Kind;
  /** 世界坐标，身体中心 */
  x: number;
  /** 离地高度（碰撞底边） */
  y: number;
  phase: number;
  /** 自己走过的距离，用来踩步态 */
  travel: number;
  taken?: boolean;
};

export type Box = { x0: number; x1: number; y0: number; y1: number };

export const PICKUPS = new Set<Kind>(["water", "octopus", "permit", "concession"]);
export const OVERHEAD = new Set<Kind>(["sign"]);
export const OVERHEAD_Y = HURT.overheadBottom;

export function walkSpeed(kind: Kind) {
  return npcSpeed(kind);
}

export function spriteFor(e: Entity, moving: boolean): Sprite {
  const mode = moving && walkSpeed(e.kind) > 0 ? "walk" : "idle";
  const step = strideOf(e.kind);
  const frame = Math.floor(e.travel / step) + Math.floor(e.phase * 6);
  switch (e.kind) {
    case "walker":
    case "office":
    case "luggage":
    case "kid":
    case "elder":
    case "inspector":
    case "staff":
    case "queue":
      return actorFrame(e.kind === "queue" ? "walker" : e.kind, frame, mode);
    default:
      return SPR[e.kind as "water"] ?? SPR.water;
  }
}

export function entityWidth(kind: Kind) {
  if (kind === "queue") return HURT.queueBack + HURT.queueFront;
  if (kind === "luggage") return HURT.luggageHalf * 2;
  if (kind === "kid") return HURT.kidHalf * 2;
  if (kind === "gate") return HURT.gateHalf * 2;
  if (kind === "sign") return HURT.overheadHalf * 2;
  if (kind === "walker" || kind === "office" || kind === "elder" || kind === "inspector" || kind === "staff") return HURT.personHalf * 2;
  return 12;
}

export function hitBox(e: Entity): Box | null {
  if (e.taken) return null;
  const x = e.x;
  const bottom = e.y;
  switch (e.kind) {
    case "kid":
      return { x0: x - HURT.kidHalf, x1: x + HURT.kidHalf, y0: bottom, y1: bottom + HURT.kidTop };
    case "luggage":
      return { x0: x - HURT.luggageHalf, x1: x + HURT.luggageHalf, y0: bottom, y1: bottom + HURT.personTop };
    case "walker":
    case "office":
    case "elder":
    case "inspector":
    case "staff":
      return { x0: x - HURT.personHalf, x1: x + HURT.personHalf, y0: bottom, y1: bottom + HURT.personTop };
    case "queue":
      return { x0: x - HURT.queueBack, x1: x + HURT.queueFront, y0: bottom, y1: bottom + HURT.personTop };
    case "gate":
      return { x0: x - HURT.gateHalf, x1: x + HURT.gateHalf, y0: bottom, y1: bottom + HURT.gateTop };
    case "sign":
      return {
        x0: x - HURT.overheadHalf,
        x1: x + HURT.overheadHalf,
        y0: HURT.overheadBottom,
        y1: HURT.overheadTop,
      };
    default:
      return { x0: x - 6, x1: x + 6, y0: bottom, y1: bottom + 12 };
  }
}

export function overlaps(a: Box, b: Box) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n: number) {
  let h = Math.imul(n | 0, 2654435761);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
