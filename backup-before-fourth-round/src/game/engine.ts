import { Sfx } from "../audio/sfx";
import {
  FIRST_LOOKAHEAD,
  FRAME_CAP,
  MAX_CATCHUP,
  PLAYER_VIEW_X,
  PREP_SECONDS,
  PREP_SECONDS_REDUCED,
  RAMP_SECONDS,
  SAFE_AFTER_DOOR,
  SPEED_EASE,
  STEP,
  canClear,
  gapSeconds,
  parseTimeScale,
  boardingLanding,
  progressOf,
  spanOf,
  speedAt,
} from "./balance";
import { distancePoints, finalScore, gameHkd, multiplier, pickupPoints, WATER_POINT, OCTOPUS_POINT } from "./score";
import {
  BORDER,
  SIGNS,
  STATIONS,
  UI,
  arrival,
  certified,
  deathLine,
  loadCoach,
  loadSave,
  moneyFor,
  saveCoach,
  titleFor,
  writeSave,
} from "../data/copy";
import { fontSC, prefersReducedMotion, tokens } from "../design/tokens";
import { drawWorld } from "../render/background";
import { drawDoor } from "../render/doors";
import { drawSeatOverlay, type Chip, type HudModel } from "../render/hud";
import { actorFrame, drawAnchored, paintAtlas, playerSprite } from "../render/sprites";
import { computeView, type View } from "../render/view";
import {
  OVERHEAD,
  OVERHEAD_Y,
  PICKUPS,
  hitBox,
  mulberry32,
  overlaps,
  spriteFor as entitySprite,
  walkSpeed,
  type Entity,
} from "./entities";
import { Player } from "./player";
import { SeatEvent } from "./seatEvent";
import {
  DAY_LEN,
  SEGMENTS,
  STATION_LEN,
  TRAIN_START,
  dayOf,
  nodeIndexAt,
  pickKind,
  placeAt,
  segmentAt,
  stationIndexAt,
  type Kind,
  type StageId,
} from "./stages";

export type RunResult = {
  score: number;
  waters: number;
  day: number;
  station: string;
  stationTrad: string;
  stationEn: string;
  quote: string;
  title: string;
  stamp: string;
  certified: boolean;
  hkd: number;
  isNew: boolean;
  best: number;
};

export type UiState = {
  phase: string;
  paused: boolean;
  coarse: boolean;
  short: boolean;
};

type Phase = "idle" | "run" | "seat" | "dead" | "over";
type Floater = { text: string; x: number; h: number; t0: number };
type Board = { phase: "close" | "hold" | "open"; t: number; day: number; landing: number };

const SIT_LEN = 420;
const OVERHEAD_FROM = 1800;

