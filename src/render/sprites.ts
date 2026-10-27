import { tokens } from "../design/tokens";

/**
 * 可爱侧面像素人。头大、身子短、腿稍短。
 * 画布 40×44，脚底锚点 (16, 40)。不裁空白。
 * 主角跑步 8 帧；路人用自己的走步，不套主角的大步。
 */

export const FRAME_W = 40;
export const FRAME_H = 44;
export const ANCHOR_X = 16;
export const ANCHOR_Y = 40;

export const PAL = {
  skin: "#F0C3A0",
  skinD: "#D9A784",
  hair: "#2A241C",
  hairG: "#B7B1A8",
  jacket: "#3E8FD4",
  jacketD: "#2A6FA8",
  pants: "#2C3444",
  pantsD: "#1E2430",
  shoe: "#F7F7F7",
  shoeD: "#D5D5D5",
  out: "#243044",
};

export type Sprite = {
  w: number;
  h: number;
  ax: number;
  ay: number;
  img: HTMLCanvasElement;
};

export type PoseName = "idle" | "run" | "walk" | "jump" | "land" | "duck" | "sit" | "dead";

type Pt = [number, number];
type Rig = {
  hip: Pt;
  head: Pt;
  shoulder: Pt;
  elbowF: Pt;
  handF: Pt;
  elbowB: Pt;
  handB: Pt;
  kneeF: Pt;
  footF: Pt;
  kneeB: Pt;
  footB: Pt;
};

type Look = {
  cloth: string;
  clothD: string;
  pants: string;
  pantsD: string;
  hair: string;
  pack: string | null;
  packD: string;
  mask: boolean;
  case: "none" | "brief" | "suitcase" | "cane";
  hat: boolean;
  badge: boolean;
  small: boolean;
  glasses?: boolean;
  cap?: boolean;
};

const adult: Look = {
  cloth: PAL.jacket,
  clothD: PAL.jacketD,
  pants: PAL.pants,
  pantsD: PAL.pantsD,
  hair: PAL.hair,
  pack: PAL.jacket,
  packD: PAL.jacketD,
  mask: false,
  case: "none",
  hat: false,
  badge: false,
  small: false,
};

function look(partial: Partial<Look>): Look {
  return { ...adult, pack: null, ...partial };
}

/** 膝盖不低于髋，手不甩到头后面。左右腿交替。 */
const RUN: Rig[] = [
  rig(30, [24, 39], [22, 35], [9, 39], [11, 35], [13, 30], [26, 27]),
  rig(31, [20, 39], [19, 36], [10, 35], [11, 31], [14, 30], [25, 28]),
  rig(30, [16, 39], [17, 35], [15, 33], [12, 30], [18, 30], [21, 29]),
  rig(29, [11, 39], [13, 34], [21, 35], [18, 31], [23, 28], [16, 30]),
  rig(30, [9, 39], [11, 35], [24, 39], [22, 35], [26, 27], [13, 30]),
  rig(31, [10, 35], [11, 31], [20, 39], [19, 36], [25, 28], [14, 30]),
  rig(30, [15, 33], [12, 30], [16, 39], [17, 35], [21, 29], [18, 30]),
  rig(29, [21, 35], [18, 31], [11, 39], [13, 34], [16, 30], [23, 28]),
];

const WALK: Rig[] = [
  rig(30, [21, 39], [19, 35], [12, 39], [13, 35], [14, 30], [23, 29]),
  rig(31, [18, 39], [17, 36], [13, 35], [14, 32], [15, 30], [22, 30]),
  rig(30, [19, 39], [18, 35], [16, 34], [16, 31], [13, 30], [24, 31]),
  rig(30, [12, 39], [13, 35], [21, 39], [19, 35], [23, 29], [14, 30]),
  rig(31, [13, 35], [14, 32], [18, 39], [17, 36], [22, 30], [15, 30]),
  rig(30, [16, 34], [16, 31], [19, 39], [18, 35], [24, 31], [13, 30]),
];

const IDLE: Rig[] = [
  rig(30, [19, 39], [18, 35], [13, 39], [14, 35], [20, 30], [12, 30]),
  rig(30, [19, 39], [18, 35], [13, 39], [14, 35], [21, 29], [11, 30]),
];

