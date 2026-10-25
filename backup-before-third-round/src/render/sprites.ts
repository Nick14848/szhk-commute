import { tokens } from "../design/tokens";

/**
 * 固定 40×44 画布。锚点 (16, 40) 是脚底/接触点。
 * 不裁掉底部空行，所以跑步时躯干不会跟着裁切上下跳。
 * 跑步 6 帧是两只脚各自的轨迹，不是一条腿在原地伸缩。
 */

export const FRAME_W = 40;
export const FRAME_H = 44;
export const ANCHOR_X = 16;
export const ANCHOR_Y = 40;

export type Sprite = {
  w: number;
  h: number;
  ax: number;
  ay: number;
  img: HTMLCanvasElement;
};

export type PoseName = "idle" | "run" | "jump" | "land" | "duck" | "sit" | "dead";

const OUT = "#243044";
const SKIN = "#E2B08A";
const SKIN_D = "#C48E68";
const HAIR = "#2A241C";
const HAIR_G = "#8E8A84";
const SHIRT = "#F3F1EC";
const SHIRT_D = "#C9C3B8";
const PANTS = "#3E4450";
const PANTS_D = "#2A303A";
const SHOE = "#F4F4F4";
const SHOE_D = "#B7B7B7";
const PACK = "#3E8FD4";
const PACK_D = "#2A6FA8";

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
  shirt: string;
  shirtD: string;
  pants: string;
  pantsD: string;
  hair: string;
  pack: boolean;
  mask: boolean;
  phone: boolean;
  hat: boolean;
  vest: boolean;
  bag: boolean;
  trolley: boolean;
  paddle: boolean;
  chair: boolean;
  lean: number;
};

const playerLook: Look = {
  shirt: SHIRT,
  shirtD: SHIRT_D,
  pants: PANTS,
  pantsD: PANTS_D,
  hair: HAIR,
  pack: true,
  mask: false,
  phone: false,
  hat: false,
  vest: false,
  bag: false,
  trolley: false,
  paddle: false,
  chair: false,
  lean: 0,
};

function look(partial: Partial<Look>): Look {
  return { ...playerLook, pack: false, ...partial };
}

const RUN: Rig[] = [
  {
    hip: [16, 26], head: [22, 10], shoulder: [18, 16],
    kneeF: [22, 33], footF: [26, 40], kneeB: [10, 33], footB: [6, 40],
    elbowF: [12, 22], handF: [8, 28], elbowB: [24, 12], handB: [27, 8],
  },
  {
    hip: [16, 27], head: [22, 11], shoulder: [18, 17],
    kneeF: [18, 34], footF: [16, 40], kneeB: [8, 24], footB: [5, 32],
    elbowF: [14, 18], handF: [10, 14], elbowB: [22, 20], handB: [26, 26],
  },
  {
    hip: [16, 26], head: [22, 10], shoulder: [18, 16],
    kneeF: [20, 32], footF: [22, 40], kneeB: [18, 18], footB: [22, 26],
    elbowF: [11, 14], handF: [8, 10], elbowB: [24, 22], handB: [27, 30],
  },
  {
    hip: [16, 26], head: [22, 10], shoulder: [18, 16],
    kneeF: [10, 33], footF: [6, 40], kneeB: [22, 33], footB: [26, 40],
    elbowF: [24, 12], handF: [27, 8], elbowB: [12, 22], handB: [8, 28],
  },
  {
    hip: [16, 27], head: [22, 11], shoulder: [18, 17],
    kneeF: [8, 24], footF: [5, 32], kneeB: [18, 34], footB: [16, 40],
    elbowF: [22, 20], handF: [26, 26], elbowB: [14, 18], handB: [10, 14],
  },
  {
    hip: [16, 26], head: [22, 10], shoulder: [18, 16],
    kneeF: [18, 18], footF: [22, 26], kneeB: [20, 32], footB: [22, 40],
    elbowF: [24, 22], handF: [27, 30], elbowB: [11, 14], handB: [8, 10],
  },
];

const IDLE: Rig[] = [
  {
    hip: [16, 26], head: [22, 10], shoulder: [18, 16],
    kneeF: [20, 34], footF: [20, 40], kneeB: [12, 34], footB: [12, 40],
    elbowF: [22, 22], handF: [24, 28], elbowB: [12, 22], handB: [10, 28],
  },
  {
    hip: [16, 26], head: [22, 9], shoulder: [18, 16],
    kneeF: [20, 34], footF: [20, 40], kneeB: [12, 34], footB: [12, 40],
    elbowF: [23, 21], handF: [25, 26], elbowB: [11, 21], handB: [9, 26],
  },
];

