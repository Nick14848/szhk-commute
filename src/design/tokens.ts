/** 口岸和车厢用浅墙、冷灰金属、东铁蓝。红和黄只表示警告、盲道和检票。 */
export const tokens = {
  bg: "#F7F7F7",
  ink: "#535353",
  inkDeep: "#101114",
  brandYellow: "#FFD900",
  brandWhite: "#FFFFFF",
  steelDark: "#082944",
  steelEdge: "#728B9C",
  textMuted: "#596875",
  navy: "#092C4C",
  far: "#DEDEDE",
  mid: "#9C9C9C",
  white: "#FFFFFF",
  line: "#53B7E8",
  alert: "#D7263D",
  yellow: "#F2C230",
  permit: "#3E8E5E",
  water: "#8CCBE6",
  glass: "#ECF2F5",
  floor: "#EDECE8",
  exit: "#0E7A32",
  poster: "#F6F1E6",
  page: "#F5F5F2",
} as const;

export const fontTC =
  '"PingFang HK", "PingFang TC", "Noto Sans TC", "Heiti TC", "Microsoft JhengHei", sans-serif';
export const fontSC =
  '"PingFang SC", "PingFang HK", "Noto Sans SC", "Microsoft YaHei", sans-serif';
export const fontLed = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function applyTokens(root: HTMLElement) {
  const s = root.style;
  s.setProperty("--bg", tokens.bg);
  s.setProperty("--page", tokens.page);
  s.setProperty("--ink", tokens.ink);
  s.setProperty("--ink-deep", tokens.inkDeep);
  s.setProperty("--line", tokens.line);
  s.setProperty("--alert", tokens.alert);
  s.setProperty("--exit", tokens.exit);
  s.setProperty("--poster", tokens.poster);
  s.setProperty("--yellow", tokens.brandYellow);
  s.setProperty("--white", tokens.brandWhite);
  s.setProperty("--steel", tokens.steelDark);
  s.setProperty("--steel-edge", tokens.steelEdge);
  s.setProperty("--muted", tokens.textMuted);
  s.setProperty("--navy", tokens.navy);
  s.setProperty("--font-tc", fontTC);
  s.setProperty("--font-sc", fontSC);
  s.setProperty("--font-led", fontLed);
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