const JUMP: Rig[] = [
  rig(29, [22, 36], [20, 32], [12, 36], [14, 32], [10, 22], [26, 22]),
  rig(28, [20, 33], [18, 30], [14, 33], [15, 30], [9, 20], [27, 20]),
  rig(30, [18, 39], [17, 34], [22, 34], [21, 31], [12, 24], [25, 24]),
];

const LAND = rig(31, [20, 39], [19, 35], [12, 39], [13, 35], [18, 30], [14, 31]);

const DUCK: Rig[] = [
  rig(34, [24, 39], [22, 36], [12, 39], [14, 36], [26, 33], [10, 33], 24),
  rig(34, [25, 39], [23, 36], [11, 39], [13, 36], [27, 34], [11, 34], 25),
];

const SIT: Rig[] = [
  rig(28, [24, 39], [22, 32], [10, 39], [12, 33], [22, 26], [10, 26]),
  rig(28, [24, 39], [22, 32], [10, 39], [12, 33], [23, 25], [10, 26]),
];

const DEAD: Rig[] = [
  rig(32, [22, 39], [20, 35], [12, 39], [13, 36], [24, 28], [8, 30], 18),
  rig(33, [20, 39], [18, 36], [11, 39], [12, 36], [26, 30], [6, 32], 16),
];

function rig(
  hipY: number,
  footF: Pt,
  kneeF: Pt,
  footB: Pt,
  kneeB: Pt,
  handF: Pt,
  handB: Pt,
  headY = 13,
): Rig {
  return {
    hip: [16, hipY],
    head: [22, headY],
    shoulder: [18, hipY - 8],
    elbowF: [handF[0], handF[1] - 3],
    handF,
    elbowB: [handB[0], handB[1] - 3],
    handB,
    kneeF,
    footF,
    kneeB,
    footB,
  };
}

function drop(rigs: Rig[], dy: number): Rig[] {
  const s = (p: Pt): Pt => [p[0], Math.min(39, p[1] + dy)];
  return rigs.map((r) => ({
    hip: s(r.hip),
    head: [r.head[0], r.head[1] + dy],
    shoulder: s(r.shoulder),
    elbowF: s(r.elbowF),
    handF: s(r.handF),
    elbowB: s(r.elbowB),
    handB: s(r.handB),
    kneeF: s(r.kneeF),
    footF: [r.footF[0], r.footF[1] >= 38 ? 39 : Math.min(39, r.footF[1] + dy)],
    kneeB: s(r.kneeB),
    footB: [r.footB[0], r.footB[1] >= 38 ? 39 : Math.min(39, r.footB[1] + dy)],
  }));
}

function canvas(): CanvasRenderingContext2D {
  const img = document.createElement("canvas");
  img.width = FRAME_W;
  img.height = FRAME_H;
  const ctx = img.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r: number) {
  ctx.fillStyle = color;
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy <= r * r) ctx.fillRect(cx + xx, cy + yy, 1, 1);
    }
  }
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, thick: number) {
  ctx.fillStyle = color;
  const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const r = Math.max(0, thick - 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(a[0] + (b[0] - a[0]) * t);
    const y = Math.round(a[1] + (b[1] - a[1]) * t);
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r) ctx.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }
}

function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, thick: number) {
  line(ctx, a, b, PAL.out, thick + 1);
  line(ctx, a, b, color, thick);
}

function shoe(ctx: CanvasRenderingContext2D, foot: Pt, color: string) {
  const x = Math.round(foot[0]);
  const y = Math.round(foot[1]) - 2;
  ctx.fillStyle = PAL.out;
  ctx.fillRect(x - 1, y, 6, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 4, 2);
}