export function sampleResult(): RunResult {
  return buildResult(1460, 23, 1, STATIONS[7]!, "喂！行路睇路啊！", true, 1460);
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private v: View;
  private player = new Player();
  private sfx = new Sfx();
  private rng: () => number = Math.random;
  private phase: Phase = "idle";
  private reduced = prefersReducedMotion();
  private last = 0;
  private acc = 0;
  private time = 0;
  private simTime = 0;
  private activeTime = 0;
  private runTime = 0;
  private prepLeft = 0;
  private prepTotal = PREP_SECONDS;
  private distance = PLAYER_VIEW_X;
  private cam = 0;
  private speed = 0;
  private timeScale = 1;
  private seed = 1;
  private seeded = false;
  private score = 0;
  private waters = 0;
  private hi = 0;
  private entities: Entity[] = [];
  private floaters: Floater[] = [];
  private nextSpawn = 0;
  private locKey = "";
  private banner: [string, string] | null = null;
  private bannerUntil = 0;
  private doorUntil = 0;
  private seat: SeatEvent | null = null;
  private seatHold = 0;
  private seatSeen = false;
  private sitUntil = -1;
  private standUntil = -1;
  private safeUntil = 0;
  private permitUntil = 0;
  private doubleUntil = 0;
  private overheadHinted = false;
  private deadAt = 0;
  private deadEntity: Entity | null = null;
  private quote = "";
  private keyDuck = false;
  private frozen = false;
  private paused = false;
  private auto = false;
  private smoke = false;
  private smoked = false;
  private showBoxes = false;
  private atlas = false;
  private errors: string[] = [];
  private board: Board | null = null;
  private boardedDay = 0;
  private lastSeg: StageId | "" = "";
  private padDuck = false;
  private alive = true;
  private raf = 0;
  private cleanups: Array<() => void> = [];
  private coach = loadCoach();
  onPause: ((paused: boolean) => void) | null = null;
  onView: ((coarse: boolean) => void) | null = null;
  onState: ((state: UiState) => void) | null = null;
  private stats = { seats: 0, wins: 0, days: 1, maxStation: -1 };
  onResult: ((r: RunResult) => void) | null = null;
  onHud: ((m: HudModel) => void) | null = null;
  onMuteKey: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.v = this.measure();
    this.bind();
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    for (const undo of this.cleanups) undo();
    this.cleanups = [];
  }

  get audio() {
    return this.sfx;
  }

  uiState(): UiState {
    return {
      phase: this.phase,
      paused: this.paused,
      coarse: this.v.coarse,
      short: this.v.short,
    };
  }

  syncUi() {
    this.onState?.(this.uiState());
    this.onPause?.(this.paused);
    this.onView?.(this.v.coarse);
  }

  /** 只在开发服务器里生效。正式包里调用了也不会改倍率。 */
  setDebug(auto: boolean, fast: number, smoke = false, boxes = false, atlas = false) {
    if (!import.meta.env.DEV) return;
    this.auto = auto;
    this.timeScale = parseTimeScale(fast);
    this.smoke = smoke;
    this.showBoxes = boxes;
    this.atlas = atlas;
    if (atlas) this.frozen = true;
  }

  note(message: string) {
    this.errors.push(message);
  }

  clearInputs() {
    this.padDuck = false;
    this.keyDuck = false;
    this.syncDuck();
  }

  pause() {
    if (this.frozen) return;
    if (this.phase !== "run" && this.phase !== "seat") return;
    if (this.paused) return;
    this.paused = true;
    this.acc = 0;
    this.last = 0;
    this.clearInputs();
    this.syncUi();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.acc = 0;
    this.last = 0;
    this.syncUi();
  }

  restart() {
    this.paused = false;
    this.start();
  }

  setPadDuck(on: boolean) {
    this.padDuck = on;
    this.syncDuck();
  }

  debug() {
    return {
      phase: this.phase,
      paused: this.paused,
      score: Math.floor(this.score),
      speed: Math.round(this.speed * 10) / 10,
      timeScale: this.timeScale,
      simTime: Math.round(this.simTime * 1000) / 1000,
      activeTime: Math.round(this.activeTime * 1000) / 1000,
      cssW: this.v.cssW,
      cssH: this.v.cssH,
      dpr: this.v.dpr,
      pd: this.v.pd,
      W: this.v.W,
      H: this.v.H,
      world: Math.round(this.distance),
      seed: this.seed,
      errors: this.errors,
      stats: this.stats,
    };
  }

  start() {
    this.reset();
    this.phase = "run";
    this.paused = false;
    this.sfx.resume();
    const teach = !this.coach.jump;
    const hint = this.v.coarse ? UI.hintTouch : UI.hintKeys;
    this.setBanner(
      teach ? [UI.coachJump, hint] : [`${BORDER[0].trad}  ${SIGNS.departure}`, `${BORDER[0].en} · ${SIGNS.hours}`],
      2.6,
    );
    this.syncUi();
    this.v = this.measure();
  }

  loadShot(shot: string) {
    this.seeded = true;
    this.seed = 11;
    this.start();
    const at: Record<string, number> = {
      hall: PLAYER_VIEW_X,
      gates: SEGMENTS[1]!.start + 80,
      bridge: SEGMENTS[2]!.start + 180,
      platform: SEGMENTS[3]!.start + 80,
      train: TRAIN_START + STATION_LEN * 4 + 40,
      tunnel: TRAIN_START + STATION_LEN * 12 + 80,
      seat: TRAIN_START + STATION_LEN * 2 + 40,
      dead: TRAIN_START + STATION_LEN * 7 + 80,
    };
    this.warp(at[shot] ?? PLAYER_VIEW_X);
    const px = this.distance;
    const show = (kind: Kind, dx: number, h = 0) =>
      this.entities.push(this.make(kind, px + dx, OVERHEAD.has(kind) ? OVERHEAD_Y : h, 0.2));
    if (shot === "hall") {
      show("walker", 78);
      show("water", 130, 26);
      show("luggage", 180);
    } else if (shot === "gates") {
      show("gate", 70);
      show("kid", 140);
      show("permit", 190);
    } else if (shot === "bridge") {
      show("sign", 90);
      show("water", 140);
      show("office", 190);
    } else if (shot === "platform") {
      show("queue", 90);
      show("octopus", 160, 22);
      show("elder", 210);
    } else if (shot === "train" || shot === "tunnel") {
      show("office", 70);
      show("water", 120, 26);
      show("kid", 180);
      this.player.h = 18;
      this.player.vy = 40;
      this.player.pose = "jump";
    } else if (shot === "seat") {
      this.phase = "seat";
      this.seat = new SeatEvent(() => 0.5);
      this.seat.player = 0.62;
      this.seat.grandma = 0.41;
    } else if (shot === "dead") {
      show("inspector", 16);
      this.score = 1460;
      this.die(this.entities.at(-1)!);
    }
    this.banner = null;
    this.bannerUntil = 0;
    this.prepLeft = 0;
    this.board = null;
    this.safeUntil = 0;
    this.permitUntil = 0;
    this.frozen = true;
    this.syncLocation(true);
    this.draw();
  }

  private reset() {
    if (!this.seeded) this.seed = Math.floor(Math.random() * 1e9) >>> 0;
    this.rng = mulberry32(this.seed);
    this.time = 0;
    this.simTime = 0;
    this.activeTime = 0;
    this.runTime = 0;
    this.acc = 0;
    this.last = 0;
    this.prepTotal = this.reduced ? PREP_SECONDS_REDUCED : PREP_SECONDS;
    this.prepLeft = this.prepTotal;
    this.distance = PLAYER_VIEW_X;
    this.cam = 0;
    this.speed = 0;
    this.score = 0;
    this.waters = 0;
    this.hi = loadSave()?.bestScore ?? 0;
    this.entities = [];
    this.floaters = [];
    this.nextSpawn = this.distance + SPEED_EASE * FIRST_LOOKAHEAD;
    this.locKey = "";
    this.lastSeg = "";
    this.board = null;
    this.boardedDay = 0;
    this.banner = null;
    this.bannerUntil = 0;
    this.doorUntil = 0;
    this.seat = null;
    this.seatHold = 0;
    this.seatSeen = false;
    this.sitUntil = -1;
    this.standUntil = -1;
    this.safeUntil = 0;
    this.permitUntil = 0;
    this.doubleUntil = 0;
    this.overheadHinted = false;
    this.deadEntity = null;
    this.quote = "";
    this.keyDuck = false;
    this.padDuck = false;
    this.frozen = false;
    this.errors = [];
    this.stats = { seats: 0, wins: 0, days: 1, maxStation: -1 };
    this.player.reset();
    this.player.pose = "idle";
  }

  private warp(localX: number) {
    this.distance = Math.max(PLAYER_VIEW_X, localX);
    this.cam = this.distance - PLAYER_VIEW_X;
    this.entities = [];
    this.nextSpawn = this.distance + this.v.W * 0.8;
    this.locKey = "";
  }

  private measure(): View {
    const probe = document.getElementById("safe-probe");
    const cs = probe ? getComputedStyle(probe) : null;
    const safeTop = cs ? parseFloat(cs.paddingTop) || 0 : 0;
    const safeBottom = cs ? parseFloat(cs.paddingBottom) || 0 : 0;
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const pointerCoarse = window.matchMedia("(pointer: coarse)").matches;
    const coarse = pointerCoarse || (navigator.maxTouchPoints > 0 && w < 900) || w < 720 || (w < 900 && h < 500);
    const hudEl = document.getElementById("hud");
    const hudBody = hudEl && !hudEl.hidden ? hudEl.getBoundingClientRect().height : 0;
    const v = computeView(w, h, window.devicePixelRatio || 1, safeTop, safeBottom, coarse, hudBody);
    this.v = v;
    this.canvas.width = Math.round(w * v.dpr);
    this.canvas.height = Math.round(h * v.dpr);
    this.ctx.imageSmoothingEnabled = false;
    this.syncUi();
    return v;
  }

  private on(target: EventTarget, type: string, fn: EventListener) {
    target.addEventListener(type, fn);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  private bind() {
    const relayout = () => {
      this.v = this.measure();
      this.draw();
    };
    this.on(window, "resize", relayout);
    if (window.visualViewport) this.on(window.visualViewport, "resize", relayout);

    this.on(window, "keydown", (event) => {
      const e = event as KeyboardEvent;
      if (document.querySelector("#overlay.on")) return;
      if (e.target instanceof Element && e.target.closest("button, #rail, #hud, #paused")) return;
      const up = e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW";
      const down = e.code === "ArrowDown" || e.code === "KeyS";
      if (up || down) e.preventDefault();
      if (e.code === "KeyM" && !e.repeat) this.onMuteKey?.();
      if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
        if (this.paused) this.resume();
        else this.pause();
        return;
      }
      if (this.paused || e.repeat) return;
      if (up) this.press();
      if (down) {
        this.keyDuck = true;
        this.syncDuck();
      }
    });
    this.on(window, "keyup", (event) => {
      const e = event as KeyboardEvent;
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        this.keyDuck = false;
        this.syncDuck();
      }
    });

    const c = this.canvas;
    this.on(c, "contextmenu", (event) => event.preventDefault());
    this.on(c, "pointerdown", (event) => {
      event.preventDefault();
      this.sfx.resume();
      this.press();
    });
    this.on(window, "blur", () => {
      this.clearInputs();
    });
  }

  private syncDuck() {
    this.player.duckHeld = this.phase === "run" && !this.paused && (this.keyDuck || this.padDuck);
  }

  press() {
    if (this.paused) return;
    if (this.phase === "seat") {
      this.seat?.tap();
      return;
    }
    if (this.phase !== "run" || this.sitting()) return;
    if (this.player.duckHeld && this.player.grounded) return;
    if (this.player.holdJump(!this.standing())) this.onJumped(this.player.jumps === 1 ? 2 : 1);
  }

  private onJumped(before: number) {
    this.sfx.jump();
    if (!this.coach.jump) {
      this.coach.jump = true;
      saveCoach(this.coach);
      this.setBanner([UI.coachAir, ""], 1.6);
    } else if (before === 1 && !this.coach.double) {
      this.coach.double = true;
      saveCoach(this.coach);
    }
  }

  private loop = (stamp: number) => {
    if (!this.alive) return;
    if (this.last === 0) {
      this.last = stamp;
      this.draw();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    let raw = (stamp - this.last) / 1000;
    this.last = stamp;
    if (this.paused || this.frozen) {
      this.acc = 0;
      this.draw();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    raw = Math.min(FRAME_CAP, Math.max(0, raw));
    this.activeTime += raw;
    this.acc += raw * this.timeScale;
    const budget = this.timeScale === 1 ? MAX_CATCHUP : this.timeScale;
    let n = 0;
    try {
      while (this.acc >= STEP && n < budget) {
        this.step(STEP);
        this.acc -= STEP;
        this.simTime += STEP;
        n++;
      }
    } catch (err) {
      this.errors.push(String(err));
      console.error(err);
    }
    if (n >= budget) this.acc = 0;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number) {
    if (this.paused) return;
    if (this.phase === "run") this.tick(dt);
    else if (this.phase === "seat") this.tickSeat(dt);
    else if (this.phase === "dead" && this.time - this.deadAt > 0.4) this.finish();
    if (this.phase !== "idle" && this.phase !== "over") this.time += dt;
    this.floaters = this.floaters.filter((f) => this.time - f.t0 < 0.8);
  }

  private px() {
    return this.distance;
  }

  private sitting() {
    return this.distance < this.sitUntil;
  }

  private standing() {
    return this.distance < this.standUntil;
  }

  private tick(dt: number) {
    if (this.prepLeft > 0) {
      this.prepLeft -= dt;
      this.speed = 0;
      this.player.pose = "idle";
      this.cam = this.distance - PLAYER_VIEW_X;
      return;
    }

    this.runTime += dt;
    this.advanceBoard(dt);
    this.speed = speedAt(this.distance, this.runTime);
    let moved = 0;
    if (this.board) {
      this.speed = 0;
    } else {
      moved = this.speed * dt;
      this.distance += moved;
    }
    this.cam = this.distance - PLAYER_VIEW_X;
    this.maybeBoard();

    if (this.auto && import.meta.env.DEV) this.autopilot();
    this.syncLocation(false);
    if (this.phase !== "run") return;

    this.player.tickBuffer(dt);
    if (!(this.player.duckHeld && this.player.grounded) && !this.sitting()) {
      const before = this.player.jumps;
      if (this.player.consumeJump(!this.standing())) this.onJumped(before);
    }

    if (this.sitting()) {
      this.player.h = 0;
      this.player.vy = 0;
      this.player.pose = "sit";
    } else if (this.board) {
      this.player.h = 0;
      this.player.vy = 0;
      this.player.pose = "idle";
    } else {
      this.player.update(dt, moved);
    }

    if (!this.board) {
      for (const e of this.entities) {
        const sp = walkSpeed(e.kind);
        e.x += sp * dt;
        if (sp !== 0) e.travel += Math.abs(sp) * dt;
      }
      this.spawn();
      this.collide();
      this.score += distancePoints(moved, this.mult());
    }
    this.stats.maxStation = Math.max(this.stats.maxStation, stationIndexAt(this.distance));
    this.stats.days = dayOf(this.distance);

    if (!this.overheadHinted) {
      const near = this.entities.find(
        (e) => OVERHEAD.has(e.kind) && e.x - this.cam < this.v.W * 0.85 && e.x > this.distance,
      );
      if (near) {
        this.overheadHinted = true;
        this.coach.duck = true;
        saveCoach(this.coach);
        this.setBanner([this.v.coarse ? UI.overheadHint : UI.overheadHintKeys, UI.coachDuck], 1.8);
      }
    }
    if (this.smoke && !this.smoked && dayOf(this.distance) >= 2) {
      this.smoked = true;
      this.frozen = true;
      Object.assign(window, {
        __smoke: {
          ok: this.errors.length === 0,
          errors: this.errors.slice(),
          day: dayOf(this.distance),
          score: Math.floor(this.score),
          place: placeAt(this.distance).simp,
          seats: this.stats.seats,
        },
      });
    }
  }

  private mult() {
    return multiplier(this.sitting(), this.time < this.doubleUntil);
  }

  private make(kind: Kind, x: number, y: number, phase = 0): Entity {
    return { kind, x, y, phase, travel: phase * 24 };
  }

  private boardDur() {
    if (this.reduced) return { close: 0.12, hold: 0.04, open: 0.16 };
    return { close: 0.36, hold: 0.12, open: 0.46 };
  }

  /** 一天只在落马洲站台上车时关一次门。不跳过大段路程。 */
  private maybeBoard() {
    if (this.board || this.phase !== "run" || this.prepLeft > 0) return;
    const day = dayOf(this.distance);
    if (this.boardedDay === day) return;
    if (segmentAt(this.distance).id !== "platform") return;
    const base = Math.floor(this.distance / DAY_LEN) * DAY_LEN;
    const doorX = base + TRAIN_START;
    const landing = boardingLanding(this.distance, doorX);
    if (landing == null) return;
    this.board = { phase: "close", t: 0, day, landing };
    this.player.pose = "idle";
    this.player.h = 0;
    this.player.vy = 0;
  }

  private advanceBoard(dt: number) {
    const b = this.board;
    if (!b) return;
    const dur = this.boardDur();
    b.t += dt;
    if (b.phase === "close" && b.t >= dur.close) {
      b.phase = "hold";
      b.t = 0;
      return;
    }
    if (b.phase === "hold" && b.t >= dur.hold) {
      this.distance = b.landing;
      this.cam = this.distance - PLAYER_VIEW_X;
      this.boardedDay = b.day;
      this.clearAhead();
      this.sfx.doors();
      b.phase = "open";
      b.t = 0;
      return;
    }
    if (b.phase === "open" && b.t >= dur.open) {
      this.safeUntil = this.time + SAFE_AFTER_DOOR;
      this.nextSpawn = Math.max(this.nextSpawn, this.distance + speedAt(this.distance, this.runTime) * 1.6);
      this.board = null;
    }
  }

  private clearAhead() {
    const px = this.distance;
    this.entities = this.entities.filter((e) => PICKUPS.has(e.kind) || e.x < px - 24);
    this.nextSpawn = Math.max(this.nextSpawn, px + 80);
  }

  private doorCover() {
    const b = this.board;
    if (!b) return 0;
    const dur = this.boardDur();
    if (b.phase === "close") return Math.min(1, b.t / Math.max(0.01, dur.close));
    if (b.phase === "hold") return 1;
    return Math.max(0, 1 - b.t / Math.max(0.01, dur.open));
  }

  private syncLocation(silent: boolean) {
    const px = this.px();
    const key = `${dayOf(px)}:${nodeIndexAt(px)}`;
    if (key === this.locKey) return;
    const first = this.locKey === "";
    const prevDay = first ? dayOf(px) : Number(this.locKey.split(":")[0]);
    this.locKey = key;
    if (first || silent) {
      this.lastSeg = segmentAt(px).id;
      return;
    }

    const day = dayOf(px);
    const i = stationIndexAt(px);
    const seg = segmentAt(px).id;
    this.lastSeg = seg;
    if (day !== prevDay) {
      this.setBanner([UI.dayStart(day), `Day ${day} · ${BORDER[0].en}`], 2.4);
      this.safeUntil = Math.max(this.safeUntil, this.time + SAFE_AFTER_DOOR);
      this.clearAhead();
      this.sfx.card();
      return;
    }
    if (i === 0) {
      this.setBanner(["東鐵綫  往 金鐘", "East Rail Line · To Admiralty"], 2.4);
      return;
    }
    if (i > 0) {
      this.setBanner(arrival(STATIONS[i]!, STATIONS[i + 1]), 2.2);
      if (!this.sitting() && !this.board && ((i === 2 && !this.seatSeen) || (i > 2 && this.rng() < 0.3))) {
        this.beginSeat();
      }
      return;
    }
    const place = placeAt(px);
    const sub: Record<string, string> = {
      gates: "準備好證件 · 請望鏡頭",
      bridge: "深圳 → 香港 · 前面有步行梯",
      platform: "東鐵綫 East Rail Line · 落馬洲",
    };
    this.setBanner([`${place.trad}  ${place.en}`, sub[seg] ?? ""], 2);
  }

  private setBanner(lines: [string, string], seconds: number) {
    this.banner = lines;
    this.bannerUntil = this.time + seconds;
  }

  private beginSeat() {
    this.phase = "seat";
    this.seat = new SeatEvent(this.rng);
    this.seatSeen = true;
    this.seatHold = 0;
    this.stats.seats++;
    this.syncDuck();
    this.syncUi();
  }

  private tickSeat(dt: number) {
    const seat = this.seat;
    if (!seat) {
      this.phase = "run";
      return;
    }
    if (this.auto && import.meta.env.DEV && !seat.done && this.rng() < 0.45) seat.tap();
    if (!seat.done) {
      seat.update(dt);
      if (seat.done) {
        this.seatHold = 1.1;
        if (seat.won) this.sfx.card();
        else this.sfx.cardFail();
      }
      return;
    }
    this.seatHold -= dt;
    if (this.seatHold > 0) return;

    const px = this.px();
    if (seat.won) {
      this.stats.wins++;
      this.sitUntil = px + SIT_LEN;
      const clearTo = this.sitUntil + 80;
      this.entities = this.entities.filter((e) => e.x > clearTo || (PICKUPS.has(e.kind) && e.x < px));
      this.nextSpawn = Math.max(this.nextSpawn, clearTo);
    } else {
      const i = stationIndexAt(px);
      const dayBase = Math.floor(px / DAY_LEN) * DAY_LEN;
      this.standUntil = dayBase + TRAIN_START + (i + 1) * STATION_LEN;
      this.entities = this.entities.filter((e) => PICKUPS.has(e.kind) || e.x > px + 140);
    }
    this.safeUntil = Math.max(this.safeUntil, this.time + 1.1);
    this.seat = null;
    this.phase = "run";
    this.syncDuck();
    this.syncUi();
  }

  private spawn() {
    const horizon = this.cam + this.v.W + 24;
    let guard = 0;
    while (this.nextSpawn < horizon && guard++ < 8) {
      const x = this.nextSpawn;
      if (x < this.sitUntil + 80) {
        this.nextSpawn = this.sitUntil + 80;
        continue;
      }
      const speedThere = Math.max(SPEED_EASE, speedAt(x, Math.max(this.runTime, 0.2)));
      const allowDouble = !this.standing();
      const early = this.runTime < RAMP_SECONDS;
      let kind = pickKind(x, this.rng, x > OVERHEAD_FROM);
      let tries = 0;
      while (tries++ < 8 && this.blocked(kind, speedThere, allowDouble, early)) {
        kind = pickKind(x, this.rng, x > OVERHEAD_FROM);
      }
      if (this.blocked(kind, speedThere, allowDouble, early)) kind = "walker";
      const phase = this.rng();
      this.entities.push(this.make(kind, x, OVERHEAD.has(kind) ? OVERHEAD_Y : 0, phase));

      const gap = speedThere * gapSeconds(progressOf(x), this.rng()) + spanOf(kind);
      const r = this.rng();
      const mid = x + gap * 0.42;
      if (r < 0.5) {
        this.entities.push(this.make("water", mid, this.rng() < 0.45 ? 28 : 0, this.rng()));
      } else if (r < 0.6) {
        const special = this.specialFor(x);
        this.entities.push(this.make(special, mid, special === "concession" ? 0 : 18, 0));
      }
      this.nextSpawn = x + gap;
    }
    const keep = this.cam - 80;
    this.entities = this.entities.filter((e) => e.x > keep);
  }

  private blocked(kind: Kind, speed: number, allowDouble: boolean, early: boolean) {
    if (early && (kind === "queue" || kind === "luggage" || kind === "sign")) return true;
    return !canClear(kind, speed, allowDouble);
  }

  private specialFor(x: number): Kind {
    const id = segmentAt(x).id;
    if (id === "hall") return this.rng() < 0.6 ? "concession" : "octopus";
    if (id === "gates") return "permit";
    if (id === "train") return this.rng() < 0.5 ? "permit" : "octopus";
    return "octopus";
  }

  private collide() {
    const pb = this.player.box(this.distance);
    const safe =
      this.sitting() ||
      this.board !== null ||
      this.time < this.safeUntil ||
      this.time < this.permitUntil;
    for (const e of this.entities) {
      const b = hitBox(e);
      if (!b || !overlaps(pb, b)) continue;
      if (PICKUPS.has(e.kind)) {
        this.collect(e);
        continue;
      }
      if (safe) continue;
      this.die(e);
      return;
    }
  }

  private collect(e: Entity) {
    e.taken = true;
    const m = this.mult();
    const at = { x: e.x, h: e.y + 28, t0: this.time };
    if (e.kind === "water") {
      this.waters++;
      const gained = pickupPoints(WATER_POINT, m);
      this.score += gained;
      this.sfx.water();
      this.floaters.push({ ...at, text: `+${gained}` });
    } else if (e.kind === "octopus") {
      const gained = pickupPoints(OCTOPUS_POINT, m);
      this.score += gained;
      this.sfx.card();
      this.floaters.push({ ...at, text: `+${gained}` });
    } else if (e.kind === "permit") {
      this.permitUntil = this.time + 4;
      this.sfx.card();
      this.floaters.push({ ...at, text: SIGNS.echannel });
    } else if (e.kind === "concession") {
      this.doubleUntil = this.time + 8;
      this.sfx.card();
      this.floaters.push({ ...at, text: "得分 ×2 · 8秒" });
    }
  }

  private die(e: Entity) {
    if (this.phase === "dead" || this.phase === "over") return;
    this.phase = "dead";
    this.deadAt = this.time;
    this.deadEntity = e;
    this.quote = deathLine(e.kind, this.rng);
    this.player.pose = "dead";
    this.clearInputs();
    if (e.kind === "gate") this.sfx.cardFail();
    else this.sfx.hit();
    this.syncUi();
  }

  private finish() {
    if (this.phase === "over") return;
    this.phase = "over";
    const px = this.px();
    const place = placeAt(px);
    const score = finalScore(this.score);
    const prev = loadSave();
    const isNew = !prev || score > prev.bestScore;
    if (isNew) writeSave({ bestScore: score, bestStation: place.simp, bestDay: dayOf(px) });
    const best = Math.max(score, prev?.bestScore ?? 0);
    this.onResult?.(buildResult(score, this.waters, dayOf(px), place, this.quote, isNew, best));
    this.syncUi();
  }

  private autopilot() {
    const pb = this.player.box(this.distance);
    const ahead = this.entities
      .filter((e) => !PICKUPS.has(e.kind) && !e.taken)
      .map((e) => ({ e, b: hitBox(e)! }))
      .filter(({ b }) => b && b.x1 > pb.x0)
      .sort((a, b) => a.b.x0 - b.b.x0);
    const next = ahead[0];
    if (!next) {
      this.keyDuck = false;
      this.syncDuck();
      return;
    }
    const dist = next.b.x0 - pb.x1;
    const rel = Math.max(20, this.speed - walkSpeed(next.e.kind));
    if (OVERHEAD.has(next.e.kind)) {
      this.keyDuck = dist < rel * 0.32 && dist > -10;
      this.syncDuck();
      return;
    }
    this.keyDuck = false;
    this.syncDuck();
    if (this.player.grounded && dist > 0 && dist < rel * 0.16) this.press();
  }

  private draw() {
    const ctx = this.ctx;
    const v = this.v;
    ctx.imageSmoothingEnabled = false;
    if (this.atlas) {
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      paintAtlas(ctx, v.cssW, v.cssH, performance.now());
      return;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = tokens.page;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(v.pd, 0, 0, v.pd, v.offsetX, v.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, v.W, v.H);
    ctx.clip();
    drawWorld(ctx, v, this.cam, this.time, this.reduced);

    if (this.phase !== "seat") {
      const sorted = [...this.entities].sort((a, b) => a.y - b.y);
      for (const e of sorted) this.drawEntity(e);
      this.drawPlayer();
    } else {
      ctx.fillStyle = "rgba(28, 32, 38, 0.38)";
      ctx.fillRect(0, 0, v.W, v.H);
      this.drawSeatScene();
    }
    this.drawFloaters();
    const cover = this.doorCover();
    if (cover > 0.02) drawDoor(ctx, v, "train", cover);
    if (this.showBoxes && import.meta.env.DEV) this.drawBoxes();
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(v.offsetX + 1, v.offsetY + 1, v.W * v.pd - 2, v.H * v.pd - 2);

    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    if (this.phase === "seat" && this.seat) {
      const note = this.seat.done ? (this.seat.won ? UI.sitWin : UI.sitLose) : null;
      drawSeatOverlay(ctx, v, this.seat, note, !v.coarse);
    }
    this.onHud?.(this.hudModel());
  }

  private drawEntity(e: Entity) {
    if (e.taken) return;
    const v = this.v;
    const ctx = this.ctx;
    const sx = e.x - this.cam;
    if (sx > v.W + 48 || sx < -48) return;
    if (e.kind === "sign") {
      this.drawSign(sx, v.G - OVERHEAD_Y);
      return;
    }
    const moving = walkSpeed(e.kind) > 0 && !this.paused && !this.frozen && !this.board;
    let baseline = v.G - e.y;
    if (PICKUPS.has(e.kind) && e.kind !== "concession" && !this.reduced && !this.paused) {
      baseline -= Math.round(Math.sin(this.time * 4 + e.phase * 6)) > 0 ? 1 : 0;
    }
    if (e.kind === "queue") {
      drawAnchored(ctx, actorFrame("walker", 0, "idle"), sx - 14, baseline);
      drawAnchored(ctx, actorFrame("office", 1, "idle"), sx, baseline);
      drawAnchored(ctx, actorFrame("kid", 0, "idle"), sx + 14, baseline);
      return;
    }
    drawAnchored(ctx, entitySprite(e, moving), sx, baseline);
  }

  private drawSign(sx: number, boardBottom: number) {
    const ctx = this.ctx;
    const v = this.v;
    const w = 36;
    const h = 16;
    const left = Math.round(sx - w / 2);
    const top = Math.round(boardBottom - h);
    ctx.fillStyle = tokens.mid;
    ctx.fillRect(Math.round(sx) - 1, v.T + 4, 2, Math.max(0, top - v.T - 4));
    ctx.fillStyle = tokens.inkDeep;
    ctx.fillRect(left - 1, top - 1, w + 2, h + 2);
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = tokens.inkDeep;
    ctx.font = `700 8px ${fontSC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("低頭", Math.round(sx), top + h / 2);
  }

  private drawPlayer() {
    const v = this.v;
    const p = this.player;
    let pose = p.pose;
    if (this.prepLeft > 0) pose = "idle";
    if (this.phase === "dead") pose = "dead";
    if (this.board) pose = "idle";
    const frame = pose === "sit" || pose === "idle" ? Math.floor(this.time * 2) : p.frame;
    if (pose === "sit") {
      this.ctx.fillStyle = "#C5CCD1";
      this.ctx.fillRect(v.playerX - 16, v.G - 12, 30, 5);
      this.ctx.fillStyle = "#8E979E";
      this.ctx.fillRect(v.playerX - 16, v.G - 20, 30, 5);
    }
    const s = playerSprite(pose, frame, p.vy);
    drawAnchored(this.ctx, s, v.playerX, v.G - p.h);
  }

  private drawSeatScene() {
    const v = this.v;
    const ctx = this.ctx;
    const seat = this.seat;
    if (!seat) return;
    const cx = Math.round(v.W * 0.58);
    const frame = Math.floor(this.time * 8);
    ctx.fillStyle = "#C5CCD1";
    ctx.fillRect(cx - 18, v.G - 12, 34, 5);
    ctx.fillStyle = "#8E979E";
    ctx.fillRect(cx - 18, v.G - 22, 34, 6);
    if (seat.done && seat.won) {
      drawAnchored(ctx, playerSprite("sit", frame), cx, v.G);
      drawAnchored(ctx, actorFrame("elder", 0, "idle"), cx + 36, v.G, true);
    } else if (seat.done) {
      drawAnchored(ctx, actorFrame("elder", 1, "idle"), cx - 6, v.G, true);
      drawAnchored(ctx, playerSprite("idle", 0), cx - 40, v.G);
    } else {
      const pTravel = Math.min(1, seat.player);
      const gTravel = Math.min(1, seat.grandma);
      drawAnchored(ctx, playerSprite("walk", frame), cx - 70 + pTravel * 48, v.G);
      drawAnchored(ctx, actorFrame("elder", frame, "walk"), cx + 54 - gTravel * 36, v.G, true);
    }
  }

  private drawBoxes() {
    const ctx = this.ctx;
    const v = this.v;
    ctx.strokeStyle = tokens.alert;
    ctx.lineWidth = 1;
    const boxes = [this.player.box(this.distance), ...this.entities.map((e) => hitBox(e)).filter((b): b is NonNullable<typeof b> => !!b)];
    for (const b of boxes) {
      ctx.strokeRect(b.x0 - this.cam, v.G - b.y1, b.x1 - b.x0, b.y1 - b.y0);
    }
  }

  private drawFloaters() {
    const ctx = this.ctx;
    const v = this.v;
    ctx.font = `700 8px ${fontSC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const f of this.floaters) {
      const t = (this.time - f.t0) / 0.8;
      ctx.fillStyle = tokens.inkDeep;
      ctx.globalAlpha = 1 - t * t;
      ctx.fillText(f.text, Math.round(f.x - this.cam), Math.round(v.G - f.h - t * 10));
    }
    ctx.globalAlpha = 1;
  }

  private hudModel() {
    const px = this.px();
    const place = placeAt(px);
    const chips: Chip[] = [];
    if (this.sitting()) chips.push({ text: UI.chipSit, color: tokens.line });
    if (this.standing()) chips.push({ text: UI.chipStand, color: tokens.alert });
    if (this.time < this.permitUntil && this.phase === "run") {
      chips.push({ text: UI.chipEdash, color: tokens.permit });
    }
    if (this.time < this.doubleUntil) chips.push({ text: UI.chipConcession, color: tokens.yellow });
    const doorBlink = !this.reduced && this.time < this.doorUntil && Math.floor(this.time * 6) % 2 === 0;
    return {
      node: nodeIndexAt(px),
      placeTrad: place.trad,
      placeEn: place.en,
      score: finalScore(this.score),
      hi: Math.max(this.hi, this.score),
      waters: this.waters,
      day: dayOf(px),
      doorBlink,
      chips,
      banner: this.time < this.bannerUntil ? this.banner : null,
    };
  }
}

function buildResult(
  score: number,
  waters: number,
  day: number,
  place: { simp: string; trad: string; en: string },
  quote: string,
  isNew: boolean,
  best: number,
): RunResult {
  const title = titleFor(score);
  return {
    score,
    waters,
    day,
    station: place.simp,
    stationTrad: place.trad,
    stationEn: place.en,
    quote,
    title: title.name,
    stamp: title.stamp,
    certified: certified(score),
    hkd: moneyFor(score).hkd,
    isNew,
    best,
  };
}

