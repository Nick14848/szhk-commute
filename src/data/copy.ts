/**
 * 玩家能读到的字都在这里。粤语对白、称号和汇率梗待尼克菜审稿。
 * 汇率是梗，不是报价。
 */

export const UI = {
  titleTrad: "深港通勤模擬器",
  titleEn: "Shenzhen–Hong Kong Commuter",
  by: "By 尼克菜Nick",
  lede: "香港赚钱深圳花，开启自己的深港通勤自律人生",
  start: "开始通勤",
  again: "再通勤一次",
  save: "保存通关纸",
  noRecord: "还没有通勤记录",
  best: (score: number, station: string) => `最高纪录 ${score} 分，最远抵达${station}`,
  hintKeys: "空格/↑ 跳 · 空中再按二段跳 · ↓ 蹲",
  hintTouch: "点屏幕跳 · 空中再点二段跳 · 按住「蹲」",
  soundOn: "声音：开",
  soundOff: "声音：关",
  jump: "跳",
  duck: "蹲",
  seatTitle: "神秘阿婆出现",
  seatHint: "狂点屏幕抢座位",
  seatHintKeys: "狂按空格抢座位",
  you: "你",
  grandma: "阿婆",
  sitWin: "获得 6 秒无敌",
  sitLose: "8 秒无法二段跳",
  overheadHint: "低头！按住「蹲」",
  overheadHintKeys: "低头！按住 ↓",
  coachJump: "先跳一下",
  coachAir: "空中再按一次，就能跳更高",
  coachDuck: "按住蹲下通过",
  paused: "暂停了",
  resume: "继续通勤",
  restart: "重新开始",
  shareCancel: "没有发出去，图片还在下面",
  posterBusy: "正在画通关纸",
  chipSit: "坐一路 ×2",
  chipStand: "罚站",
  chipPermit: "通行证",
  chipConcession: "特惠 ×2",
  dayStart: (_n: number) => `又回到福田口岸`,
  remaining: "餘額",
  remainingEn: "REMAINING VALUE",
  gateOut: "出閘",
  newRecord: "新纪录",
  certified: "薄肌认证",
  waters: "大水",
  day: (n: number) => `第 ${n} 天`,
  pressSave: "长按海报保存，发给同样在通勤的朋友。",
  posterFail: "海报没有生成，分数还在。",
  hitBy: "撞到了：",
};

/** 南行：落马洲支线经上水，到金钟为止。会展站 2022 年通车。 */
export const STATIONS = [
  { id: "lmc", trad: "落馬洲", simp: "落马洲", en: "Lok Ma Chau" },
  { id: "ss", trad: "上水", simp: "上水", en: "Sheung Shui" },
  { id: "fan", trad: "粉嶺", simp: "粉岭", en: "Fanling" },
  { id: "tw", trad: "太和", simp: "太和", en: "Tai Wo" },
  { id: "tpm", trad: "大埔墟", simp: "大埔墟", en: "Tai Po Market" },
  { id: "uni", trad: "大學", simp: "大学", en: "University" },
  { id: "fot", trad: "火炭", simp: "火炭", en: "Fo Tan" },
  { id: "sht", trad: "沙田", simp: "沙田", en: "Sha Tin" },
  { id: "taiw", trad: "大圍", simp: "大围", en: "Tai Wai" },
  { id: "kt", trad: "九龍塘", simp: "九龙塘", en: "Kowloon Tong" },
  { id: "mke", trad: "旺角東", simp: "旺角东", en: "Mong Kok East" },
  { id: "hh", trad: "紅磡", simp: "红磡", en: "Hung Hom" },
  { id: "exh", trad: "會展", simp: "会展", en: "Exhibition Centre" },
  { id: "adm", trad: "金鐘", simp: "金钟", en: "Admiralty" },
] as const;

export type Station = (typeof STATIONS)[number];

/** 不进玩家南行顺序。只在暂停页的完整线路里弱化显示。 */
export const BRANCHES = [
  { id: "lowu", trad: "羅湖", en: "Lo Wu", after: "上水" },
  { id: "rac", trad: "馬場", en: "Racecourse", after: "大學" },
] as const;