function paint(r: Rig, look: Look): Sprite {
  const ctx = canvas();
  const img = ctx.canvas;
  const headR = look.small ? 5 : 6;
  limb(ctx, r.hip, r.kneeB, look.pantsD, 2);
  limb(ctx, r.kneeB, r.footB, look.pantsD, 2);
  shoe(ctx, r.footB, PAL.shoeD);
  limb(ctx, r.shoulder, r.elbowB, look.clothD, 2);
  limb(ctx, r.elbowB, r.handB, PAL.skinD, 1);

  if (look.case === "suitcase") {
    const x = r.hip[0] - 12;
    const boxTop = 32;
    const gripY = boxTop - 6;
    ctx.fillStyle = PAL.out;
    ctx.fillRect(x, boxTop, 8, 7);
    ctx.fillStyle = "#C4554A";
    ctx.fillRect(x + 1, boxTop + 1, 6, 4);
    ctx.fillRect(x + 1, 38, 2, 2);
    ctx.fillRect(x + 5, 38, 2, 2);
    ctx.fillRect(x + 3, gripY, 1, boxTop - gripY);
    ctx.fillRect(x + 2, gripY, 3, 1);
  }
  if (look.pack) {
    const x = r.shoulder[0] - 9;
    const y = r.shoulder[1] - 1;
    ctx.fillStyle = PAL.out;
    ctx.fillRect(x - 1, y - 1, 8, 11);
    ctx.fillStyle = look.packD;
    ctx.fillRect(x, y, 6, 9);
    ctx.fillStyle = look.pack;
    ctx.fillRect(x + 1, y + 1, 4, 6);
  }

  limb(ctx, r.hip, r.shoulder, look.cloth, 3);
  ctx.fillStyle = look.cloth;
  ctx.fillRect(r.shoulder[0] - 4, r.shoulder[1] - 1, 8, 6);
  ctx.fillStyle = PAL.out;
  ctx.fillRect(r.shoulder[0] - 4, r.shoulder[1] - 2, 8, 1);
  if (look.badge) {
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(r.shoulder[0] + 1, r.shoulder[1] + 1, 3, 3);
  }

  limb(ctx, r.hip, r.kneeF, look.pants, 2);
  limb(ctx, r.kneeF, r.footF, look.pants, 2);
  shoe(ctx, r.footF, PAL.shoe);
  const handle: Pt | null = look.case === "suitcase" ? [r.hip[0] - 9, 26] : null;
  const handF = handle ?? r.handF;
  const elbowF: Pt = handle ? [r.hip[0] - 2, 27] : r.elbowF;
  limb(ctx, r.shoulder, elbowF, look.cloth, 2);
  limb(ctx, elbowF, handF, PAL.skin, 1);
  blob(ctx, handF[0], handF[1], PAL.skin, 1);
  blob(ctx, r.handB[0], r.handB[1], PAL.skinD, 1);

  if (look.case === "brief") {
    ctx.fillStyle = PAL.out;
    ctx.fillRect(handF[0] - 1, handF[1] - 1, 7, 6);
    ctx.fillStyle = "#C4A46A";
    ctx.fillRect(handF[0], handF[1], 5, 4);
    ctx.fillRect(handF[0] + 1, handF[1] - 2, 3, 1);
  }
  if (look.case === "cane") {
    line(ctx, handF, [handF[0] + 1, 39], "#8A7355", 1);
  }

  const hx = r.head[0];
  const hy = r.head[1];
  line(ctx, [hx, hy + headR - 1], r.shoulder, PAL.skinD, 1);
  blob(ctx, hx, hy, PAL.out, headR);
  blob(ctx, hx, hy, PAL.skin, headR - 1);
  ctx.fillStyle = look.hair;
  if (look.glasses) {
    // 阶梯状发梢，保留额头与耳侧的肤色，不再像一整块方帽。
    ctx.fillRect(hx - 3, hy - 6, 7, 1);
    ctx.fillRect(hx - 5, hy - 5, 10, 2);
    ctx.fillRect(hx - 5, hy - 3, 2, 3);
    ctx.fillRect(hx - 3, hy - 3, 4, 1);
    ctx.fillRect(hx + 2, hy - 3, 2, 1);
  } else {
    ctx.fillRect(hx - headR + 1, hy - headR, headR * 2 - 1, 3);
    ctx.fillRect(hx - headR, hy - headR + 2, 3, 4);
  }
  if (look.glasses) {
    // 镜片只留在脸的正面，不画伸到耳边的深色镜腿/方块。
    // 细灰框和两点瞳孔在小尺寸下仍能读作眼镜，而不是耳机。
    ctx.fillStyle = "#52606C";
    ctx.fillRect(hx - 1, hy - 2, 3, 4);
    ctx.fillRect(hx + 3, hy - 2, 3, 4);
    ctx.fillRect(hx + 2, hy - 1, 1, 1);
    ctx.fillStyle = "#F8E6D0";
    ctx.fillRect(hx, hy - 1, 1, 2);
    ctx.fillRect(hx + 4, hy - 1, 1, 2);
    ctx.fillStyle = PAL.out;
    ctx.fillRect(hx, hy, 1, 1);
    ctx.fillRect(hx + 4, hy, 1, 1);
    ctx.fillStyle = PAL.skinD;
    ctx.fillRect(hx + 2, hy + 3, 2, 1);
    ctx.fillStyle = "#B97F68";
    ctx.fillRect(hx + 3, hy + 4, 1, 1);
  } else {
    ctx.fillStyle = PAL.out;
    ctx.fillRect(hx + 2, hy - 1, 2, 2);
  }
  if (look.mask) {
    ctx.fillStyle = "#E7EEF2";
    ctx.fillRect(hx, hy + 1, 5, 3);
  }
  if (look.hat) {
    ctx.fillStyle = PAL.out;
    ctx.fillRect(hx - headR - 1, hy - headR - 1, headR * 2 + 2, 3);
    ctx.fillRect(hx - 3, hy - headR - 4, 7, 4);
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(hx - 2, hy - headR - 3, 5, 2);
  }
  if (look.cap) {
    // 日常棒球帽：奶油色弧形帽冠、只向前伸的藏蓝帽檐，没有制服帽徽。
    ctx.fillStyle = "#68716F";
    ctx.fillRect(hx - 3, hy - 8, 6, 1);
    ctx.fillRect(hx - 5, hy - 7, 10, 2);
    ctx.fillRect(hx - 6, hy - 5, 12, 2);
    ctx.fillStyle = "#D4C8AE";
    ctx.fillRect(hx - 3, hy - 7, 6, 1);
    ctx.fillRect(hx - 4, hy - 6, 8, 2);
    ctx.fillRect(hx - 5, hy - 4, 10, 1);
    ctx.fillStyle = "#EFE3C9";
    ctx.fillRect(hx - 2, hy - 7, 4, 1);
    ctx.fillRect(hx - 3, hy - 6, 2, 1);
    ctx.fillStyle = "#30495D";
    ctx.fillRect(hx, hy - 4, 10, 1);
    ctx.fillRect(hx + 4, hy - 3, 5, 1);
    ctx.fillStyle = "#506D80";
    ctx.fillRect(hx + 1, hy - 4, 7, 1);
  }
  return { w: FRAME_W, h: FRAME_H, ax: ANCHOR_X, ay: ANCHOR_Y, img };
}

