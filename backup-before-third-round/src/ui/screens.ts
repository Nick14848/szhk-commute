import { UI, loadSave, punchline } from "../data/copy";
import { tokens } from "../design/tokens";
import type { RunResult } from "../game/engine";
import { SPR, actorFrame, drawAnchored, playerSprite } from "../render/sprites";
import { posterDataUrl } from "./shareCard";

type Sound = { label: () => string; toggle: () => void };

export function showHome(overlay: HTMLElement, onStart: () => void, sound: Sound) {
  const save = loadSave();
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  const sign = h("div", "sign");
  const body = h("div", "sign-body");
  body.append(
    h("h1", "", UI.titleTrad),
    h("p", "sign-en", UI.titleEn),
    h("p", "sign-by", UI.by),
  );
  sign.append(body, h("div", "sign-bar"));

  const start = h("button", "exit");
  start.setAttribute("type", "button");
  start.append(UI.start, h("span", "chev"));
  start.addEventListener("click", () => {
    close(overlay, onStart);
  });

  const record = h("p", "meta", save ? UI.best(save.bestScore, save.bestStation) : UI.noRecord);
  const hint = h("p", "meta", coarse ? UI.hintTouch : UI.hintKeys);

  const col = h("div", "col");
  const lede = h("p", "lede");
  const comma = UI.lede.indexOf("，");
  if (comma > 0) {
    lede.append(UI.lede.slice(0, comma + 1), document.createElement("br"), UI.lede.slice(comma + 1));
  } else {
    lede.textContent = UI.lede;
  }
  col.append(sign, heroScene(), lede, start, record, hint, soundLink(sound));
  open(overlay, "home", col);
  if (!coarse) start.focus();
}

export function showResult(overlay: HTMLElement, r: RunResult, onAgain: () => void, sound: Sound) {
  const reader = h("section", "reader");
  const top = h("div", "reader-top");
  top.append(h("span", "", UI.gateOut), h("span", "", "EXIT"));
  const lcd = h("div", "lcd");
  const label = h("div", "lcd-label", UI.remaining);
  label.append(h("span", "", UI.remainingEn));
  const meta = h("div", "lcd-meta");
  meta.append(
    h("span", "", `${UI.waters} ${String(r.waters).padStart(2, "0")}`),
    h("span", "", `${UI.day(r.day)} · ${r.station}`),
  );
  lcd.append(label, h("div", "lcd-money", `HK$${r.hkd}.0`), meta);
  reader.append(top, lcd);

  const hit = h("p", "hit");
  hit.append(h("span", "", UI.hitBy), r.quote);

  const rankRow = h("div", "rank-row");
  rankRow.append(h("p", r.certified ? "rank hot" : "rank", r.title));
  if (r.certified) rankRow.append(h("span", "badge red", UI.certified));
  if (r.isNew) rankRow.append(h("span", "badge", UI.newRecord));

  const punch = h("p", "punch", `${punchline(r.score)} 本次 ${r.score} 分，最高 ${r.best} 分。`);

  const again = h("button", "exit", UI.again);
  again.setAttribute("type", "button");
  again.addEventListener("click", () => {
    close(overlay, onAgain);
  });
  const save = h("button", "ghost", UI.save) as HTMLButtonElement;
  save.type = "button";
  save.disabled = true;
  const actions = h("div", "actions");
  actions.append(again, save);

  const poster = h("figure", "poster");
  const img = document.createElement("img");
  img.alt = `通勤纪录：${r.stationTrad}，${r.title}，HK$${r.hkd}`;
  const caption = h("figcaption", "", UI.posterBusy);
  poster.append(img, caption);

  const col = h("div", "col");
  col.append(reader, hit, rankRow, punch, actions, poster, soundLink(sound));
  open(overlay, "result", col);
  overlay.scrollTop = 0;
  if (!window.matchMedia("(pointer: coarse)").matches) again.focus();

  posterDataUrl(r)
    .then((url) => {
      img.src = url;
      save.disabled = false;
      caption.textContent = UI.pressSave;
      save.addEventListener("click", () => {
        void savePoster(url).then((status) => {
          caption.textContent = status === "cancel" ? UI.shareCancel : status === "fail" ? UI.posterFail : UI.pressSave;
        });
      });
    })
    .catch(() => {
      caption.textContent = UI.posterFail;
    });
}

async function savePoster(url: string): Promise<"ok" | "cancel" | "fail"> {
  const name = "深港通勤纪录.png";
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "ok";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancel";
  }
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    return "ok";
  } catch {
    return "fail";
  }
}

function soundLink(sound: Sound) {
  const b = h("button", "link", sound.label()) as HTMLButtonElement;
  b.type = "button";
  b.addEventListener("click", () => {
    sound.toggle();
    b.textContent = sound.label();
  });
  return b;
}

let closing = false;

/** 主页上的一小段跑和跳。画布按整数倍显示，不拉到整列宽度。 */
function heroScene() {
  const scale = 2;
  const W = 150;
  const H = 64;
  const c = document.createElement("canvas");
  c.width = W * scale;
  c.height = H * scale;
  c.style.width = `${W * scale}px`;
  c.style.height = `${H * scale}px`;
  c.className = "hero";
  c.setAttribute("aria-hidden", "true");
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const ground = H - 8;
  let frame = 0;
  const draw = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = tokens.page;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#E4D8C8";
    ctx.fillRect(0, ground - 18, W, 18);
    ctx.fillStyle = tokens.ink;
    ctx.fillRect(0, ground, W, 1);
    const cycle = frame % 9;
    const vy = cycle === 6 ? 120 : cycle === 7 ? 0 : -80;
    const player = cycle < 6 ? playerSprite("run", cycle) : playerSprite("jump", cycle - 6, vy);
    drawAnchored(ctx, player, 28, ground);
    drawAnchored(ctx, SPR.water, 70, ground);
    drawAnchored(ctx, actorFrame("mask", frame), 96, ground);
    drawAnchored(ctx, actorFrame("inspector", frame + 2), 124, ground);
    frame += 1;
  };
  draw();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    const timer = window.setInterval(draw, 110);
    c.dataset.timer = String(timer);
  }
  return c;
}

function open(overlay: HTMLElement, kind: string, col: HTMLElement) {
  const screen = h("main", `screen ${kind}`);
  screen.append(col);
  overlay.replaceChildren(screen);
  overlay.classList.add("on");
}

function close(overlay: HTMLElement, done?: () => void) {
  if (closing) return;
  const screen = overlay.querySelector(".screen");
  const hero = overlay.querySelector<HTMLCanvasElement>("canvas.hero");
  if (hero?.dataset.timer) window.clearInterval(Number(hero.dataset.timer));
  if (!screen) {
    overlay.classList.remove("on");
    overlay.replaceChildren();
    done?.();
    return;
  }
  closing = true;
  screen.classList.add("leaving");
  window.setTimeout(() => {
    overlay.classList.remove("on");
    overlay.replaceChildren();
    closing = false;
    done?.();
  }, 280);
}

function h(tag: string, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
