import { BORDER, BRANCHES, STATIONS } from "../data/copy";
import type { HudModel } from "../render/hud";

let userLock = false;
let lastNode = -1;

export function bindRoute(rail: HTMLElement) {
  const hold = () => {
    userLock = true;
  };
  rail.addEventListener("pointerdown", (event) => {
    hold();
    event.stopPropagation();
  });
  rail.addEventListener("wheel", () => {
    userLock = true;
  }, { passive: true });
}

export function updateRoute(model: HudModel) {
  const border = document.querySelector<HTMLElement>("#border-row");
  const rail = document.querySelector<HTMLElement>("#rail");
  const waters = document.querySelector<HTMLElement>("#waters");
  const day = document.querySelector<HTMLElement>("#day-label");
  const score = document.querySelector<HTMLElement>("#score");
  const banner = document.querySelector<HTMLElement>("#banner");
  if (!border || !rail || !waters || !day || !score || !banner) return;

  waters.textContent = `大水 ${model.waters}`;
  day.textContent = `第 ${model.day} 天`;
  score.textContent = `${String(Math.floor(model.score)).padStart(5, "0")}`;

  const onTrain = model.node >= BORDER.length;
  border.replaceChildren(
    ...BORDER.map((place, i) => {
      const el = document.createElement("span");
      el.className = "border-stop" + (!onTrain && i === model.node ? " now" : i < model.node ? " done" : "");
      el.textContent = place.trad;
      return el;
    }),
  );

  if (rail.childElementCount !== STATIONS.length) {
    rail.replaceChildren(
      ...STATIONS.map((st) => {
        const el = document.createElement("span");
        el.className = "rail-stop";
        el.dataset.id = st.id;
        const zh = document.createElement("b");
        zh.textContent = st.trad;
        const en = document.createElement("small");
        en.textContent = st.en;
        el.append(zh, en);
        return el;
      }),
    );
  }
  const stops = [...rail.querySelectorAll<HTMLElement>(".rail-stop")];
  const current = onTrain ? model.node - BORDER.length : -1;
  stops.forEach((el, i) => {
    el.classList.toggle("now", i === current);
    el.classList.toggle("done", current >= 0 && i < current);
  });
  if (model.node !== lastNode) {
    userLock = false;
    lastNode = model.node;
  }
  const focus = stops[current];
  if (focus && !userLock) {
    const left = focus.offsetLeft - rail.clientWidth / 2 + focus.clientWidth / 2;
    rail.scrollLeft = Math.max(0, left);
  }

  if (model.banner) {
    banner.hidden = false;
    banner.textContent = model.banner[1] ? `${model.banner[0]}  ${model.banner[1]}` : model.banner[0];
  } else if (model.chips.length) {
    banner.hidden = false;
    banner.textContent = model.chips.map((c) => c.text).join("  ·  ");
  } else {
    banner.hidden = true;
    banner.textContent = "";
  }
}

export function fillFullMap(host: HTMLElement) {
  host.replaceChildren();
  const title = document.createElement("p");
  title.className = "map-title";
  title.textContent = "東鐵綫  East Rail Line";
  host.append(title);
  const line = document.createElement("div");
  line.className = "map-line";
  for (const st of STATIONS) {
    const item = document.createElement("span");
    item.textContent = `${st.trad}  ${st.en}`;
    line.append(item);
    const branch = BRANCHES.find((b) => b.after === st.trad);
    if (branch) {
      const side = document.createElement("span");
      side.className = "map-branch";
      side.textContent = `${branch.trad}  ${branch.en} · 本次不经`;
      line.append(side);
    }
  }
  host.append(line);
}
