import { amountInWords } from "./receipt";

/**
 * Draws the society's Seva receipt to a canvas and returns it as a PNG.
 *
 * Canvas rather than a DOM screenshot, because the output has to look identical
 * on every phone — an html-to-image pass depends on fonts and layout that vary
 * by device, and a receipt that renders differently for different volunteers is
 * worse than no image at all.
 *
 * The layout mirrors the printed version, so the messaged receipt and the paper
 * receipt are the same document.
 */

const NAVY = "#12357f";
const GOLD = "#c8a951";
const INK = "#3f3f46";
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** 3:2, large enough to stay sharp opened full-screen in WhatsApp. */
const W = 1500;
const H = 1000;

export interface ReceiptImageData {
  receiptNo: string;
  date: string;
  name: string;
  wing?: string;
  flat?: string;
  amount: number;
  societyName?: string;
  showWords?: boolean;
}

/** The building crest, inside a gold ring. */
function drawCrest(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#cfe6f5";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = "#7fb069";
  ctx.fillRect(cx - r, cy + r * 0.28, r * 2, r * 0.72);

  const towerW = r * 0.42;
  const towerH = r;
  const top = cy - r * 0.52;

  for (const dx of [-r * 0.56, r * 0.14]) {
    const x = cx + dx;
    ctx.fillStyle = "#e8dcc4";
    ctx.fillRect(x, top, towerW, towerH);
    ctx.strokeStyle = "#8a7a5c";
    ctx.lineWidth = Math.max(1, r * 0.02);
    ctx.strokeRect(x, top, towerW, towerH);
    ctx.fillStyle = "#6b5b3e";
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillRect(
          x + towerW * (0.13 + col * 0.28),
          top + towerH * (0.09 + row * 0.145),
          towerW * 0.17,
          towerH * 0.085,
        );
      }
    }
  }

  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.14);
  ctx.lineTo(cx + r * 0.27, cy + r * 0.48);
  ctx.lineTo(cx - r * 0.27, cy + r * 0.48);
  ctx.closePath();
  ctx.fillStyle = "#bcd9ee";
  ctx.fill();
  ctx.strokeStyle = "#7d93a6";
  ctx.stroke();

  ctx.lineCap = "round";
  for (const dx of [-r * 0.72, r * 0.72]) {
    const x = cx + dx;
    const base = cy + r * 0.5;
    ctx.strokeStyle = "#8a6b3f";
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + r * 0.04, base - r * 0.3, x, base - r * 0.56);
    ctx.stroke();
    ctx.strokeStyle = "#4f8f3a";
    ctx.lineWidth = r * 0.06;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, base - r * 0.56);
      ctx.quadraticCurveTo(x + dir * r * 0.22, base - r * 0.66, x + dir * r * 0.3, base - r * 0.46);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, base - r * 0.56);
    ctx.quadraticCurveTo(x - r * 0.07, base - r * 0.78, x, base - r * 0.86);
    ctx.stroke();
  }

  ctx.fillStyle = "#5f9e4a";
  for (const dx of [-r * 0.43, r * 0.43]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + r * 0.53, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2, r * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Label, then the value sitting on a ruled line — the paper form's look. */
function drawField(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: string;
    strong?: boolean;
    note?: string;
  },
) {
  const { x, y, width, label, value, strong, note } = opts;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `400 38px ${FONT}`;
  ctx.fillText(label, x, y);

  const lineStart = x + ctx.measureText(label).width + 14;
  const lineEnd = x + width;

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lineStart, y + 10);
  ctx.lineTo(lineEnd, y + 10);
  ctx.stroke();

  ctx.fillStyle = "#111111";
  ctx.font = strong ? `700 46px ${FONT}` : `500 38px ${FONT}`;

  // A long name must never run past the end of its rule.
  let shown = value;
  const maxWidth = lineEnd - lineStart - 12;
  while (shown.length > 4 && ctx.measureText(shown).width > maxWidth) {
    shown = `${shown.slice(0, -2)}…`;
  }
  ctx.fillText(shown, lineStart + 6, y);

  if (note) {
    ctx.fillStyle = INK;
    ctx.font = `italic 400 26px ${FONT}`;
    ctx.fillText(note, lineStart + 6, y + 44);
  }
}

/** Renders one receipt and resolves with a PNG blob. */
export async function renderReceiptPng(data: ReceiptImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the receipt on this device.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 8;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  drawCrest(ctx, 200, 250, 130);

  ctx.fillStyle = NAVY;
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText("Festival / Community", 380, 235);
  ctx.fillText("Seva Donation Receipt", 380, 320);

  if (data.societyName) {
    ctx.fillStyle = INK;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(data.societyName, 380, 372);
  }

  const flatAndName = [[data.wing, data.flat].filter(Boolean).join("-"), data.name]
    .filter(Boolean)
    .join("  ·  ");

  drawField(ctx, { x: 90, y: 560, width: 640, label: "Receipt No.:", value: data.receiptNo });
  drawField(ctx, { x: 800, y: 560, width: 610, label: "Date:", value: data.date });
  drawField(ctx, { x: 90, y: 680, width: 1320, label: "Flat No. and Name:", value: flatAndName });
  drawField(ctx, {
    x: 90,
    y: 800,
    width: 1320,
    label: "Amount: ₹",
    value: data.amount.toLocaleString("en-IN"),
    strong: true,
    note: data.showWords === false ? undefined : amountInWords(data.amount),
  });

  ctx.fillStyle = INK;
  ctx.font = `400 32px ${FONT}`;
  const sigLabel = "Authorized Signature:";
  const sigLabelWidth = ctx.measureText(sigLabel).width;
  const sigX = W - 90 - 340 - sigLabelWidth;
  ctx.fillText(sigLabel, sigX, 930);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sigX + sigLabelWidth + 12, 940);
  ctx.lineTo(W - 90, 940);
  ctx.stroke();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
      "image/png",
    );
  });
}

export function receiptFileName(receiptNo: string): string {
  return `receipt-${receiptNo.replace(/\//g, "-")}.png`;
}

/**
 * Shares the receipt image, falling back to a download on desktop.
 *
 * A `wa.me` link can carry a phone number but not a file, so an image reaches
 * WhatsApp only through the system share sheet — which means the volunteer
 * picks the contact. That one tap is what the free route cannot remove.
 */
export async function shareReceiptImage(
  blob: Blob,
  receiptNo: string,
  caption: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], receiptFileName(receiptNo), { type: "image/png" });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: caption });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
