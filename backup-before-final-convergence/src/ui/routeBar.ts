import { BORDER, STATIONS } from "../data/copy";
import type { HudModel } from "../render/hud";

let userLock = false;
let lastNode = -1;
let lastMode = "";
let built = false;

function text(id: string, value: string) {
  const el = document.getElementById(id);
  if (el && el.textContent !== value) el.textContent = value;
}

export function bindRoute(rail: HTMLElement) {
  rail.addEventListener("pointerdown", (event) => {
    userLock = true;
    event.stopPropagation();
  });
  rail.addEventListener("wheel", () => {
    userLock = true;
  }, { passive: true });
  if (rail.childElementCount === STATIONS.length) return;
  rail.replaceChildren(
    ...STATIONS.map((st) => {
      const el = document.createElement("span");
      el.className = "rail-stop";
      const zh = document.createElement("b");
      zh.textContent = st.trad;
      const en = document.createElement("small");
      en.textContent = st.en;
      el.append(zh, en);
      return el;
    }),
  );
  const border = document.getElementById("border-row");
  if (border && !built) {
    const kids: HTMLElement[] = [];
    BORDER.forEach((place, i) => {
      const el = document.createElement("span");
      el.className = "border-stop";
      const dot = document.createElement("i");
      const label = document.createElement("b");
      label.textContent = place.trad;
      el.append(dot, label);
      kids.push(el);
      if (i < BORDER.length - 1) {
        const join = document.createElement("span");
        join.className = "border-join";
        kids.push(join);
      }
    });
    border.replaceChildren(...kids);
    built = true;
  }
}

export function updateRoute(model: HudModel) {
  const hud = document.getElementById("hud");
  const rail = document.getElementById("rail");
  const border = document.getElementById("border-row");
  const banner = document.getElementById("banner");
  const status = document.getElementById("status");
  if (!hud || !rail || !border || !banner || !status) return;

  hud.dataset.mode = model.mode;
  text("waters", `收集大水 ${model.waters}`);
  text("day-label", `第 ${model.attempt} 次`);
  text("score", String(Math.floor(model.score)).padStart(5, "0"));
  text("place-name", model.mode === "platform" ? "落馬洲站台 · 往金鐘" : model.placeTrad);

  const stops = [...border.querySelectorAll<HTMLElement>(".border-stop")];
  stops.forEach((el, i) => {
    el.classList.toggle("now", model.mode !== "train" && i === model.node);
    el.classList.toggle("done", model.mode === "train" || i < model.node);
  });

  const rails = [...rail.querySelectorAll<HTMLElement>(".rail-stop")];
  const current = model.mode === "train" ? model.node - BORDER.length : -1;
  rails.forEach((el, i) => {
    el.classList.toggle("now", i === current);
    el.classList.toggle("done", current >= 0 && i < current);
  });
  if (model.node !== lastNode || model.mode !== lastMode) {
    if (model.mode !== lastMode) userLock = false;
    lastNode = model.node;
    lastMode = model.mode;
    const focus = rails[current];
    if (focus && model.mode === "train" && !userLock) {
      rail.scrollLeft = current <= 0 ? 0 : Math.max(0, focus.offsetLeft - rail.offsetLeft - 12);
    }
    if (model.mode !== "train") rail.scrollLeft = 0;
  }

  const statusText = model.chips.map((c) => c.text).join("  ·  ");
  text("status", statusText);
  const bannerText = model.banner ? (model.banner[1] ? `${model.banner[0]}  ${model.banner[1]}` : model.banner[0]) : "";
  text("banner", bannerText);
  paintMap(model);
}

function paintMap(model: HudModel) {
  const stationId = model.mode === "train"
    ? STATIONS[model.node - BORDER.length]?.id ?? ""
    : model.mode === "platform" ? "lmc" : "";
  const passed = model.mode === "train" ? model.node - BORDER.length : -1;
  document.querySelectorAll<HTMLElement>("#full-map [data-stop]").forEach((el) => {
    const id = el.dataset.stop ?? "";
    const idx = STATIONS.findIndex((st) => st.id === id);
    el.classList.toggle("now", id === stationId);
    el.classList.toggle("done", idx >= 0 && passed > idx);
  });
}

const LINKS: Record<string, string[]> = {
  taiw: ["#8B5A2B"],
  kt: ["#7AC143"],
  hh: ["#8B5A2B"],
  adm: ["#E2231A", "#0077C8", "#F2C230"],
};

function stopLabel(id: string, zh: string, en: string, className: string) {
  const el = document.createElement("span");
  el.className = className;
  el.dataset.stop = id;
  const name = document.createElement("b");
  name.textContent = zh;
  const latin = document.createElement("small");
  latin.textContent = en;
  el.append(name, latin);
  return el;
}

export function fillFullMap(host: HTMLElement) {
  host.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "erl";
  const head = document.createElement("div");
  head.className = "erl-head";
  const title = document.createElement("b");
  title.textContent = "東鐵綫";
  const sub = document.createElement("small");
  sub.textContent = "East Rail Line";
  head.append(title, sub);
  const list = document.createElement("ol");
  list.className = "erl-list";
  const fork = document.createElement("li");
  fork.className = "erl-fork";
  fork.append(
    stopLabel("lowu", "羅湖", "Lo Wu", "erl-spur"),
    stopLabel("lmc", "落馬洲", "Lok Ma Chau", "erl-spur"),
  );
  list.append(fork);
  for (const st of STATIONS.slice(1)) {
    const li = document.createElement("li");
    li.className = "erl-stop";
    li.dataset.stop = st.id;
    const zh = document.createElement("b");
    zh.textContent = st.trad;
    const en = document.createElement("small");
    en.textContent = st.en;
    li.append(zh, en);
    const colors = LINKS[st.id];
    if (colors) {
      const pips = document.createElement("span");
      pips.className = "erl-pips";
      for (const color of colors) {
        const pip = document.createElement("i");
        pip.style.background = color;
        pips.append(pip);
      }
      li.append(pips);
    }
    if (st.id === "uni") li.append(stopLabel("rac", "馬場", "Racecourse", "erl-side"));
    list.append(li);
  }
  wrap.append(head, list);
  host.append(wrap);
}
