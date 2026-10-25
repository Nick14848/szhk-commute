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
  SEAT_LOSE_SEC,
  SEAT_WIN_SEC,
  SPEED_EASE,
  STEP,
  canClear,
  gapSeconds,
  kidFileClear,
  parseTimeScale,
  boardingLanding,
  progressOf,
  spanOf,
  speedAt,
} from "./balance";
import { bottlesGained, distancePoints, finalScore, multiplier, pickupPoints, WATER_POINT, OCTOPUS_POINT } from "./score";
import {
  BORDER,
  STATIONS,
  UI,
  certified,
  deathLine,
  loadCoach,
  commitRun,
  loadSave,
  saveCoach,
  titleFor,
} from "../data/copy";
import { fontSC, prefersReducedMotion, tokens } from "../design/tokens";
import { drawObstacleGate, drawWorld } from "../render/background";
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
  legacyProgress,
  segmentAt,
  inSafeJoin,
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
type Floater = { text: string; x: number; h: number; t0: number; life: number; big?: boolean };
type Board = { phase: "close" | "hold" | "open"; t: number; day: number; landing: number };

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
  private viewLift = 0;
  private frameDt = 0;
  private speed = 0;
  private timeScale = 1;
  private seed = 1;
  private seeded = false;
  private score = 0;
  private waters = 0;
  private attempt = 1;
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
  private playTime = 0;
  private safeUntil = 0;
  private permitUntil = 0;
  private seatSafeUntil = 0;
  private noDoubleUntil = 0;
  private toldSafe = false;
  private toldLock = false;
  private immune = new Set<Entity>();
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
    this.sfx.close();
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
    this.player.release();
    this.syncDuck();
  }

  relayout() {
    this.v = this.measure();
    this.draw();
  }

  pause() {
    if (this.frozen) return;
    if (this.phase !== "run" && this.phase !== "seat") return;
    if (this.paused) return;
    this.paused = true;
    this.acc = 0;
    this.frameDt = 0;
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
      offsetX: this.v.offsetX,
      offsetY: this.v.offsetY,
      viewLift: Math.round(this.viewLift * 10) / 10,
      playerScreenX: (this.v.offsetX + this.v.playerX * this.v.pd) / this.v.dpr,
      groundBaseline: (this.v.offsetY + (this.v.G + this.viewLift) * this.v.pd) / this.v.dpr,
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
    this.v = this.measure();
    if (!this.coach.jump) {
      const line = this.v.coarse ? UI.hintTouch : UI.hintKeys;
      this.setBanner([line, ""], 4.2);
    }
    this.syncUi();
  }

  loadShot(shot: string) {
    this.seeded = true;
    this.seed = 11;
    this.start();
    const at: Record<string, number> = {
      hall: PLAYER_VIEW_X,
      gates: SEGMENTS[1]!.start + 80,
      exit: SEGMENTS[0]!.end - 110,
      bridge: SEGMENTS[2]!.start + 180,
      join: SEGMENTS[2]!.end - 110,
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
      show("staff", 120);
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
    this.viewLift = 0;
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
    this.playTime = 0;
    this.safeUntil = 0;
    this.permitUntil = 0;
    this.seatSafeUntil = 0;
    this.noDoubleUntil = 0;
    this.toldSafe = false;
    this.toldLock = false;
    this.immune.clear();
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
    const v = computeView(w, h, window.devicePixelRatio || 1, safeTop, safeBottom, coarse);
    const root = document.documentElement;
    root.dataset.layout = v.coarse && h <= 520 && w > h ? "land" : v.coarse || w < 760 ? "phone" : "desk";
    root.style.setProperty("--hud-h", `${v.hudCss}px`);
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
    if (this.phase !== "run") return;
    if (this.player.duckHeld && this.player.grounded) return;
    if (this.player.holdJump(this.canDouble())) this.onJumped(this.player.jumps === 1 ? 2 : 1);
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
      this.frameDt = 0;
      this.draw();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    let raw = (stamp - this.last) / 1000;
    this.last = stamp;
    if (this.paused || this.frozen) {
      this.acc = 0;
      this.frameDt = 0;
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
    this.frameDt = raw;
    this.settleLift();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number) {
    if (this.paused) return;
    if (this.phase === "run") this.tick(dt);
    else if (this.phase === "seat") this.tickSeat(dt);
    else if (this.phase === "dead" && this.time - this.deadAt > 0.55) this.finish();
    if (this.phase !== "idle" && this.phase !== "over") this.time += dt;
    this.floaters = this.floaters.filter((f) => this.time - f.t0 < f.life);
  }

  private px() {
    return this.distance;
  }

  private canDouble() {
    return this.playTime >= this.noDoubleUntil;
  }

  private shielded() {
    return this.board !== null || this.time < this.safeUntil || this.playTime < this.permitUntil || this.playTime < this.seatSafeUntil;
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
    if (!(this.player.duckHeld && this.player.grounded)) {
      const before = this.player.jumps;
      if (this.player.consumeJump(this.canDouble())) this.onJumped(before);
    }

    if (this.board) {
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
      this.playTime += dt;
      this.noteBuffs();
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
    return multiplier(this.playTime < this.doubleUntil);
  }

  private noteBuffs() {
    if (!this.toldSafe && this.seatSafeUntil > 0 && this.playTime >= this.seatSafeUntil) {
      this.toldSafe = true;
      this.setBanner(["无敌结束", ""], 1.2);
    }
    if (!this.toldLock && this.noDoubleUntil > 0 && this.playTime >= this.noDoubleUntil) {
      this.toldLock = true;
      this.setBanner(["二段跳已恢复", ""], 1.2);
    }
  }

  private make(kind: Kind, x: number, y: number, phase = 0): Entity {
    return { kind, x, y, phase, travel: phase * 24 };
  }

  private boardDur() {
    if (this.reduced) return { close: 0.16, hold: 0.08, open: 0.2 };
    return { close: 0.62, hold: 0.34, open: 0.78 };
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
      this.setBanner([UI.dayStart(day), BORDER[0]!.en], 3.2);
      this.safeUntil = Math.max(this.safeUntil, this.time + SAFE_AFTER_DOOR);
      this.seatSafeUntil = 0;
      this.noDoubleUntil = 0;
      this.clearAhead();
      this.sfx.card();
      return;
    }
    if (i > 0) {
      if (!this.board && this.playTime >= this.seatSafeUntil && this.playTime >= this.noDoubleUntil && ((i === 2 && !this.seatSeen) || (i > 2 && this.rng() < 0.3))) {
        this.beginSeat();
      }
    }
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
        this.seatHold = 0.8;
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
      this.seatSafeUntil = this.playTime + SEAT_WIN_SEC;
      this.toldSafe = false;
    } else {
      this.noDoubleUntil = this.playTime + SEAT_LOSE_SEC;
      this.toldLock = false;
      this.entities = this.entities.filter((e) => {
        if (PICKUPS.has(e.kind) || e.x < px) return true;
        if (e.x > px + 180) return true;
        return canClear(e.kind, Math.max(SPEED_EASE, this.speed), false);
      });
      this.nextSpawn = Math.max(this.nextSpawn, px + 160);
    }
    this.safeUntil = Math.max(this.safeUntil, this.time + 0.6);
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
      if (inSafeJoin(x)) {
        this.nextSpawn = x + 80;
        continue;
      }
      if (segmentAt(x).id === "train") {
        /* 低牌不进车厢 */
      }
      const speedThere = Math.max(SPEED_EASE, speedAt(x, Math.max(this.runTime, 0.2)));
      const allowDouble = this.canDouble();
      const early = this.runTime < RAMP_SECONDS;
      const progress = progressOf(x);
      if (!early && allowDouble && progress > 0.18 && this.rng() < 0.08 + progress * 0.16) {
        const count = progress > 0.42 && kidFileClear(3, speedThere) && this.rng() < 0.6 ? 3 : 2;
        if (kidFileClear(count, speedThere) && !inSafeJoin(x + 24)) {
          const step = 11;
          const phase = this.rng();
          for (let i = 0; i < count; i++) this.entities.push(this.make("kid", x + i * step, 0, phase + i * 0.17));
          const covered = (count - 1) * step + spanOf("kid");
          this.nextSpawn = x + speedThere * gapSeconds(progress, this.rng()) + covered;
          continue;
        }
      }
      let kind = pickKind(x, this.rng, x > OVERHEAD_FROM);
      let tries = 0;
      while (tries++ < 8 && this.blocked(kind, speedThere, allowDouble, early)) {
        kind = pickKind(x, this.rng, x > OVERHEAD_FROM);
      }
      if (segmentAt(x).id === "train" && kind === "sign") kind = "walker";
      if (this.blocked(kind, speedThere, allowDouble, early)) kind = "walker";
      const phase = this.rng();
      this.entities.push(this.make(kind, x, OVERHEAD.has(kind) ? OVERHEAD_Y : 0, phase));

      const gap = speedThere * gapSeconds(progress, this.rng()) + spanOf(kind);
      const r = this.rng();
      const mid = x + gap * 0.42;
      if (r < 0.48 - progress * 0.12) {
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
    for (const e of this.immune) {
      const b = hitBox(e);
      if (!this.entities.includes(e) || !b || !overlaps(pb, b)) this.immune.delete(e);
    }
    const safe = this.shielded();
    for (const e of this.entities) {
      const b = hitBox(e);
      if (!b || !overlaps(pb, b)) continue;
      if (PICKUPS.has(e.kind)) {
        this.collect(e);
        continue;
      }
      if (safe || this.immune.has(e)) {
        this.immune.add(e);
        continue;
      }
      this.die(e);
      return;
    }
  }

  private collect(e: Entity) {
    e.taken = true;
    const m = this.mult();
    const at = { x: e.x, h: e.y + 36, t0: this.time, life: 1.35, big: true };
    if (e.kind === "water") {
      this.waters += bottlesGained();
      const gained = pickupPoints(WATER_POINT, m);
      this.score += gained;
      this.sfx.water();
      this.floaters.push({ ...at, text: "大水 +1" });
    } else if (e.kind === "octopus") {
      const gained = pickupPoints(OCTOPUS_POINT, m);
      this.score += gained;
      this.sfx.card();
      this.floaters.push({ ...at, text: `八达通 +${gained}` });
    } else if (e.kind === "permit") {
      this.permitUntil = this.playTime + 4;
      this.sfx.card();
      this.floaters.push({ ...at, text: "通行证" });
    } else if (e.kind === "concession") {
      this.doubleUntil = this.playTime + 8;
      this.sfx.card();
      this.floaters.push({ ...at, text: "特惠 ×2" });
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
    const saved = commitRun(score, px, place.simp, dayOf(px), legacyProgress);
    const isNew = !prev || score > prev.bestScore;
    const best = saved.bestScore;
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

  private settleLift() {
    if (this.frameDt <= 0 || this.paused || this.frozen) return;
    const head = this.v.G - this.player.h - 36;
    const targetLift = this.phase === "seat" ? 0 : Math.max(0, 10 - head);
    const blend = 1 - Math.exp(-this.frameDt * 12);
    this.viewLift += (targetLift - this.viewLift) * blend;
    if (Math.abs(targetLift - this.viewLift) < 0.04) this.viewLift = targetLift;
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

    const lift = this.viewLift;
    const liftPx = lift * v.pd;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#E6E2DA";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const groundPx = v.offsetY + liftPx + v.G * v.pd;
    ctx.fillStyle = "#D2CDC4";
    ctx.fillRect(0, groundPx, this.canvas.width, Math.max(0, this.canvas.height - groundPx));
    ctx.beginPath();
    ctx.rect(v.offsetX, v.offsetY, v.W * v.pd, v.H * v.pd);
    ctx.clip();
    ctx.setTransform(v.pd, 0, 0, v.pd, v.offsetX, v.offsetY + liftPx);
    ctx.fillStyle = "#E6E2DA";
    ctx.fillRect(-8, -72, v.W + 16, 72);
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
    if (e.kind === "gate") {
      drawObstacleGate(ctx, sx, v.G - e.y);
      return;
    }
    const moving = walkSpeed(e.kind) > 0 && !this.board;
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
    const w = 56;
    const h = 16;
    const left = Math.round(sx - w / 2);
    const top = Math.round(boardBottom - h);
    ctx.fillStyle = "#5C6A74";
    ctx.fillRect(Math.round(sx) - 1, v.T + 2, 2, Math.max(0, top - v.T - 2));
    ctx.fillStyle = tokens.yellow;
    ctx.fillRect(left - 2, top - 2, w + 4, h + 4);
    ctx.fillStyle = "#1E4E8C";
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = "#F7F7F7";
    ctx.font = `700 8px ${fontSC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("请勿逗留", Math.round(sx), top + h / 2);
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
    if (this.playTime < this.seatSafeUntil || this.playTime < this.permitUntil) {
      this.ctx.strokeStyle = tokens.line;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(v.playerX - 12, v.G - p.h - 34, 24, 36);
    }
  }

  private drawSeatScene() {
    const v = this.v;
    const ctx = this.ctx;
    const seat = this.seat;
    if (!seat) return;
    const cx = Math.round(v.W * 0.58);
    const frame = Math.floor(this.time * 8);
    ctx.fillStyle = "#D7DCE1";
    ctx.fillRect(cx - 10, v.G - 16, 18, 6);
    ctx.fillStyle = "#8E979E";
    ctx.fillRect(cx - 10, v.G - 20, 18, 4);
    if (seat.done && seat.won) {
      drawAnchored(ctx, playerSprite("idle", 0), cx - 28, v.G);
      drawAnchored(ctx, actorFrame("elder", 0, "idle"), cx + 24, v.G, true);
    } else if (seat.done) {
      drawAnchored(ctx, actorFrame("elder", 0, "idle"), cx - 8, v.G, true);
      drawAnchored(ctx, playerSprite("idle", 0), cx - 36, v.G);
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
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floaters) {
      const t = Math.max(0, Math.min(1, (this.time - f.t0) / f.life));
      const x = Math.round(f.x - this.cam);
      const y = Math.round(v.G - f.h - t * 16);
      ctx.globalAlpha = 1 - t * t;
      ctx.font = f.big ? `700 12px ${fontSC}` : `700 8px ${fontSC}`;
      const w = ctx.measureText(f.text).width;
      ctx.fillStyle = "#1E4E8C";
      ctx.fillRect(x - w / 2 - 4, y - 8, w + 8, 16);
      ctx.fillStyle = "#F7F7F7";
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  private hudModel() {
    const px = this.px();
    const place = placeAt(px);
    const chips: Chip[] = [];
    const remain = (until: number) => Math.max(0, until - this.playTime);
    const seatLeft = remain(this.seatSafeUntil);
    const lockLeft = remain(this.noDoubleUntil);
    const permitLeft = remain(this.permitUntil);
    const dealLeft = remain(this.doubleUntil);
    if (lockLeft > 0) chips.push({ text: `无法二段跳 ${lockLeft.toFixed(1)}秒`, color: tokens.alert });
    if (seatLeft > 0) chips.push({ text: `无敌 ${seatLeft.toFixed(1)}秒`, color: tokens.line });
    if (permitLeft > 0) chips.push({ text: `通行证 ${permitLeft.toFixed(1)}秒`, color: tokens.permit });
    if (dealLeft > 0) chips.push({ text: `特惠 ×2 ${dealLeft.toFixed(1)}秒`, color: tokens.yellow });
    const doorBlink = false;
    const onTrain = stationIndexAt(px) >= 0;
    const mode: "port" | "platform" | "train" = onTrain ? "train" : segmentAt(px).id === "platform" ? "platform" : "port";
    return {
      mode,
      node: nodeIndexAt(px),
      placeTrad: place.trad,
      placeSimp: place.simp,
      placeEn: place.en,
      score: finalScore(this.score),
      hi: Math.max(this.hi, this.score),
      waters: this.waters,
      day: dayOf(px),
      attempt: this.attempt,
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
    isNew,
    best,
  };
}

