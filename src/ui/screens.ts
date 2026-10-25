import { TITLES } from "../data/copy";
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
    overlay.classList.remove("on", "result-on");
    overlay.replaceChildren();
    onStart();
  }, sound);
}

export function showResult(overlay: HTMLElement, r: RunResult, onAgain: () => void) {
  const card = h("div", "fail-card");
  const title = h("p", "fail-title", r.title);
  const list = h("ol", "achieve");
  for (const item of TITLES) {
    const li = h("li", item.name === r.title ? "got" : "");
    const next = TITLES[TITLES.indexOf(item) + 1];
    const range = next ? `${item.min}–${next.min - 1}` : `${item.min}+`;
    li.append(h("b", "", item.name), h("span", "", range));
    list.append(li);
  }
  const again = h("button", "exit", "重新开始");
  again.setAttribute("type", "button");
  again.addEventListener("click", () => {
    overlay.classList.remove("on", "result-on");
    overlay.replaceChildren();
    onAgain();
  });
  card.append(
    h("p", "fail-kicker", "通勤失败"),
    h("p", "fail-score", `本次深港通勤获得 ${r.score} 分`),
    h("p", "fail-best", `最高纪录 ${r.best} 分`),
    h("p", "fail-label", "荣获成就"),
    title,
    list,
    h("p", "fail-waters", `收集了 ${r.waters} 瓶大水`),
    again,
  );
  overlay.replaceChildren(card);
  overlay.classList.add("on", "result-on");
  again.focus();
}

function h(tag: string, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