const JUMP: Rig[] = [
  {
    hip: [16, 25], head: [22, 9], shoulder: [18, 15],
    kneeF: [12, 28], footF: [10, 36], kneeB: [22, 30], footB: [26, 38],
    elbowF: [10, 12], handF: [8, 8], elbowB: [26, 12], handB: [30, 8],
  },
  {
    hip: [16, 24], head: [22, 8], shoulder: [18, 14],
    kneeF: [13, 20], footF: [12, 28], kneeB: [22, 22], footB: [26, 30],
    elbowF: [8, 12], handF: [6, 8], elbowB: [28, 14], handB: [31, 10],
  },
  {
    hip: [16, 26], head: [22, 10], shoulder: [18, 16],
    kneeF: [14, 32], footF: [12, 40], kneeB: [22, 24], footB: [26, 32],
    elbowF: [12, 18], handF: [10, 24], elbowB: [24, 16], handB: [28, 12],
  },
];

const LAND: Rig = {
  hip: [16, 28], head: [22, 12], shoulder: [18, 18],
  kneeF: [22, 34], footF: [24, 40], kneeB: [12, 34], footB: [10, 40],
  elbowF: [24, 22], handF: [26, 28], elbowB: [12, 22], handB: [10, 28],
};

const DUCK: Rig[] = [
  {
    hip: [18, 32], head: [26, 26], shoulder: [20, 28],
    kneeF: [28, 34], footF: [32, 40], kneeB: [14, 36], footB: [10, 40],
    elbowF: [28, 30], handF: [32, 32], elbowB: [14, 30], handB: [12, 32],
  },
  {
    hip: [19, 33], head: [27, 27], shoulder: [21, 29],
    kneeF: [29, 35], footF: [33, 40], kneeB: [15, 36], footB: [11, 40],
    elbowF: [29, 31], handF: [33, 33], elbowB: [15, 31], handB: [13, 33],
  },
  {
    hip: [18, 32], head: [26, 26], shoulder: [20, 28],
    kneeF: [26, 34], footF: [30, 40], kneeB: [12, 35], footB: [8, 40],
    elbowF: [26, 29], handF: [30, 31], elbowB: [13, 30], handB: [10, 32],
  },
];

const SIT: Rig[] = [
  {
    hip: [14, 24], head: [18, 10], shoulder: [16, 16],
    kneeF: [24, 26], footF: [26, 40], kneeB: [8, 28], footB: [6, 40],
    elbowF: [22, 20], handF: [26, 24], elbowB: [10, 20], handB: [8, 24],
  },
  {
    hip: [14, 24], head: [18, 9], shoulder: [16, 16],
    kneeF: [24, 26], footF: [26, 40], kneeB: [8, 28], footB: [6, 40],
    elbowF: [22, 19], handF: [26, 23], elbowB: [10, 20], handB: [8, 24],
  },
];

const DEAD: Rig[] = [
  {
    hip: [14, 30], head: [8, 20], shoulder: [12, 24],
    kneeF: [20, 34], footF: [24, 40], kneeB: [10, 34], footB: [6, 40],
    elbowF: [18, 22], handF: [22, 18], elbowB: [6, 26], handB: [2, 30],
  },
  {
    hip: [12, 32], head: [6, 22], shoulder: [10, 26],
    kneeF: [18, 36], footF: [22, 40], kneeB: [8, 36], footB: [4, 40],
    elbowF: [16, 24], handF: [20, 20], elbowB: [4, 28], handB: [1, 32],
  },
];

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
      if (xx * xx + yy * yy <= r * r + 0.2) ctx.fillRect(cx + xx, cy + yy, 1, 1);
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
    if (r === 0) {
      ctx.fillRect(x, y, 1, 1);
      continue;
    }
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r + 0.2) ctx.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }
}

function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, thick: number) {
  line(ctx, a, b, OUT, thick + 1);
  line(ctx, a, b, color, thick);
}

function shoe(ctx: CanvasRenderingContext2D, foot: Pt, color: string) {
  const x = Math.round(foot[0]);
  const y = Math.round(foot[1]) - 1;
  ctx.fillStyle = OUT;
  ctx.fillRect(x - 1, y - 1, 6, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 4, 2);
}

function shift(rig: Rig, lean: number): Rig {
  if (!lean) return rig;
  const s = (p: Pt): Pt => [p[0] + lean, p[1]];
  return {
    hip: s(rig.hip),
    head: s(rig.head),
    shoulder: s(rig.shoulder),
    elbowF: s(rig.elbowF),
    handF: s(rig.handF),
    elbowB: s(rig.elbowB),
    handB: s(rig.handB),
    kneeF: s(rig.kneeF),
    footF: s(rig.footF),
    kneeB: s(rig.kneeB),
    footB: s(rig.footB),
  };
}