function set(rigs: Rig[], look: Look) {
  return rigs.map((r) => paint(r, look));
}

export const PLAYER_PACK = "#4A515A";
export const PLAYER_PACK_D = "#2C3138";
const playerLook: Look = { ...adult, pack: PLAYER_PACK, packD: PLAYER_PACK_D, glasses: true, cap: true };
const walkerLook = look({
  cloth: "#E07A3D",
  clothD: "#B85E28",
  pack: "#6B4A32",
  packD: "#4A3222",
  pants: "#3E4A38",
  pantsD: "#2A3326",
});
const officeLook = look({
  cloth: "#6E5A78",
  clothD: "#52445C",
  pants: "#2E2A33",
  pantsD: "#1C1A20",
  case: "brief",
});
const luggageLook = look({
  cloth: "#2F8F86",
  clothD: "#1E645E",
  pants: "#3A332C",
  pantsD: "#241E1A",
  case: "suitcase",
});
const kidLook = look({
  cloth: "#2C3E6B",
  clothD: "#1C2948",
  pack: "#F2C230",
  packD: "#C49216",
  pants: "#243044",
  pantsD: "#161C28",
  small: true,
});
const elderLook = look({
  cloth: "#8A6A62",
  clothD: "#6A4E48",
  hair: PAL.hairG,
  pants: "#4A403C",
  pantsD: "#2E2926",
  case: "cane",
});
const inspectorLook = look({
  cloth: "#243044",
  clothD: "#161C28",
  hat: true,
  badge: true,
  pants: "#1A1E28",
  pantsD: "#10131A",
});
const staffLook = look({
  cloth: "#F2C230",
  clothD: "#C49216",
  pants: "#1C1E24",
  pantsD: "#101218",
  mask: true,
  hair: "#3A2A22",
});

