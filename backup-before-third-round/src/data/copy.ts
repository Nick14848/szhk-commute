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
  best: (score: number, station: string) => `最高纪录 ${score} 分，到过${station}`,
  hintKeys: "空格或 ↑ 跳，空中再按一次二段跳。↓ 蹲下。",
  hintTouch: "点屏幕跳，空中再点一次二段跳。按住「蹲」低头。",
  soundOn: "声音：开",
  soundOff: "声音：关",
  jump: "跳",
  duck: "蹲",
  seatTitle: "神秘阿婆出现",
  seatHint: "狂点屏幕抢座位",
  seatHintKeys: "狂按空格抢座位",
  you: "你",
  grandma: "阿婆",
  sitWin: "抢到了，坐一路，分数翻倍",
  sitLose: "阿婆坐下了。罚站，这站不能二段跳",
  overheadHint: "低头！按住「蹲」",
  overheadHintKeys: "低头！按住 ↓",
  coachJump: "先跳一下",
  coachAir: "空中再按一次，就能跳更高",
  coachDuck: "上面来的，蹲过去",
  paused: "暂停了",
  resume: "继续通勤",
  restart: "重来",
  shareCancel: "没有发出去，图片还在下面",
  posterBusy: "正在画通关纸",
  chipSit: "坐一路 ×2",
  chipStand: "罚站",
  chipEdash: "e-道 无敌",
  chipConcession: "特惠 ×2",
  dayStart: (n: number) => `第 ${n} 天 · 福田口岸`,
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
  { min: 0, name: "深漂萌新", stamp: "萌新" },
  { min: 300, name: "通勤小白", stamp: "小白" },
  { min: 700, name: "大水", stamp: "大水" },
  { min: 1200, name: "薄肌", stamp: "薄肌" },
  { min: 2200, name: "深港双城卷王", stamp: "卷王" },
  { min: 4000, name: "八达通永动机", stamp: "永動" },
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
  mask: ["喂！行路睇路啊！", "撞到我個背囊啦！", "唔好掂我支酒精！"],
  phone: ["哎吔，我部手機！", "望住前面啦！", "打緊字，讓下得唔得？"],
  daigou: ["我個喼啊！", "借借！趕住過關！", "你踩到我部車啦！"],
  queue: ["唔好打尖啊！", "排緊隊，唔該。", "去後面排啦！"],
  inspector: ["入頭等要拍卡㗎！", "呢度頭等車廂。"],
  sams: ["我啲山姆貨啊！", "個袋好重㗎！"],
  lens: ["請望鏡頭。", "請除下口罩。"],
  gate: ["閘門未開。", "請再試一次。"],
};

export function deathLine(kind: string, rng: () => number) {
  const list = LINES[kind] ?? ["唔好衝啊！"];
  return list[Math.floor(rng() * list.length)]!;
}

export type SaveData = {
  bestScore: number;
  bestStation: string;
  bestDay: number;
};

const SAVE_KEY = "szhk-commute-v1";
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

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (typeof data.bestScore !== "number" || typeof data.bestStation !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式下写不进去，忽略 */
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
