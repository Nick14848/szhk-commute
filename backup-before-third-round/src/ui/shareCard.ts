import QRCode from "qrcode";
import { UI, punchline } from "../data/copy";
import { fontLed, fontSC, fontTC, tokens } from "../design/tokens";
import type { RunResult } from "../game/engine";
import { SPR, type Sprite } from "../render/sprites";

const W = 900;
const H = 1240;
const L = 72;

export async function posterDataUrl(r: RunResult) {
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.scale(2, 2);
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = tokens.poster;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = tokens.inkDeep;
  frame(ctx, 28, 28, W - 56, H - 56, 2);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = tokens.inkDeep;
  ctx.font = `600 15px ${fontTC}`;
  tracked(ctx, "COMMUTE RECORD", L, 92, 3);
  ctx.font = `600 26px ${fontTC}`;
  ctx.fillText("深港通勤紀錄", L, 130);
  ctx.textAlign = "right";
  ctx.font = `500 18px ${fontSC}`;
  ctx.fillText(UI.by, W - L, 92);

  ctx.textAlign = "left";
  ctx.font = `600 84px ${fontTC}`;
  ctx.fillText(r.stationTrad, L, 262);
  ctx.font = `500 22px ${fontTC}`;
  tracked(ctx, r.stationEn.toUpperCase(), L, 302, 2);

  ctx.font = `500 20px ${fontSC}`;
  ctx.fillText(`${UI.day(r.day)}  ·  大水 ${r.waters} 瓶  ·  ${r.score} 分`, L, 360);

  ctx.font = `500 17px ${fontTC}`;
  ctx.fillText("餘額 REMAINING VALUE", L, 440);
  ctx.font = `700 64px ${fontLed}`;
  ctx.fillText(`HK$${r.hkd}`, L, 512);
  ctx.font = `500 20px ${fontSC}`;
  wrap(ctx, punchline(r.score), L, 560, 520, 32);

  ctx.font = `700 40px ${fontSC}`;
  ctx.fillStyle = r.certified ? tokens.alert : tokens.inkDeep;
  ctx.fillText(r.title, L, 690);
  ctx.fillStyle = tokens.inkDeep;
  ctx.font = `500 18px ${fontSC}`;
  const notes = [r.certified ? UI.certified : "", r.isNew ? UI.newRecord : ""].filter(Boolean).join(" · ");
  if (notes) ctx.fillText(notes, L, 724);

  stamp(ctx, 700, 520, r.stamp);

  const ground = 1090;
  ctx.fillStyle = tokens.ink;
  ctx.fillRect(L, ground, 560, 3);
  ctx.fillStyle = tokens.mid;
  [[100, 10], [180, 16], [260, 8], [350, 14], [430, 10], [520, 18], [600, 12]].forEach(([x, y]) =>
    ctx.fillRect(x!, ground + y!, 12, 3),
  );
  const put = (s: Sprite, x: number, scale: number) =>
    ctx.drawImage(s.img, x, ground - s.h * scale, s.w * scale, s.h * scale);
  put(SPR.playerJump, L + 8, 3);
  put(SPR.water, 250, 4);
  put(SPR.grandma, 390, 3);

  const page = new URL(location.href);
  page.search = "";
  page.hash = "";
  const qr = await QRCode.toDataURL(page.toString(), {
    margin: 0,
    width: 360,
    color: { dark: tokens.inkDeep, light: tokens.poster },
  });
  const img = await loadImage(qr);
  ctx.drawImage(img, W - L - 150, 940, 150, 150);
  ctx.fillStyle = tokens.inkDeep;
  ctx.textAlign = "center";
  ctx.font = `500 16px ${fontSC}`;
  ctx.fillText("扫码一起通勤", W - L - 75, 1120);

  ctx.fillStyle = tokens.line;
  ctx.fillRect(30, H - 30 - 16, W - 60, 16);

  return canvas.toDataURL("image/png");
}

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, word: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.14);
  ctx.strokeStyle = tokens.alert;
  ctx.fillStyle = tokens.alert;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.stroke();
  arcText(ctx, "深港通勤 · 認證", 74);
  ctx.font = `700 46px ${fontTC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, 0, 12);
  ctx.restore();
}

function arcText(ctx: CanvasRenderingContext2D, text: string, radius: number) {
  const chars = [...text];
  const step = 0.3;
  ctx.font = `600 16px ${fontTC}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 + (i - (chars.length - 1) / 2) * step;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.translate(0, -radius);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, t: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + t;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let row = "";
  let cy = y;
  for (const ch of text) {
    if (ctx.measureText(row + ch).width > max && !"。，、！？".includes(ch)) {
      ctx.fillText(row, x, cy);
      row = ch;
      cy += lh;
    } else row += ch;
  }
  if (row) ctx.fillText(row, x, cy);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("qr"));
    img.src = src;
  });
}