function paint(rig: Rig, look: Look): Sprite {
  const ctx = canvas();
  const img = ctx.canvas;
  const r = shift(rig, look.lean);
  limb(ctx, r.hip, r.kneeB, look.pantsD, 2);
  limb(ctx, r.kneeB, r.footB, look.pantsD, 2);
  shoe(ctx, r.footB, SHOE_D);
  limb(ctx, r.shoulder, r.elbowB, look.shirtD, 2);
  limb(ctx, r.elbowB, r.handB, SKIN_D, 1);

  if (look.bag) {
    const x = r.hip[0] - 12;
    const y = r.hip[1] - 2;
    ctx.fillStyle = OUT;
    ctx.fillRect(x - 1, y - 1, 10, 12);
    ctx.fillStyle = "#8A6A45";
    ctx.fillRect(x, y, 8, 10);
    ctx.fillStyle = "#C2A078";
    ctx.fillRect(x + 1, y + 2, 6, 2);
  }
  if (look.trolley) {
    const x = r.hip[0] - 14;
    const y = r.hip[1] + 2;
    ctx.fillStyle = OUT;
    ctx.fillRect(x + 2, y, 1, 12);
    ctx.fillRect(x, y + 8, 8, 6);
    ctx.fillRect(x + 1, y + 13, 2, 2);
    ctx.fillRect(x + 5, y + 13, 2, 2);
    ctx.fillStyle = "#D0D0D0";
    ctx.fillRect(x + 1, y + 9, 6, 4);
  }

  limb(ctx, r.hip, r.shoulder, look.shirt, 3);
  ctx.fillStyle = OUT;
  ctx.fillRect(r.shoulder[0] - 4, r.shoulder[1] - 2, 9, 2);
  ctx.fillStyle = look.shirt;
  ctx.fillRect(r.shoulder[0] - 3, r.shoulder[1] - 1, 7, 2);
  if (look.vest) {
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(r.shoulder[0] - 2, r.shoulder[1] + 2, 6, 6);
    ctx.fillStyle = OUT;
    ctx.fillRect(r.shoulder[0] + 1, r.shoulder[1] + 2, 1, 6);
  }
  if (look.pack) {
    const x = r.shoulder[0] - 10;
    const y = r.shoulder[1] - 1;
    ctx.fillStyle = OUT;
    ctx.fillRect(x - 1, y - 1, 8, 12);
    ctx.fillStyle = PACK_D;
    ctx.fillRect(x, y, 6, 10);
    ctx.fillStyle = PACK;
    ctx.fillRect(x + 1, y + 1, 4, 7);
    ctx.fillStyle = PACK_D;
    ctx.fillRect(r.shoulder[0] - 2, r.shoulder[1], 2, r.hip[1] - r.shoulder[1]);
  }

  limb(ctx, r.hip, r.kneeF, look.pants, 2);
  limb(ctx, r.kneeF, r.footF, look.pants, 2);
  shoe(ctx, r.footF, SHOE);
  limb(ctx, r.shoulder, r.elbowF, look.shirt, 2);
  limb(ctx, r.elbowF, r.handF, SKIN, 1);
  blob(ctx, r.handF[0], r.handF[1], SKIN, 1);
  blob(ctx, r.handB[0], r.handB[1], SKIN_D, 1);

  if (look.phone) {
    ctx.fillStyle = OUT;
    ctx.fillRect(r.handF[0] - 1, r.handF[1] - 3, 5, 7);
    ctx.fillStyle = "#9FD0EA";
    ctx.fillRect(r.handF[0], r.handF[1] - 2, 3, 5);
  }
  if (look.paddle) {
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(r.handF[0], r.handF[1] - 4, 6, 5);
    ctx.fillStyle = OUT;
    ctx.fillRect(r.handF[0] + 2, r.handF[1], 2, 4);
  }
  if (look.pack) {
    ctx.fillStyle = tokens.permit;
    ctx.fillRect(r.handB[0] - 1, r.handB[1] - 2, 4, 3);
    ctx.fillStyle = OUT;
    ctx.fillRect(r.handB[0], r.handB[1] - 1, 2, 1);
  }

  const hx = Math.round(r.head[0]);
  const hy = Math.round(r.head[1]);
  line(ctx, [hx, hy + 4], [r.shoulder[0], r.shoulder[1]], SKIN_D, 1);
  blob(ctx, hx, hy, OUT, 5);
  blob(ctx, hx, hy, SKIN, 4);
  ctx.fillStyle = look.hair;
  ctx.fillRect(hx - 4, hy - 5, 8, 3);
  ctx.fillRect(hx - 5, hy - 3, 3, 5);
  ctx.fillStyle = OUT;
  ctx.fillRect(hx + 2, hy - 1, 2, 2);
  if (look.mask) {
    ctx.fillStyle = "#D7DDE2";
    ctx.fillRect(hx, hy + 1, 6, 3);
    ctx.fillStyle = OUT;
    ctx.fillRect(hx, hy + 1, 6, 1);
  }
  if (look.hat) {
    ctx.fillStyle = OUT;
    ctx.fillRect(hx - 6, hy - 7, 12, 3);
    ctx.fillRect(hx - 4, hy - 11, 8, 4);
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(hx - 3, hy - 10, 6, 2);
  }
  if (look.chair) {
    ctx.fillStyle = OUT;
    ctx.fillRect(6, 22, 18, 3);
    ctx.fillRect(8, 25, 2, 15);
    ctx.fillRect(20, 25, 2, 15);
    ctx.fillStyle = "#6E6248";
    ctx.fillRect(7, 23, 16, 1);
  }

  return { w: FRAME_W, h: FRAME_H, ax: ANCHOR_X, ay: ANCHOR_Y, img };
}

