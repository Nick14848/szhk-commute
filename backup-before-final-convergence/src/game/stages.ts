import { BORDER, STATIONS, type Place, type Station } from "../data/copy";

/** 世界单位是"美术像素"。一天 = 口岸四段 + 东铁线 14 站，之后循环到下一天。 */
export const STATION_LEN = 1300;

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
  | "water"
  | "octopus"
  | "permit"
  | "concession";

type Weight = [Kind, number];

export type Segment = { id: StageId; start: number; end: number; pool: Weight[] };

const BORDER_SPECS: Record<Exclude<StageId, "train">, { len: number; pool: Weight[] }> = {
  hall: { len: 1200, pool: [["walker", 5], ["office", 3], ["kid", 3]] },
  gates: { len: 1000, pool: [["gate", 5], ["walker", 3], ["queue", 2]] },
  bridge: { len: 1560, pool: [["walker", 3], ["office", 2], ["luggage", 2], ["kid", 2], ["sign", 3]] },
  platform: { len: 820, pool: [["queue", 3], ["walker", 3], ["elder", 2]] },
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

export function travelatorRange(): [number, number] {
  const bridge = SEGMENTS.find((s) => s.id === "bridge")!;
  const span = bridge.end - bridge.start;
  return [bridge.start + span * 0.3, bridge.start + span * 0.62];
}

export function onTravelator(x: number) {
  const [a, b] = travelatorRange();
  const l = local(x);
  return l >= a && l < b;
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
  const joins = [SEGMENTS[0]!.end, SEGMENTS[2]!.end];
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
