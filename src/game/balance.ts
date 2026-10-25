import { STATIONS } from "../data/copy";
import { dayOf, local, onTravelator, stationIndexAt, TRAIN_START } from "./stages";

/**
 * 玩法单位和画面宽度分开。
 * 速度、跳跃、生成间距都用这里的数。改画面大小不会改这些数。
 *
 * 第一趟通勤的体验目标大约 3 到 4 分钟（含准备和过场）。
 * 这是设计目标，不是实测通关时间。
 */

export const WORLD_W = 256;
export const WORLD_H = 168;
export const GROUND_Y = 132;
export const PLAYER_VIEW_X = 52;

export const STEP = 1 / 60;
export const MAX_CATCHUP = 4;
export const FRAME_CAP = 0.1;

export const PREP_SECONDS = 0.7;
export const PREP_SECONDS_REDUCED = 0.2;
export const RAMP_SECONDS = 7;
export const FIRST_LOOKAHEAD = 7.4;
export const SAFE_AFTER_DOOR = 1.15;
export const SEAT_WIN_SEC = 6;
export const SEAT_LOSE_SEC = 8;

export const SPEED_EASE = 62;
export const SPEED_BASE = 74;
export const SPEED_LATE = 102;
export const TRAVELATOR = 1.12;

export const PHYS = {
  gravity: 900,
  jump: 360,
  jump2: 300,
  fastFall: 2.4,
  coyote: 0.1,
  buffer: 0.12,
};

/** 碰撞用固定世界尺寸，不读精灵外框。 */
export const HURT = {
  playerHalf: 6,
  standTop: 28,
  duckTop: 14,
  duckBack: 10,
  duckFront: 12,
  personHalf: 6,
  personTop: 22,
  queueBack: 18,
  queueFront: 18,
  gateHalf: 8,
  gateTop: 18,
  kidHalf: 4,
  kidTop: 16,
  luggageHalf: 9,
  overheadHalf: 28,
  overheadBottom: 22,
  overheadTop: 38,
};

const PICKUPS = new Set(["water", "octopus", "permit", "concession"]);

export function parseTimeScale(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  if (raw < 1 || raw > 12) return 1;
  if (Math.floor(raw) !== raw) return 1;
  return raw;
}

export function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function progressOf(px: number) {
  const along = local(px);
  const station = stationIndexAt(px);
  const before = Math.min(1, along / Math.max(1, TRAIN_START));
  if (station < 0) return before * 0.3;
  return 0.3 + ((station + 1) / STATIONS.length) * 0.7;
}

/** 世界单位/秒。不读取视野宽度。 */
export function speedAt(px: number, runTime: number) {
  if (runTime <= 0) return 0;
  const day = Math.max(1, dayOf(px));
  const dayAdd = Math.min(16, (day - 1) * 3);
  const cruise = SPEED_BASE + progressOf(px) * (SPEED_LATE - SPEED_BASE) + dayAdd;
  const v = SPEED_EASE + (cruise - SPEED_EASE) * smoothstep(runTime / RAMP_SECONDS);
  return onTravelator(px) ? v * TRAVELATOR : v;
}

/** 脚高于 height 的时间（秒）。单跳。 */
export function jumpClearance(height: number) {
  const g = PHYS.gravity;
  const v = PHYS.jump;
  const disc = v * v - 2 * g * height;
  if (disc <= 0) return 0;
  const s = Math.sqrt(disc);
  return (v + s) / g - (v - s) / g;
}

export function npcSpeed(kind: string) {
  if (kind === "walker" || kind === "inspector") return 16;
  if (kind === "office") return 14;
  if (kind === "kid") return 18;
  if (kind === "luggage") return 10;
  if (kind === "elder") return 8;
  return 0;
}

/** 走一帧要踩过多少世界单位。各人步幅不同，不再所有人 11 单位一帧。 */
export function strideOf(kind: string) {
  if (kind === "player") return 8;
  if (kind === "elder") return 4;
  if (kind === "kid") return 5;
  if (kind === "luggage") return 5;
  return 6;
}

export function obstacleWidth(kind: string) {
  if (kind === "queue") return HURT.queueBack + HURT.queueFront;
  if (kind === "luggage") return HURT.luggageHalf * 2;
  if (kind === "kid") return HURT.kidHalf * 2;
  if (kind === "gate") return HURT.gateHalf * 2;
  if (kind === "sign") return HURT.overheadHalf * 2;
  return HURT.personHalf * 2;
}

export function spanOf(kind: string) {
  return HURT.playerHalf * 2 + obstacleWidth(kind);
}

export function passTime(span: number, speed: number, npc: number) {
  return span / Math.max(12, speed - npc);
}

function obstacleTop(kind: string) {
  if (kind === "gate") return HURT.gateTop;
  if (kind === "kid") return HURT.kidTop;
  return HURT.personTop;
}

/** 当前速度下，这个障碍能不能靠允许的跳跃过去。低牌靠蹲，不在这里卡掉。 */
export function canClear(kind: string, speed: number, allowDouble: boolean) {
  if (PICKUPS.has(kind) || kind === "sign") return true;
  const need = passTime(spanOf(kind), speed, npcSpeed(kind));
  const single = jumpClearance(obstacleTop(kind)) * 0.9;
  if (need <= single) return true;
  if (!allowDouble) return false;
  return need <= single + 0.28;
}

export function gapSeconds(progress: number, roll: number) {
  return 1.72 - progress * 0.78 + roll * 0.2;
}

/** 2 或 3 个学童并排走时，整组宽度仍落在二段跳的滞空里。 */
export function kidFileClear(count: number, speed: number) {
  const step = 11;
  const width = HURT.kidHalf * 2 + Math.max(0, count - 1) * step;
  const need = passTime(HURT.playerHalf * 2 + width, speed, npcSpeed("kid"));
  const single = jumpClearance(HURT.kidTop) * 0.9;
  return need <= single + 0.28;
}

/**
 * 上车只在离车门很近时触发，落地在门后 2 个单位。
 * 跳过的距离最多十几单位，而且这段不加分。
 */
export function boardingLanding(distance: number, doorX: number) {
  const gap = doorX - distance;
  if (gap <= 0 || gap > 16) return null;
  return doorX + 2;
}

/**
 * 固定步长积分。超长的一帧先截到 FRAME_CAP，再最多追 MAX_CATCHUP 步，剩下的丢掉。
 * 正常 1 倍速时，30/60/120Hz 走完同样的墙钟，距离应当几乎一样。
 */
export function integrate(dts: number[], timeScale = 1) {
  let acc = 0;
  let distance = PLAYER_VIEW_X;
  let sim = 0;
  let runTime = 0;
  const prep = PREP_SECONDS;
  let clock = 0;
  for (const raw of dts) {
    const dt = Math.min(FRAME_CAP, Math.max(0, raw));
    clock += dt;
    acc += dt * timeScale;
    let n = 0;
    const budget = timeScale === 1 ? MAX_CATCHUP : timeScale;
    while (acc >= STEP && n < budget) {
      if (clock > prep) {
        runTime += STEP;
        distance += speedAt(distance, runTime) * STEP;
      }
      sim += STEP;
      acc -= STEP;
      n++;
    }
    if (n >= budget) acc = 0;
  }
  return { distance, sim, runTime };
}
