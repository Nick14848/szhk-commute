/** 计分只认有效前进和拾取。过场、暂停、镜头衔接不加分。 */

export const DISTANCE_POINT = 0.08;
export const WATER_POINT = 25;
export const OCTOPUS_POINT = 60;
/** 抢座不再把得分乘二。只有特惠这 8 秒会把当步得分乘二。 */
export function multiplier(concession: boolean) {
  return concession ? 2 : 1;
}

/** 水瓶计数每次 +1，不跟得分倍率走。 */
export function bottlesGained() {
  return 1;
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

