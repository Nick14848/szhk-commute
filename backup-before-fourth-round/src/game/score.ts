/** 计分只认有效前进和拾取。过场、暂停、镜头衔接不加分。 */

export const DISTANCE_POINT = 0.08;
export const WATER_POINT = 25;
export const OCTOPUS_POINT = 60;
export const HKD_RATE = 0.3;

export function multiplier(sitting: boolean, concession: boolean) {
  return (sitting ? 2 : 1) * (concession ? 2 : 1);
}

export function distancePoints(moved: number, m: number) {
  if (moved <= 0) return 0;
  return moved * DISTANCE_POINT * m;
}

export function pickupPoints(base: number, m: number) {
  return base * m;
}

export function finalScore(raw: number) {
  return Math.floor(Math.max(0, raw));
}

export function gameHkd(score: number) {
  return Math.round(score * HKD_RATE);
}