export const BORDER = [
  { id: "hall", trad: "福田口岸", simp: "福田口岸", en: "Futian Port" },
  { id: "gates", trad: "自助通道", simp: "自助通道", en: "e-Channel" },
  { id: "bridge", trad: "深港天橋", simp: "深港天桥", en: "Footbridge" },
  { id: "platform", trad: "落馬洲站台", simp: "落马洲站台", en: "Lok Ma Chau Platform" },
] as const;

export type Place = { id: string; trad: string; simp: string; en: string };

export const SIGNS = {
  departure: "出境",
  departureEn: "DEPARTURE",
  echannel: "e-道",
  echannelEn: "e-CHANNEL",
  residents: "香港居民",
  visitors: "訪客",
  sz: "深圳",
  hk: "香港",
  travelator: "← 80.5m →",
  gap: "請小心月台空隙",
  gapEn: "PLEASE MIND THE GAP",
  toAdmiralty: "往 金鐘",
  toAdmiraltyEn: "To Admiralty",
  first: "頭等",
  firstEn: "FIRST CLASS",
  avm: "八達通增值",
  avmNote: "只收 $50 $100",
  hours: "06:30–22:30",
};

export function arrival(st: Station, next: Station | undefined): [string, string] {
  if (!next) return [`${st.trad} 終點站`, `${st.en} · Terminus`];
  return [`${st.trad}  下一站 ${next.trad}`, `${st.en} · Next station ${next.en}`];
}

export const TITLES = [
  { min: 0, name: "通勤小白", stamp: "小白" },
  { min: 300, name: "渐入佳境", stamp: "佳境" },
  { min: 700, name: "深港双城卷王", stamp: "卷王" },
  { min: 1200, name: "大水教父", stamp: "大水" },
  { min: 2200, name: "薄肌教父", stamp: "薄肌" },
  { min: 4000, name: "版本答案", stamp: "答案" },
] as const;

export function titleFor(score: number) {
  let current: (typeof TITLES)[number] = TITLES[0];
  for (const t of TITLES) if (score >= t.min) current = t;
  return current;
}

export function certified(score: number) {
  return score >= 1200;
}

/** 梗换算：1 分 = HK$0.3，海底捞一顿 HK$200，山姆一趟 HK$400。 */
export function moneyFor(score: number) {
  const hkd = Math.round(score * 0.3);
  return { hkd, haidilao: Math.floor(hkd / 200), sams: Math.floor(hkd / 400) };
}

export function punchline(score: number) {
  const { hkd, haidilao, sams } = moneyFor(score);
  if (haidilao <= 0) return `赚了 HK$${hkd}，还不够一顿海底捞。`;
  if (sams <= 0) return `赚了 HK$${hkd}，回深圳够吃 ${haidilao}\u00A0顿海底捞。`;
  return `赚了 HK$${hkd}，回深圳够吃 ${haidilao}\u00A0顿海底捞，或者逛 ${sams}\u00A0趟山姆。`;
}

const LINES: Record<string, string[]> = {
  walker: ["喂！行路睇路啊！", "撞到我個背囊啦！"],
  office: ["哎吔，我個袋！", "望住前面啦！"],
  luggage: ["我個喼啊！", "你踩到我部車啦！"],
  kid: ["小心啲啦！"],
  elder: ["慢啲得唔得？"],
  queue: ["唔好打尖啊！", "排緊隊，唔該。"],
  inspector: ["入頭等要拍卡㗎！", "呢度頭等車廂。"],
  sign: ["低頭呀！"],
  gate: ["閘門未開。", "請再試一次。"],
  staff: ["唔好撞職員啊！", "讓一讓，多謝。"],
};

export function deathLine(kind: string, rng: () => number) {
  const list = LINES[kind] ?? ["唔好衝啊！"];
  return list[Math.floor(rng() * list.length)]!;
}

export type SaveData = {
  v?: number;
  bestScore: number;
  bestStation: string;
  bestDay: number;
  bestProgress?: number;
};

export function normalizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const bestScore = data.bestScore;
  const bestStation = data.bestStation;
  if (typeof bestScore !== "number" || !Number.isFinite(bestScore) || bestScore < 0) return null;
  if (typeof bestStation !== "string" || bestStation.length === 0) return null;
  const bestDay = typeof data.bestDay === "number" && Number.isInteger(data.bestDay) && data.bestDay >= 1 ? data.bestDay : 1;
  const progress = data.bestProgress;
  const bestProgress = typeof progress === "number" && Number.isFinite(progress) && progress >= 0 ? progress : undefined;
  return { v: bestProgress === undefined ? 1 : 2, bestScore, bestStation, bestDay, bestProgress };
}

