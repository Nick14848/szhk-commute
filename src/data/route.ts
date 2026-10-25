/** Versioned geometry, independent of copy/stage imports. */
export const ROUTE_VERSION = 3;
export const BORDER_LENGTHS = { hall: 1500, gates: 1400, bridge: 3600, platform: 1100 } as const;
export const RAIL_LENGTH = 1300;
export const RAIL_COUNT = 14;
export const PORT_LENGTH = Object.values(BORDER_LENGTHS).reduce((a, b) => a + b, 0);
export const ROUTE_LENGTH = PORT_LENGTH + RAIL_COUNT * RAIL_LENGTH;

/** v2 position -> same day, place and fraction along the new route. */
export function migrateProgress(progress: number) {
  const oldLengths = [1200, 1000, 1560, 820, RAIL_COUNT * RAIL_LENGTH];
  const newLengths = [...Object.values(BORDER_LENGTHS), RAIL_COUNT * RAIL_LENGTH];
  const day = Math.floor(progress / 22780);
  const local = progress % 22780;
  let oldStart = 0;
  let newStart = 0;
  for (let i = 0; i < oldLengths.length; i++) {
    const len = oldLengths[i]!;
    if (local < oldStart + len) return day * ROUTE_LENGTH + newStart + (local - oldStart) / len * newLengths[i]!;
    oldStart += len;
    newStart += newLengths[i]!;
  }
  return day * ROUTE_LENGTH;
}
