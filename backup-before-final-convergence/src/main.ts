import "./style.css";
import { UI, loadMuted, writeMuted } from "./data/copy";
import { applyTokens } from "./design/tokens";
import { Game, sampleResult } from "./game/engine";
import { cancelBedroom } from "./render/bedroom";
import { atlasNudge, atlasToggle } from "./render/sprites";
import { showHome, showResult } from "./ui/screens";
import { bindRoute, fillFullMap, updateRoute } from "./ui/routeBar";

applyTokens(document.documentElement);

const hud = document.querySelector<HTMLElement>("#hud")!;
const rail = document.querySelector<HTMLElement>("#rail")!;
bindRoute(rail);
fillFullMap(document.querySelector<HTMLElement>("#full-map")!);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;
const pad = document.querySelector<HTMLElement>("#pad")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#btn-pause")!;
const paused = document.querySelector<HTMLElement>("#paused")!;
const resumeBtn = document.querySelector<HTMLButtonElement>("#btn-resume")!;
const layoutNote = document.querySelector<HTMLElement>("#layout-note")!;
const jumpBtn = document.querySelector<HTMLButtonElement>("#btn-jump")!;
const duckBtn = document.querySelector<HTMLButtonElement>("#btn-duck")!;
const params = new URLSearchParams(location.search);
const dev = import.meta.env.DEV;
const debug = dev && params.has("debug");

const game = new Game(canvas);
game.audio.muted = loadMuted();

const held = new Map<number, "duck" | "jump">();

function syncChrome() {
  const state = game.uiState();
  const menu = overlay.classList.contains("on");
  const playing = (state.phase === "run" || state.phase === "seat") && !menu;
  hud.hidden = !playing;
  pad.hidden = !(playing && state.coarse && !state.paused);
  pauseBtn.hidden = !(playing && !state.paused);
  paused.hidden = !(state.paused && !menu);
  layoutNote.hidden = !(state.short && !menu);
  if (state.paused && !menu) resumeBtn.focus();
}

game.onState = () => {
  if (game.uiState().paused) held.clear();
  syncChrome();
};
game.onHud = updateRoute;
game.syncUi();

const sound = {
  label: () => (game.audio.muted ? UI.soundOff : UI.soundOn),
  toggle: () => {
    game.audio.muted = !game.audio.muted;
    writeMuted(game.audio.muted);
  },
};
game.onMuteKey = sound.toggle;

function play() {
  game.start();
}

function syncHeld() {
  let duck = false;
  for (const kind of held.values()) if (kind === "duck") duck = true;
  game.setPadDuck(duck);
}

function watchPointer(button: HTMLButtonElement, kind: "duck" | "jump") {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.setPointerCapture(event.pointerId);
    held.set(event.pointerId, kind);
    game.audio.resume();
    if (kind === "jump") game.press();
    syncHeld();
  });
  const release = (event: PointerEvent) => {
    held.delete(event.pointerId);
    syncHeld();
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

watchPointer(jumpBtn, "jump");
watchPointer(duckBtn, "duck");

duckBtn.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  game.setPadDuck(true);
});
duckBtn.addEventListener("keyup", (event) => {
  if (event.key === "Enter" || event.key === " ") game.setPadDuck(false);
});
jumpBtn.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  game.press();
});

pauseBtn.addEventListener("click", () => game.pause());
resumeBtn.addEventListener("click", () => game.resume());
document.querySelector("#btn-restart")!.addEventListener("click", () => {
  held.clear();
  game.clearInputs();
  game.restart();
});
new ResizeObserver(() => game.relayout()).observe(hud);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});
window.addEventListener("blur", () => {
  held.clear();
  game.clearInputs();
  game.pause();
});
window.addEventListener("error", (event) => game.note(event.message));
window.addEventListener("unhandledrejection", (event) => game.note(String(event.reason)));

game.onResult = (r) => showResult(overlay, r, play);

const audio = {
  resume: () => game.audio.resume(),
  alarm: () => game.audio.alarm(),
};
const shot = debug ? params.get("shot") : null;
if (shot === "result") showResult(overlay, sampleResult(), play);
else if (shot) game.loadShot(shot);
else if (debug && (params.has("auto") || params.has("smoke") || params.has("atlas"))) {
  /* 开发入口直接进游戏，不先盖一层首页 */
} else showHome(overlay, play, sound, audio);

if (debug) {
  const fast = params.has("fast") ? Number(params.get("fast")) : 1;
  game.setDebug(params.has("auto"), fast, params.has("smoke"), params.has("boxes"), params.has("atlas"));
  Object.assign(window, { __game: game });
  if (params.has("auto") || params.has("smoke")) play();
}

if (debug && params.has("atlas")) {
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      atlasToggle();
    }
    if (event.code === "ArrowRight") atlasNudge(1);
    if (event.code === "ArrowLeft") atlasNudge(-1);
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelBedroom();
    game.dispose();
  });
}

if (import.meta.env.PROD) {
  void import("@vercel/analytics").then(({ inject }) => inject());
}
