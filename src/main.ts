import "./style.css";
import { UI, loadMuted, writeMuted } from "./data/copy";
import { applyTokens } from "./design/tokens";
import { Game, sampleResult } from "./game/engine";
import { cancelBedroom } from "./render/bedroom";
import { atlasNudge, atlasPageNudge, atlasToggle } from "./render/sprites";
import { showHome, showResult } from "./ui/screens";
import { bindRoute, fillFullMap, updateRoute } from "./ui/routeBar";
import { suppressNativeSelection } from "./ui/nativeInput";

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
let keyboardDuck = false;

function syncChrome() {
  const state = game.uiState();
  const menu = overlay.classList.contains("on");
  const playing = (state.phase === "run" || state.phase === "seat") && !menu;
  hud.hidden = !playing;
  pad.hidden = !(playing && state.coarse && !state.paused);
  pauseBtn.hidden = !(playing && !state.paused);
  paused.hidden = !(state.paused && !menu);
  layoutNote.hidden = !(state.short && !menu);
  document.documentElement.dataset.play = playing ? "1" : "0";
  document.documentElement.dataset.paused = state.paused && !menu ? "1" : "0";
  const home = overlay.classList.contains("on") && !overlay.classList.contains("result-on");
  document.documentElement.dataset.menu = home ? "1" : "0";
  if (state.paused && !menu && document.activeElement === document.body) resumeBtn.focus();
}

game.onState = () => {
  const state = game.uiState();
  if (state.paused || state.phase === "dead" || state.phase === "over") {
    held.clear();
    keyboardDuck = false;
    game.clearInputs();
    syncHeld();
  }
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
  held.clear();
  keyboardDuck = false;
  syncHeld();
  game.start();
}

function syncHeld() {
  let duck = keyboardDuck;
  for (const kind of held.values()) if (kind === "duck") duck = true;
  game.setPadDuck(duck);
  duckBtn.classList.toggle("is-pressed", duck);
  duckBtn.setAttribute("aria-pressed", String(duck));
  jumpBtn.classList.toggle("is-pressed", [...held.values()].includes("jump"));
}

const restoreNativeInput = suppressNativeSelection(document.querySelector<HTMLElement>("#app")!, [pad, canvas]);

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
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat) return;
  keyboardDuck = true;
  syncHeld();
});
duckBtn.addEventListener("keyup", (event) => {
  if (event.key === "Enter" || event.key === " ") { keyboardDuck = false; syncHeld(); }
});
duckBtn.addEventListener("blur", () => { keyboardDuck = false; syncHeld(); });
jumpBtn.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat) return;
  game.press();
});

pauseBtn.addEventListener("click", () => game.pause());
resumeBtn.addEventListener("click", () => {
  game.resume();
  resumeBtn.blur();
  canvas.focus();
});
document.querySelector("#btn-restart")!.addEventListener("click", () => {
  held.clear();
  game.clearInputs();
  game.restart();
});
document.querySelectorAll<HTMLAnchorElement>("#credit a").forEach((link) => {
  link.addEventListener("click", () => {
    const phase = game.uiState().phase;
    if (phase === "run" || phase === "seat") game.pause();
  });
});

const onHide = () => {
  if (document.hidden) {
    held.clear();
    keyboardDuck = false;
    syncHeld();
    game.clearInputs();
    game.pause();
  }
};
const onBlur = () => {
  held.clear();
  keyboardDuck = false;
  syncHeld();
  game.clearInputs();
  game.pause();
};
const onError = (event: Event) => game.note((event as ErrorEvent).message);
const onReject = (event: PromiseRejectionEvent) => game.note(String(event.reason));
document.addEventListener("visibilitychange", onHide);
window.addEventListener("blur", onBlur);
window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onReject);

game.onResult = (r) => showResult(overlay, r, play);

const audio = {
  resume: () => game.audio.resume(),
  alarm: () => game.audio.alarm(),
};
const shot = debug ? params.get("shot") : null;
if (shot === "result") {
  const result = sampleResult();
  const score = Number(params.get("score"));
  if (params.has("score") && Number.isFinite(score) && score >= 0) {
    result.score = Math.floor(score);
    result.best = Math.max(result.best, result.score);
  }
  showResult(overlay, result, play);
}
else if (shot) game.loadShot(shot);
else if (debug && (params.has("auto") || params.has("smoke") || params.has("atlas"))) {
  /* 开发入口直接进游戏，不先盖一层首页 */
} else showHome(overlay, play, sound, audio);
document.documentElement.dataset.menu =
  overlay.classList.contains("on") && !overlay.classList.contains("result-on") ? "1" : "0";

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
    if (event.code === "BracketRight") atlasPageNudge(1);
    if (event.code === "BracketLeft") atlasPageNudge(-1);
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onReject);
    restoreNativeInput();
    cancelBedroom();
    game.dispose();
  });
}

if (import.meta.env.PROD) {
  void import("@vercel/analytics").then(({ inject }) => inject());
}