function set(rigs: Rig[], look: Look) {
  return rigs.map((rig) => paint(rig, look));
}

const playerRun = set(RUN, playerLook);
const playerIdle = set(IDLE, playerLook);
const playerJump = set(JUMP, playerLook);
const playerLand = paint(LAND, playerLook);
const playerDuck = set(DUCK, playerLook);
const playerSit = set(SIT, { ...playerLook, chair: true });
const playerDead = set(DEAD, playerLook);

const maskLook = look({ pack: true, mask: true, shirt: "#E7E1D6", shirtD: "#B7B1A6" });
const phoneLook = look({ phone: true, lean: 2, shirt: "#D9E3EA", shirtD: "#A9B7C2", hair: "#1C1A17" });
const daigouLook = look({ bag: true, shirt: "#E7D7C4", shirtD: "#C2AD96", pants: "#5A4638", pantsD: "#3E3026" });
const inspectorLook = look({ hat: true, vest: true, paddle: true, shirt: "#F7F7F7", shirtD: "#D0D0D0" });
const grandmaLook = look({
  trolley: true,
  hat: true,
  hair: HAIR_G,
  shirt: "#C4B7A8",
  shirtD: "#8E8376",
  pants: "#4A403C",
  pantsD: "#2E2927",
});

const maskRun = set(RUN, maskLook);
const phoneRun = set(RUN, phoneLook);
const daigouRun = set(RUN, daigouLook);
const inspectorRun = set(RUN, inspectorLook);
const grandmaRun = set(RUN, grandmaLook);

