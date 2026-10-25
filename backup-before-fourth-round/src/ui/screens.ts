import { UI } from "../data/copy";
import type { RunResult } from "../game/engine";
import { showBedroom } from "../render/bedroom";

type Sound = { label: () => string; toggle: () => void };

export function showHome(
  overlay: HTMLElement,
  onStart: () => void,
  sound: Sound,
  audio: { resume: () => void; alarm: () => void },
) {
  showBedroom(overlay, audio, () => {
    overlay.classList.remove("on");
    overlay.replaceChildren();
    onStart();
  }, sound);
}

export function showResult(overlay: HTMLElement, r: RunResult, onAgain: () => void) {
  const score = h("p", "result-score", `${r.score} 分`);
  const title = h("p", "result-title", r.title);
  const waters = h("p", "result-line", `收集了 ${r.waters} 瓶大水`);
  const money = h("p", "result-line", `游戏换算 HK$${r.hkd}`);
  const note = h("p", "result-note", "1分 = HK$0.3，四舍五入");
  const again = h("button", "exit", "重新开始");
  again.setAttribute("type", "button");
  again.addEventListener("click", () => {
    overlay.classList.remove("on");
    overlay.replaceChildren();
    onAgain();
  });
  const col = h("div", "col result-col");
  col.append(score, title, waters, money, note, again);
  const screen = h("main", "screen result");
  screen.append(col);
  overlay.replaceChildren(screen);
  overlay.classList.add("on");
  overlay.scrollTop = 0;
  again.focus();
}

function h(tag: string, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
