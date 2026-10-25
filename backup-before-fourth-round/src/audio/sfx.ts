export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ac() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ac();
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ) {
    if (this.muted) return;
    const ctx = this.ac();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    amp.gain.setValueAtTime(gain, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  jump() {
    const t = this.ac().currentTime;
    this.tone(520, t, 0.07, "square", 0.04);
  }

  water() {
    const t = this.ac().currentTime;
    this.tone(880, t, 0.06, "sine", 0.05);
    this.tone(1320, t + 0.04, 0.08, "sine", 0.04);
  }

  card() {
    const t = this.ac().currentTime;
    this.tone(988, t, 0.09, "sine", 0.06);
  }

  cardFail() {
    const t = this.ac().currentTime;
    this.tone(220, t, 0.1, "square", 0.04);
    this.tone(180, t + 0.12, 0.14, "square", 0.04);
  }

  /** 闹钟。短合成音，不是录音。 */
  alarm() {
    const t = this.ac().currentTime;
    this.tone(880, t, 0.08, "square", 0.05);
    this.tone(880, t + 0.14, 0.08, "square", 0.05);
    this.tone(660, t + 0.3, 0.1, "square", 0.04);
  }

  /** 三声短鸣，不是港铁录音。 */
  doors() {
    const t = this.ac().currentTime;
    this.tone(1175, t, 0.08, "sine", 0.05);
    this.tone(1175, t + 0.16, 0.08, "sine", 0.05);
    this.tone(1175, t + 0.32, 0.08, "sine", 0.05);
  }

  hit() {
    if (this.muted) return;
    const ctx = this.ac();
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    src.buffer = buffer;
    amp.gain.setValueAtTime(0.2, t);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    src.start(t);
  }

  stamp() {
    const t = this.ac().currentTime;
    this.tone(140, t, 0.12, "triangle", 0.06);
  }
}
