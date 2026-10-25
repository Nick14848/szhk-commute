import { HURT, PHYS } from "./balance";
import type { Box } from "./entities";

export type Pose = "idle" | "run" | "jump" | "land" | "duck" | "sit" | "dead";

/** 高度 h 是脚离地距离，向上为正。 */
export class Player {
  h = 0;
  vy = 0;
  jumps = 2;
  duckHeld = false;
  pose: Pose = "run";
  private coyote = 0;
  private buffer = 0;
  private travel = 0;
  private landFor = 0;

  reset() {
    this.h = 0;
    this.vy = 0;
    this.jumps = 2;
    this.duckHeld = false;
    this.pose = "idle";
    this.coyote = 0;
    this.buffer = 0;
    this.travel = 0;
    this.landFor = 0;
  }

  get grounded() {
    return this.h <= 0;
  }

  /** 按下跳跃。落地前的短窗口里也会记住这一下。 */
  holdJump(allowDouble: boolean) {
    this.buffer = PHYS.buffer;
    return this.consumeJump(allowDouble);
  }

  tickBuffer(dt: number) {
    if (this.buffer > 0) this.buffer = Math.max(0, this.buffer - dt);
  }

  consumeJump(allowDouble: boolean) {
    if (this.buffer <= 0) return false;
    const ok = this.jump(allowDouble);
    if (ok) this.buffer = 0;
    return ok;
  }

  jump(allowDouble: boolean): boolean {
    if (this.grounded || this.coyote > 0) {
      this.vy = PHYS.jump;
      this.h = Math.max(this.h, 0.01);
      this.jumps = 1;
      this.coyote = 0;
      return true;
    }
    if (allowDouble && this.jumps > 0) {
      this.vy = PHYS.jump2;
      this.jumps = 0;
      return true;
    }
    return false;
  }

  /** moved 是这一步脚下实际挪过的世界距离，用来踩跑步帧。 */
  update(dt: number, moved: number) {
    const wasAir = this.h > 0;
    if (!this.grounded) {
      const g = PHYS.gravity * (this.duckHeld && this.vy < 120 ? PHYS.fastFall : 1);
      this.vy -= g * dt;
      this.h += this.vy * dt;
      if (this.h <= 0) {
        this.h = 0;
        this.vy = 0;
        this.jumps = 2;
        this.coyote = PHYS.coyote;
      }
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }
    this.travel += Math.max(0, moved);
    if (this.landFor > 0) this.landFor -= dt;
    if (wasAir && this.h <= 0) this.landFor = 0.12;
    if (!this.grounded) this.pose = "jump";
    else if (this.duckHeld) this.pose = "duck";
    else if (this.landFor > 0) this.pose = "land";
    else this.pose = "run";
  }

  get frame() {
    return Math.floor(this.travel / 11);
  }

  /** px 是身体中心的世界坐标。框的尺寸来自 HURT，不读精灵高宽。 */
  box(px: number): Box {
    if (this.pose === "duck") {
      return { x0: px - HURT.duckBack, x1: px + HURT.duckFront, y0: 0, y1: HURT.duckTop };
    }
    return {
      x0: px - HURT.playerHalf,
      x1: px + HURT.playerHalf,
      y0: this.h,
      y1: this.h + HURT.standTop,
    };
  }
}
