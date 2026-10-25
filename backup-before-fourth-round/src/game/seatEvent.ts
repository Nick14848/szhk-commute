export const SEAT_SECONDS = 2.2;

export class SeatEvent {
  elapsed = 0;
  player = 0;
  grandma = 0;
  done = false;
  won = false;
  private readonly rate: number;

  constructor(rng: () => number) {
    this.rate = 0.38 + rng() * 0.06;
  }

  tap() {
    if (this.done) return;
    this.player = Math.min(1, this.player + 0.09);
  }

  update(dt: number) {
    if (this.done) return;
    this.elapsed += dt;
    this.grandma = Math.min(1, this.grandma + this.rate * dt);
    if (this.player >= 1 || this.elapsed >= SEAT_SECONDS) {
      this.done = true;
      this.won = this.player > this.grandma;
    }
  }
}
