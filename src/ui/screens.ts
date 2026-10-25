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
  card.dataset.archetype = achievement.icon;
  const title = h("h1", "fail-title", achievement.name);
  const emblem = h("div", "emblem");
  emblem.setAttribute("aria-hidden", "true");
  // Small original pixel symbols, not a font-dependent emoji or external asset.
  const marks: Record<string, string[]> = {
    ticket: ["1111111", "1010101", "1111111", "1000001", "1111111"],
    route: ["1100011", "0100010", "0111110", "0001000", "0011100"],
    city: ["0010100", "1010101", "1110111", "1010101", "1111111"],
    water: ["0011100", "0001000", "0011100", "0100010", "0111110", "0100010", "0111110"],
    power: ["1000001", "1100011", "1111111", "1100011", "1000001"],
    clock: ["0011100", "0100010", "1001001", "1001101", "1000001", "0100010", "0011100"],
  };
  for (const row of marks[achievement.icon]!) {
    const line = h("div", "emblem-row");
    for (const pixel of row) line.append(h("i", pixel === "1" ? "lit" : ""));
    emblem.append(line);
  }
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
    h("p", "fail-kicker", "通勤结束 / END OF RUN"),
    score,
    h("p", "fail-best", `最高纪录 ${r.best} 分`),
    emblem,
    h("p", "fail-label", "荣获成就"),
    title,
    h("p", "personality", achievement.type),
    h("p", "fail-quote", achievement.quote),
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
