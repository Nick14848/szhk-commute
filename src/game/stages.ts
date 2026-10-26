import { BORDER, STATIONS, type Place, type Station } from "../data/copy";
import { BORDER_LENGTHS, RAIL_LENGTH } from "../data/route";

/** 世界单位是"美术像素"。一天 = 口岸四段 + 东铁线 14 站，之后循环到下一天。 */
export const STATION_LEN = RAIL_LENGTH;

export type StageId = "hall" | "gates" | "bridge" | "platform" | "train";

export type Kind =
  | "walker"
  | "office"
  | "luggage"
  | "kid"
  | "elder"
  | "inspector"
  | "staff"
  | "queue"
  | "gate"
  | "sign"
  | "caution"
  | "water"
  | "octopus"
  | "permit"
  | "concession";

type Weight = [Kind, number];

export type Segment = { id: StageId; start: number; end: number; pool: Weight[] };

const BORDER_SPECS: Record<Exclude<StageId, "train">, { len: number; pool: Weight[] }> = {
  hall: { len: BORDER_LENGTHS.hall, pool: [["walker", 5], ["office", 3], ["kid", 3], ["caution", 1]] },
  gates: { len: BORDER_LENGTHS.gates, pool: [["gate", 5], ["walker", 3], ["queue", 2], ["caution", 1]] },
  bridge: { len: BORDER_LENGTHS.bridge, pool: [["walker", 3], ["office", 2], ["luggage", 2], ["kid", 2], ["sign", 3], ["caution", 1]] },
  platform: { len: BORDER_LENGTHS.platform, pool: [["queue", 3], ["walker", 3], ["elder", 2], ["caution", 1]] },
};

const TRAIN_POOL: Weight[] = [
  ["walker", 4],
  ["office", 3],
  ["luggage", 2],
  ["kid", 2],
  ["elder", 2],
  ["queue", 2],
  ["staff", 3],
];

const segments: Segment[] = [];
let cursor = 0;
for (const b of BORDER) {
  const spec = BORDER_SPECS[b.id];
  segments.push({ id: b.id, start: cursor, end: cursor + spec.len, pool: spec.pool });
  cursor += spec.len;
}
export const TRAIN_START = cursor;
segments.push({
  id: "train",
  start: TRAIN_START,
  end: TRAIN_START + STATIONS.length * STATION_LEN,
  pool: TRAIN_POOL,
});
export const SEGMENTS = segments;
export const DAY_LEN = TRAIN_START + STATIONS.length * STATION_LEN;

export function local(x: number) {
  return ((x % DAY_LEN) + DAY_LEN) % DAY_LEN;
}

export function dayOf(x: number) {
  return Math.floor(x / DAY_LEN) + 1;
}

export function segmentAt(x: number): Segment {
  const l = local(x);
  return SEGMENTS.find((s) => l >= s.start && l < s.end) ?? SEGMENTS[0]!;
}

export function stationIndexAt(x: number) {
  const l = local(x);
  if (l < TRAIN_START) return -1;
  return Math.min(STATIONS.length - 1, Math.floor((l - TRAIN_START) / STATION_LEN));
}

export function stationAt(x: number): Station | null {
  const i = stationIndexAt(x);
  return i < 0 ? null : STATIONS[i]!;
}

/** 线路图上的节点：口岸 4 个 + 车站 14 个。 */
export function nodeIndexAt(x: number) {
  const i = stationIndexAt(x);
  if (i >= 0) return BORDER.length + i;
  return Math.max(0, BORDER.findIndex((b) => b.id === segmentAt(x).id));
}

export function placeAt(x: number): Place {
  return stationAt(x) ?? BORDER.find((b) => b.id === segmentAt(x).id) ?? BORDER[0]!;
}

/** 旧存档只有站名时，进度记到该地点的起点，不记成已经走完。 */
export function legacyProgress(station: string, day: number) {
  const base = Math.max(0, (Number.isInteger(day) && day > 0 ? day : 1) - 1) * DAY_LEN;
  const border = BORDER.findIndex((b) => b.simp === station || b.trad === station);
  if (border >= 0) return base + (SEGMENTS[border]?.start ?? 0);
  const stop = STATIONS.findIndex((s) => s.simp === station || s.trad === station);
  if (stop >= 0) return base + TRAIN_START + stop * STATION_LEN;
  return base;
}

const bridgeStart = SEGMENTS.find((s) => s.id === "bridge")!.start;
const WALKWAYS: readonly (readonly [number, number])[] = [[360, 1008], [1368, 2016], [2376, 3024]]
  .map(([a, b]) => [bridgeStart + a!, bridgeStart + b!] as const);

export function travelatorRanges() { return WALKWAYS; }

/** Smooth spatial ramp, identical for rendering and rules, no accumulating multiplier. */
export function travelatorBoost(x: number) {
  const l = local(x);
  for (const [a, b] of WALKWAYS) {
    if (l < a || l >= b) continue;
    const t = Math.min(1, (l - a) / 36, (b - l) / 36);
    return t * t * (3 - 2 * t);
  }
  return 0;
}

export function onTravelator(x: number) {
  const l = local(x);
  return WALKWAYS.some(([a, b]) => l >= a && l < b);
}

export function boundaryX() {
  const bridge = SEGMENTS.find((s) => s.id === "bridge")!;
  return bridge.start + (bridge.end - bridge.start) * 0.5;
}

/** 每站后段一截是头等车厢，检票员只在这里出现。 */
export function inFirstClass(x: number) {
  const i = stationIndexAt(x);
  if (i < 0) return false;
  const t = (local(x) - TRAIN_START - i * STATION_LEN) / STATION_LEN;
  return t > 0.55 && t < 0.8;
}

/** 两道自助闸机前后不生成障碍，人可以从打开的门走过去。 */
export function inSafeJoin(x: number) {
  const l = local(x);
  const joins = SEGMENTS.slice(0, 4).map((seg) => seg.end);
  return joins.some((door) => l > door - 110 && l < door + 48);
}

export function pickKind(x: number, rng: () => number, allowOverhead: boolean): Kind {
  const seg = segmentAt(x);
  let pool = seg.pool;
  if (seg.id === "train" && inFirstClass(x)) pool = [["inspector", 6], ["walker", 2], ["office", 1]];
  if (!allowOverhead) pool = pool.filter(([k]) => k !== "sign");
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [kind, w] of pool) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return pool[0]![0];
}