/** 最高分和最远进度分开取最大。地点跟最远进度走，不跟最高分那一局走。 */
export function mergeRecord(prev: SaveData | null, score: number, progress: number, place: string, day: number): SaveData {
  const safeScore = Number.isFinite(score) && score > 0 ? score : 0;
  const safeProgress = Number.isFinite(progress) && progress > 0 ? progress : 0;
  const bestScore = Math.max(safeScore, prev?.bestScore ?? 0);
  const prevProgress = prev?.bestProgress ?? 0;
  const bestProgress = Math.max(safeProgress, prevProgress);
  const farther = safeProgress >= prevProgress;
  return {
    v: 2,
    bestScore,
    bestProgress,
    bestStation: farther ? place : (prev?.bestStation || place),
    bestDay: farther ? Math.max(1, day) : (prev?.bestDay || day),
  };
}

const ATTEMPT_KEY = "szhk-commute-attempt";

export function bumpAttempt() {
  try {
    const next = (Number(localStorage.getItem(ATTEMPT_KEY)) || 0) + 1;
    localStorage.setItem(ATTEMPT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

const MUTE_KEY = "szhk-commute-muted";
const COACH_KEY = "szhk-commute-coach";

export type Coach = { jump: boolean; double: boolean; duck: boolean };

export function loadCoach(): Coach {
  try {
    const raw = localStorage.getItem(COACH_KEY);
    if (!raw) return { jump: false, double: false, duck: false };
    const data = JSON.parse(raw) as Coach;
    return {
      jump: Boolean(data.jump),
      double: Boolean(data.double),
      duck: Boolean(data.duck),
    };
  } catch {
    return { jump: false, double: false, duck: false };
  }
}

export function saveCoach(data: Coach) {
  try {
    localStorage.setItem(COACH_KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式 */
  }
}

let memorySave: SaveData | null = null;

export const SAVE_KEY = "szhk-commute-v1";

function progressOf(data: SaveData): number | null {
  return typeof data.bestProgress === "number" && Number.isFinite(data.bestProgress) ? data.bestProgress : null;
}

/** 未知进度保持未知。不能把缺省进度当成 0，否则旧站会被短跑覆盖。 */
function combineSaves(a: SaveData, b: SaveData): SaveData {
  const ap = progressOf(a);
  const bp = progressOf(b);
  if (ap !== null && bp !== null) return mergeRecord(a, b.bestScore, bp, b.bestStation, b.bestDay);
  if (ap === null && bp === null) {
    const aWins = a.bestScore >= b.bestScore;
    return {
      v: 1,
      bestScore: Math.max(a.bestScore, b.bestScore),
      bestStation: aWins ? a.bestStation : b.bestStation,
      bestDay: aWins ? a.bestDay : b.bestDay,
    };
  }
  const known = ap !== null ? a : b;
  const other = ap !== null ? b : a;
  return {
    v: 2,
    bestScore: Math.max(known.bestScore, other.bestScore),
    bestProgress: known.bestProgress,
    bestStation: known.bestStation,
    bestDay: known.bestDay,
  };
}

function keepMemory(data: SaveData | null) {
  if (!data) return memorySave;
  memorySave = memorySave ? combineSaves(memorySave, data) : data;
  return memorySave;
}

export function clearSessionRecord() {
  memorySave = null;
}

export function commitRun(
  score: number,
  progress: number,
  place: string,
  day: number,
  legacyOf: (station: string, day: number) => number,
): SaveData {
  const prev = loadSave();
  const known = prev?.bestProgress ?? (prev ? legacyOf(prev.bestStation, prev.bestDay || 1) : 0);
  const withProgress = prev ? { ...prev, bestProgress: known } : null;
  const saved = mergeRecord(withProgress, score, progress, place, day);
  writeSave(saved);
  return saved;
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return memorySave;
    return keepMemory(normalizeSave(JSON.parse(raw)));
  } catch {
    return memorySave;
  }
}

export function writeSave(data: SaveData) {
  const next = keepMemory(data) ?? data;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式只留在这一页的内存纪录里 */
  }
}

export function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}