function item(rows: string[]): Sprite {
  const h = rows.length;
  const w = rows[0]!.length;
  const img = document.createElement("canvas");
  img.width = w;
  img.height = h;
  const ctx = img.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const pal: Record<string, string> = {
    k: OUT,
    w: "#F7F7F7",
    b: tokens.line,
    g: tokens.permit,
    c: tokens.water,
    y: tokens.yellow,
    r: tokens.alert,
    m: tokens.mid,
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
  playerB: playerRun[1]!,
  playerC: playerRun[2]!,
  playerD: playerRun[3]!,
  playerJump: playerJump[0]!,
  playerDead: playerDead[0]!,
  playerSit: playerSit[0]!,
  duckA: playerDuck[0]!,
  duckB: playerDuck[1]!,
  maskA: maskRun[0]!,
  maskB: maskRun[1]!,
  maskC: maskRun[2]!,
  maskD: maskRun[3]!,
  phoneA: phoneRun[0]!,
  phoneB: phoneRun[1]!,
  phoneC: phoneRun[2]!,
  phoneD: phoneRun[3]!,
  daigouA: daigouRun[0]!,
  daigouB: daigouRun[2]!,
  inspectorA: inspectorRun[0]!,
  inspectorB: inspectorRun[3]!,
  grandma: grandmaRun[0]!,
  gate: item([
    "kk......kk......kk",
    "kr......kr......kr",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kkmmmmmmmmmmmmmmkk",
    "kkmmmmmmmmmmmmmmkk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
    "kk......kk......kk",
  ]),
  sams: item([
    "..kk....kk..",
    "..k.k..k.k..",
    ".kkkkkkkkkk.",
    "kkkkkkkkkkkk",
    "kwwwwwwwwwwk",
    "kkkkkkkkkkkk",
    "kkkkkkkkkkkk",
    "kkkkkkkkkkkk",
    ".kkkkkkkkkk.",
  ]),
  lens: item([
    "kkkkkkkkkkkkkkkkkkkk",
    "kwwwwwwwwwwwwwwwwwwk",
    "kwwwkkkkkkkkkkwwwwwk",
    "kwwkkwwwwwwwwkkwwwwk",
    "kwwkkwwkkwwkkkkwwwwk",
    "kwwkkwwwwwwwwkkwwwwk",
    "kwwwkkkkkkkkkkwwwwwk",
    "kwwwwwwwwwwwwwwwwwwk",
    "kkkkkkkkkkkkkkkkkkkk",
  ]),
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
    "kkkkkkkkkkkk",
    "kwwwwwwwwwwk",
    "kwkkwwwwkkwk",
    "kwkwwkwwkwkw",
    "kwkkwwwwkkwk",
    "kwwwwwwwwwwk",
    "kkkkkkkkkkkk",
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
};

const RUN_SETS: Record<string, Sprite[]> = {
  player: playerRun,
  mask: maskRun,
  phone: phoneRun,
  daigou: daigouRun,
  inspector: inspectorRun,
  grandma: grandmaRun,
};

export function actorFrame(kind: string, frame: number): Sprite {
  const setFrames = RUN_SETS[kind] ?? maskRun;
  const i = ((frame % setFrames.length) + setFrames.length) % setFrames.length;
  return setFrames[i]!;
}

export function grandmaFrame(frame: number) {
  return actorFrame("grandma", frame);
}

export function playerSprite(pose: PoseName, frame: number, vy = 0): Sprite {
  if (pose === "jump") {
    const phase = vy > 80 ? 0 : vy > -40 ? 1 : 2;
    return playerJump[phase]!;
  }
  if (pose === "duck") return playerDuck[((frame % 3) + 3) % 3]!;
  if (pose === "sit") return playerSit[frame % 2]!;
  if (pose === "dead") return playerDead[Math.min(1, frame)]!;
  if (pose === "land") return playerLand;
  if (pose === "idle") return playerIdle[frame % 2]!;
  return actorFrame("player", frame);
}

export function atlasGroups(): { name: string; frames: Sprite[] }[] {
  return [
    { name: "run", frames: playerRun },
    { name: "idle", frames: playerIdle },
    { name: "jump", frames: playerJump },
    { name: "land", frames: [playerLand] },
    { name: "duck", frames: playerDuck },
    { name: "sit", frames: playerSit },
    { name: "dead", frames: playerDead },
    { name: "mask", frames: maskRun },
    { name: "phone", frames: phoneRun },
    { name: "daigou", frames: daigouRun },
    { name: "inspector", frames: inspectorRun },
    { name: "grandma", frames: grandmaRun },
  ];
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

/** 把锚点放在 (footX, baselineY)。 */
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

export function paintAtlas(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, now: number) {
  ctx.fillStyle = "#E7E2D8";
  ctx.fillRect(0, 0, cssW, cssH);
  const groups = atlasGroups();
  let y = 16;
  const slow = Math.floor(now / 180);
  const normal = Math.floor(now / 90);
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#243044";
  ctx.textBaseline = "top";
  for (const group of groups) {
    if (y > cssH - 20) break;
    ctx.fillText(`${group.name}  1× / 4×`, 12, y);
    y += 16;
    group.frames.forEach((frame, i) => {
      const x = 12 + i * (FRAME_W + 8);
      checker(ctx, x, y, FRAME_W, FRAME_H);
      ctx.drawImage(frame.img, x, y);
    });
    y += FRAME_H + 8;
    const live = group.frames[normal % group.frames.length]!;
    const liveSlow = group.frames[slow % group.frames.length]!;
    ctx.fillStyle = "#F4F1EA";
    ctx.fillRect(12, y, FRAME_W * 4, FRAME_H * 4);
    ctx.fillRect(12 + FRAME_W * 4 + 12, y, FRAME_W * 4, FRAME_H * 4);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(live.img, 12, y, FRAME_W * 4, FRAME_H * 4);
    ctx.drawImage(liveSlow.img, 12 + FRAME_W * 4 + 12, y, FRAME_W * 4, FRAME_H * 4);
    y += FRAME_H * 4 + 18;
  }
}

function checker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      ctx.fillStyle = ((xx + yy) & 1) === 0 ? "#F4F1EA" : "#D9D3C7";
      ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}
