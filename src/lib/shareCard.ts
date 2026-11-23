// Builds a branded Spy General image (1200×675, good for Discord) entirely on the member's computer.
// Nothing is uploaded: the picture is drawn on a canvas and handed back as a PNG.

import { badgeSvg } from "./logo";

export const CARD_W = 1200;
export const CARD_H = 675;

const GOOD = "#2fd12f";
const BAD = "#ee7371";
const MUTED = "#8f8d84";
const WHITE = "#ffffff";
const SITE = "thespygeneral.github.io";
const SANS = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;

export type Stat = [label: string, value: string];

export type CardContent = {
  /** Small line above the title, e.g. "OPTION · BOUGHT" or "THIS WEEK". */
  kicker: string;
  /** The main line, e.g. "SPY 680C 12/18/26" or "Nov 17 – Nov 23". */
  title: string;
  /** Number shown huge (net P&L). null = nothing closed. */
  pnl: number | null;
  /** Word shown instead of the dollars when they're hidden, e.g. "WIN" or "GREEN WEEK". */
  resultWord: string;
  stats: Stat[];
  /** Small text top-right, e.g. the date. */
  corner: string;
};

export function moneyRaw(v: number, signed = true): string {
  const sign = v > 0 && signed ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

let badgePromise: Promise<HTMLImageElement> | null = null;
function badgeImage(): Promise<HTMLImageElement> {
  badgePromise ??= (async () => {
    const svg = badgeSvg({ size: 480, id: "sharecard", text: false });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  })();
  return badgePromise;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws text at the largest size (up to `size`) that fits in `maxW`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, family: string, weight = 700) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

function gold(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#dccb5e");
  g.addColorStop(1, "#978c2a");
  return g;
}

/** The badge, plus its SPY / GENERAL / ELITE lettering drawn in the page's Oswald font. */
async function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const img = await badgeImage();
  const h = (w * 270) / 240;
  ctx.drawImage(img, x, y, w, h);
  const k = w / 240;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = gold(ctx, y + 60 * k, y + 200 * k);
  ctx.font = `700 ${70 * k}px Oswald`;
  ctx.fillText("SPY", x + 120 * k, y + 128 * k);
  ctx.font = `700 ${31 * k}px Oswald`;
  ctx.fillText("GENERAL", x + 120 * k, y + 166 * k);
  ctx.fillText("ELITE", x + 120 * k, y + 200 * k);
  ctx.restore();
}

export async function renderCard(c: CardContent, hideDollars: boolean): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load("700 64px Oswald"), document.fonts.ready]);
  } catch {
    /* falls back to system font */
  }
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const tone = c.pnl === null ? WHITE : c.pnl > 0 ? GOOD : c.pnl < 0 ? BAD : WHITE;

  // Background: near-black with a soft olive glow, framed by a thin gold line.
  ctx.fillStyle = "#0a0b07";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W * 0.85, -60, 40, CARD_W * 0.85, -60, 760);
  glow.addColorStop(0, "rgba(185,173,69,0.28)");
  glow.addColorStop(1, "rgba(185,173,69,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const accent = ctx.createRadialGradient(140, CARD_H + 40, 20, 140, CARD_H + 40, 520);
  accent.addColorStop(0, c.pnl !== null && c.pnl < 0 ? "rgba(238,115,113,0.16)" : "rgba(47,209,47,0.13)");
  accent.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  roundRect(ctx, 18, 18, CARD_W - 36, CARD_H - 36, 26);
  ctx.strokeStyle = "rgba(201,189,79,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header: badge + name.
  await drawBadge(ctx, 54, 44, 104);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = gold(ctx, 70, 110);
  ctx.font = "700 40px Oswald";
  ctx.fillText("THE SPY GENERAL", 180, 104);
  ctx.fillStyle = MUTED;
  ctx.font = `600 19px ${SANS}`;
  ctx.fillText("TRADE JOURNAL", 182, 136);
  ctx.textAlign = "right";
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText(c.corner, CARD_W - 60, 104);
  ctx.textAlign = "left";

  // Kicker + title.
  ctx.fillStyle = "#c9bd4f";
  ctx.font = `700 22px ${SANS}`;
  ctx.fillText(c.kicker.toUpperCase(), 60, 236);
  ctx.fillStyle = WHITE;
  fitText(ctx, c.title, 60, 300, CARD_W - 120, 58, "Oswald");

  // The big result.
  ctx.fillStyle = tone;
  const big = hideDollars || c.pnl === null ? c.resultWord : moneyRaw(c.pnl);
  fitText(ctx, big, 56, 448, CARD_W - 120, 150, "Oswald");

  // Stats row.
  const stats = c.stats.slice(0, 4);
  if (stats.length) {
    const top = 500;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(60, top, CARD_W - 120, 1);
    const colW = (CARD_W - 120) / stats.length;
    stats.forEach(([label, value], i) => {
      const x = 60 + i * colW;
      ctx.fillStyle = MUTED;
      ctx.font = `600 17px ${SANS}`;
      ctx.fillText(label.toUpperCase(), x, top + 42);
      ctx.fillStyle = WHITE;
      fitText(ctx, value, x, top + 90, colW - 24, 38, "Oswald");
    });
  }

  // Footer.
  ctx.fillStyle = MUTED;
  ctx.font = `500 17px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(SITE, CARD_W - 60, CARD_H - 44);
  ctx.textAlign = "left";
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the image"))), "image/png"));
}
