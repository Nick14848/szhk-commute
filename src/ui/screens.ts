import { titleFor } from "../data/copy";
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
  const achievement = titleFor(r.score);
  const title = h("h1", "fail-title", achievement.name);
  const score = h("p", "fail-score");
  score.append(h("span", "", "本次深港通勤获得"), h("strong", "", String(r.score)), h("span", "", "分"));
  const again = h("button", "exit", "重新开始");
  again.setAttribute("type", "button");
  again.addEventListener("click", () => {
    overlay.classList.remove("on", "result-on");
    overlay.replaceChildren();
    onAgain();
  });
  card.append(
    h("p", "fail-kicker", "通勤结束"),
    score,
    h("p", "fail-best", `最高纪录 ${r.best} 分`),
    h("p", "fail-label", "荣获成就"),
    title,
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
