import { BORDER, STATIONS } from "../data/copy";
import type { HudModel } from "../render/hud";

let userLock = false;
let lastNode = -1;
let lastMode = "";
let lastRailW = -1;
let built = false;
let sizeDirty = true;
let lastPaint = "";

function text(id: string, value: string) {
  const el = document.getElementById(id);
  if (el && el.textContent !== value) el.textContent = value;
}

export function bindRoute(rail: HTMLElement) {
  new ResizeObserver(() => { sizeDirty = true; }).observe(rail);
  rail.addEventListener("pointerdown", (event) => {
    userLock = true;
    event.stopPropagation();
  });
  rail.addEventListener("wheel", () => {
    userLock = true;
  }, { passive: true });
  rail.addEventListener("scroll", () => fitRail(rail), { passive: true });
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
  const paintKey = `${model.mode}/${model.node}/${model.day}/${model.waters}/${Math.floor(model.score)}/${model.chips.map((c) => c.text).join("|")}/${model.banner?.join("|") ?? ""}`;
  if (paintKey === lastPaint && !sizeDirty) return;
  lastPaint = paintKey;
  const hud = document.getElementById("hud");
  const rail = document.getElementById("rail");
  const border = document.getElementById("border-row");
  const banner = document.getElementById("banner");
  const status = document.getElementById("status");
  if (!hud || !rail || !border || !banner || !status) return;

  hud.dataset.mode = model.mode;
  text("waters", String(model.waters));
  text("day-label", `第 ${model.day} 天`);
  const score = Math.max(0, Math.floor(model.score));
  text("score", score > 99999 ? String(score) : String(score).padStart(5, "0"));
  text("place-name", model.placeSimp);

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
  const railW = sizeDirty ? Math.round(rail.clientWidth) : lastRailW;
  sizeDirty = false;
  const widthChanged = railW !== lastRailW;
  if (widthChanged) {
    userLock = false;
    lastRailW = railW;
  }
  const routeDirty = model.node !== lastNode || model.mode !== lastMode || widthChanged;
  if (routeDirty) {
    if (model.node !== lastNode || model.mode !== lastMode) userLock = false;
    lastNode = model.node;
    lastMode = model.mode;
    const focus = rails[current];
    if (focus && model.mode === "train" && !userLock) {
      if (rail.scrollWidth > rail.clientWidth + 1) {
        const railBox = rail.getBoundingClientRect();
        const box = focus.getBoundingClientRect();
        rail.scrollLeft += box.left + box.width / 2 - (railBox.left + railBox.width / 2);
      } else {
        rail.scrollLeft = 0;
      }
    }
    if (model.mode !== "train") rail.scrollLeft = 0;
    paintMap(model);
  }
  if (routeDirty) fitRail(rail);

  const lines = [model.chips.slice(0, 2), model.chips.slice(2, 4)]
    .map((row) => row.map((c) => c.text).join("  ·  "))
    .filter((row) => row.length > 0);
  text("status", lines[0] ?? "");
  const bannerText = lines.length > 1 ? lines[1]! : lines.length === 0 && model.banner ? model.banner[0] : "";
  text("banner", bannerText);
}

function fitRail(rail: HTMLElement) {
  const railBox = rail.getBoundingClientRect();
  if (railBox.width < 8) return;
  for (const el of rail.querySelectorAll<HTMLElement>(".rail-stop")) {
    const box = el.getBoundingClientRect();
    const full = box.left >= railBox.left - 1 && box.right <= railBox.right + 1;
    el.classList.toggle("clip", !full);
  }
}

function paintMap(model: HudModel) {
  const host = document.getElementById("full-map");
  if (!host) return;
  const stationId = model.mode === "train" ? STATIONS[model.node - BORDER.length]?.id ?? "" : "";
  const passed = model.mode === "train" ? model.node - BORDER.length : -1;
  host.dataset.future = model.mode === "train" ? "0" : "1";
  const phase = document.getElementById("pause-phase");
  if (phase) phase.textContent = "東鐵綫 · 往金鐘";
  host.querySelectorAll<HTMLElement>("[data-stop]").forEach((el) => {
    const id = el.dataset.stop ?? "";
    const idx = STATIONS.findIndex((st) => st.id === id);
    el.classList.toggle("now", id === stationId);
    el.classList.toggle("done", idx >= 0 && passed > idx);
  });
}

export function fillFullMap(host: HTMLElement) {
  host.replaceChildren();
  const phase = document.createElement("p");
  phase.id = "pause-phase";
  phase.className = "pause-phase";
  const list = document.createElement("ol");
  list.className = "pause-line";
  for (const st of STATIONS) {
    const li = document.createElement("li");
    li.className = "pause-stop";
    li.dataset.stop = st.id;
    const zh = document.createElement("b");
    zh.textContent = st.trad;
    const en = document.createElement("small");
    en.textContent = st.en;
    li.append(zh, en);
    list.append(li);
  }
  host.append(phase, list);
}