const kidWalk = drop(WALK, 6);
const kidIdle = drop(IDLE, 6);
const elderWalk = drop(WALK, 2);

const playerRun = set(RUN, playerLook);
const playerIdle = set(IDLE, playerLook);
const playerJump = set(JUMP, playerLook);
const playerLand = paint(LAND, playerLook);
const playerDuck = set(DUCK, playerLook);
const playerSit = set(SIT, playerLook);
const bareLook: Look = { ...playerLook, pack: null };
const playerSitBare = set(SIT, bareLook);
const playerIdleBare = set(IDLE, bareLook);
const playerDead = set(DEAD, playerLook);
const playerWalk = set(WALK, playerLook);

const walkerWalk = set(WALK, walkerLook);
const walkerIdle = set(IDLE, walkerLook);
const officeWalk = set(WALK, officeLook);
const officeIdle = set(IDLE, officeLook);
const luggageWalk = set(WALK, luggageLook);
const luggageIdle = set(IDLE, luggageLook);
const kidFrames = set(kidWalk, kidLook);
const kidIdleFrames = set(kidIdle, kidLook);
const elderFrames = set(elderWalk, elderLook);
const elderIdle = set(drop(IDLE, 2), elderLook);
const inspectorWalk = set(WALK, inspectorLook);
const inspectorIdle = set(IDLE, inspectorLook);
const staffWalk = set(WALK, staffLook);
const staffIdle = set(IDLE, staffLook);

function item(rows: string[]): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((row) => row.length));
  const img = document.createElement("canvas");
  img.width = w;
  img.height = h;
  const ctx = img.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const pal: Record<string, string> = {
    k: PAL.out,
    w: "#F7F7F7",
    b: tokens.line,
    g: tokens.permit,
    c: tokens.water,
    y: tokens.yellow,
    r: tokens.alert,
    m: tokens.mid,
    o: "#E38B2C",
    n: "#2E9B62",
    u: "#1F6FBF",
    a: "#6E7378",
  };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]!];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return { w, h, ax: Math.floor(w / 2), ay: h - 1, img };
}

export const SPR = {
  playerA: playerRun[0]!,
  playerJump: playerJump[0]!,
  playerDead: playerDead[0]!,
  playerSit: playerSit[0]!,
  duckA: playerDuck[0]!,
  water: item([
    "...kkkk...",
    "....kk....",
    "..kkkkkk..",
    ".kcccccck.",
    ".kcccccck.",
    ".kwwwwwwk.",
    ".kcccccck.",
    ".kcccccck.",
    ".kcccccck.",
    ".kcccccck.",
    ".kcccccck.",
    "..kkkkkk..",
  ]),
  octopus: item([
    "kkkkkkkkkkkkkkkk",
    "kaaaaaaaaaaaaaak",
    "kaaaooooooooaaak",
    "kaooaaaaaanaaaak",
    "koaaaaaaaaannnnk",
    "koaaaaaaauuuuuuk",
    "kaaaaaauuuuaaaak",
    "kaaaauuuaaaaaaak",
    "kaaaaaaaaaaaaaak",
    "kkkkkkkkkkkkkkkk",
  ]),
  permit: item([
    "gggggggggg",
    "gwwwgggggg",
    "gwwwgwwwwg",
    "gwwwgggggg",
    "gggggwwwwg",
    "gwwwwwwwwg",
    "gggggggggg",
  ]),
  concession: item([
    "..kkkkkkkkkk..",
    "..krrrrrrrrk..",
    "..kwwwwwwwwk..",
    "..kwkkkkkkkwk.",
    "..kwwwwwwwwk..",
    "..kkkkkkkkkk..",
    "......kk......",
    "......kk......",
    "......kk......",
    "......kk......",
    "......kk......",
    ".....kkkk.....",
  ]),
  gate: item([
    "kk......kk......kk",
    "kr......kr......kr",
    "kk......kk......kk",
    "kk......kk......kk",
    "kkmmmmmmmmmmmmmmkk",
    "kkmmmmmmmmmmmmmmkk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
  ]),
};

