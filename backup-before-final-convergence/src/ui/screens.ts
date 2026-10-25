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
  card.append(
    h("p", "fail-kicker", "通勤失败"),
    scoreLine(r),
    h("p", "fail-label", "荣获成就"),
  );
  const row = h("div", "fail-honor");
  const title = h("p", "fail-title", r.title);
  const list = h("ol", "achieve");
  for (const item of TITLES) {
    const li = h("li", item.name === r.title ? "got" : "");
    li.append(h("b", "", item.name), h("span", "", `${item.min} 分`));
    list.append(li);
  }
  const count = h("p", "achieve-count", `一共 ${TITLES.length} 个成就`);
  const side = h("div", "achieve-side");
  side.append(count, list);
  row.append(title, side);
  const waters = h("p", "fail-waters", `收集了 ${r.waters} 瓶大水`);
  const again = h("button", "exit", "重新开始");
  again.setAttribute("type", "button");
  again.addEventListener("click", () => {
    overlay.classList.remove("on", "result-on");
    overlay.replaceChildren();
    onAgain();
  });
  card.append(row, waters, again);
  overlay.replaceChildren(card);
  overlay.classList.add("on", "result-on");
  again.focus();
}

function scoreLine(r: RunResult) {
  const line = h("p", "fail-score");
  line.append(h("b", "", `本次获得 ${r.score} 分`), h("span", "", `最高纪录 ${r.best} 分`));
  return line;
}

function h(tag: string, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