const WALK_SETS: Record<string, Sprite[]> = {
  player: playerWalk,
  walker: walkerWalk,
  office: officeWalk,
  luggage: luggageWalk,
  kid: kidFrames,
  elder: elderFrames,
  inspector: inspectorWalk,
  staff: staffWalk,
};
const IDLE_SETS: Record<string, Sprite[]> = {
  player: playerIdle,
  walker: walkerIdle,
  office: officeIdle,
  luggage: luggageIdle,
  kid: kidIdleFrames,
  elder: elderIdle,
  inspector: inspectorIdle,
  staff: staffIdle,
};

// Cached alternate outfits: selected once from entity phase, never per frame.
const ALTERNATE_LOOKS: Record<string, Look> = {
  walker: { ...walkerLook, cloth: "#A26B78", clothD: "#79505D", pack: "#536C51", packD: "#3C503D" },
  office: { ...officeLook, cloth: "#CFD4BF", clothD: "#A4AF9A", hair: "#51453B" },
  luggage: { ...luggageLook, cloth: "#BB9262", clothD: "#977344" },
  kid: { ...kidLook, cloth: "#E6E7DC", clothD: "#BDC9CC" },
};
const ALT_WALK = Object.fromEntries(Object.entries(ALTERNATE_LOOKS).map(([k, l]) => [k, set(k === "kid" ? kidWalk : WALK, l)]));
const ALT_IDLE = Object.fromEntries(Object.entries(ALTERNATE_LOOKS).map(([k, l]) => [k, set(k === "kid" ? kidIdle : IDLE, l)]));

const walkerSit = set(SIT, walkerLook);
const officeSit = set(SIT, officeLook);

export function actorFrame(kind: string, frame: number, mode: "walk" | "idle" | "run" | "sit" = "walk", variant = 0): Sprite {
  if (mode === "sit") {
    const frames = kind === "office" ? officeSit : walkerSit;
    return frames[((frame % frames.length) + frames.length) % frames.length]!;
  }
  if (kind === "player" && mode === "run") {
    const i = ((frame % playerRun.length) + playerRun.length) % playerRun.length;
    return playerRun[i]!;
  }
  const bank = mode === "idle" ? IDLE_SETS : WALK_SETS;
  const alternate = mode === "idle" ? ALT_IDLE : ALT_WALK;
  const frames = variant % 2 === 1 && alternate[kind] ? alternate[kind]! : bank[kind] ?? walkerWalk;
  const i = ((frame % frames.length) + frames.length) % frames.length;
  return frames[i]!;
}

export function playerSprite(pose: PoseName, frame: number, vy = 0, pack = true): Sprite {
  if (!pack && pose === "sit") return playerSitBare[frame % playerSitBare.length]!;
  if (!pack && pose === "idle") return playerIdleBare[((frame % 2) + 2) % 2]!;
  if (pose === "jump") {
    const phase = vy > 80 ? 0 : vy > -40 ? 1 : 2;
    return playerJump[phase]!;
  }
  if (pose === "duck") return playerDuck[((frame % 2) + 2) % 2]!;
  if (pose === "sit") return playerSit[frame % 2]!;
  if (pose === "dead") return playerDead[Math.min(1, Math.abs(frame) % 2)]!;
  if (pose === "land") return playerLand;
  if (pose === "idle") return playerIdle[((frame % 2) + 2) % 2]!;
  if (pose === "walk") return actorFrame("player", frame, "walk");
  return actorFrame("player", frame, "run");
}

export function atlasGroups(): { name: string; frames: Sprite[] }[] {
  return [
    { name: "player run", frames: playerRun },
    { name: "player idle", frames: playerIdle },
    { name: "player jump", frames: playerJump },
    { name: "player duck", frames: playerDuck },
    { name: "player sit", frames: playerSit },
    { name: "walker", frames: walkerWalk },
    { name: "office", frames: officeWalk },
    { name: "luggage", frames: luggageWalk },
    { name: "kid", frames: kidFrames },
    { name: "elder", frames: elderFrames },
    { name: "inspector", frames: inspectorWalk },
    { name: "staff", frames: staffWalk },
    { name: "elder idle", frames: elderIdle },
    { name: "queue idle", frames: [walkerIdle[0]!, officeIdle[0]!, kidIdleFrames[0]!] },
  ];
}

export let atlasPaused = false;
export let atlasStep = 0;

export function atlasToggle() {
  atlasPaused = !atlasPaused;
}

export function atlasNudge(dir: number) {
  atlasPaused = true;
  atlasStep += dir;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  flip = false,
) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (!flip) {
    ctx.drawImage(s.img, rx, ry);
    return;
  }
  ctx.save();
  ctx.translate(rx + s.w, ry);
  ctx.scale(-1, 1);
  ctx.drawImage(s.img, 0, 0);
  ctx.restore();
}

export function drawAnchored(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  footX: number,
  baselineY: number,
  flip = false,
) {
  const y = Math.round(baselineY - s.ay);
  if (!flip) {
    ctx.drawImage(s.img, Math.round(footX - s.ax), y);
    return;
  }
  ctx.save();
  ctx.translate(Math.round(footX), y);
  ctx.scale(-1, 1);
  ctx.drawImage(s.img, -s.ax, 0);
  ctx.restore();
}

export let atlasPage = 0;

const STRIDE_LABEL: Record<string, number> = {
  "player run": 8,
  "player idle": 8,
  "player jump": 8,
  "player duck": 8,
  "player sit": 8,
  walker: 6,
  office: 6,
  luggage: 5,
  kid: 5,
  elder: 4,
  inspector: 6,
  staff: 6,
};

export function paintAtlas(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, now: number) {
  if (!atlasPaused) atlasStep = Math.floor(now / 140);
  ctx.fillStyle = "#E7E2D8";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.font = "12px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#243044";
  const per = Math.max(1, Math.floor((cssH - 36) / (FRAME_H * 5 + 40)));
  const groups = atlasGroups();
  const pages = Math.max(1, Math.ceil(groups.length / per));
  const page = ((atlasPage % pages) + pages) % pages;
  const shown = groups.slice(page * per, page * per + per);
  ctx.fillText(atlasPaused ? "atlas 已暂停 · ← → 逐帧 · [ ] 翻页" : "atlas 播放中 · 空格暂停", 12, 8);
  ctx.fillText(`第 ${page + 1} / ${pages} 页`, 280, 8);
  let y = 28;
  for (const group of shown) {
    const frame = group.frames[((atlasStep % group.frames.length) + group.frames.length) % group.frames.length]!;
    const index = ((atlasStep % group.frames.length) + group.frames.length) % group.frames.length;
    const stride = STRIDE_LABEL[group.name] ?? 6;
    ctx.fillStyle = "#243044";
    ctx.fillText(`${group.name}  #${index}  stride ${stride}`, 12, y);
    y += 16;
    group.frames.forEach((f, i) => {
      const x = 12 + i * (FRAME_W + 6);
      ctx.drawImage(f.img, x, y);
      ctx.fillStyle = i === index ? "#0E7A32" : "#243044";
      ctx.fillRect(x + ANCHOR_X, y + ANCHOR_Y, 1, 2);
    });
    y += FRAME_H + 6;
    ctx.fillStyle = "#F4F1EA";
    ctx.fillRect(12, y, FRAME_W * 4, FRAME_H * 4);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame.img, 12, y, FRAME_W * 4, FRAME_H * 4);
    ctx.strokeStyle = "#D7263D";
    ctx.strokeRect(12 + ANCHOR_X * 4, y + ANCHOR_Y * 4, 4, 4);
    y += FRAME_H * 4 + 16;
  }
}

export function atlasPageNudge(dir: number) {
  atlasPage += dir;
}
