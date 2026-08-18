import type { Activity, Donation, SocietyData } from "./types";
import { methodLabel, money, shortDate } from "./format";

/**
 * Receipt numbering and wording.
 *
 * Deliberately NOT tax-deduction (80G) receipts — a co-operative housing
 * society is not a registered charitable trust, so claiming a tax benefit on
 * these would be false. This is an acknowledgement of money received.
 */

/** Indian financial year: 1 April to 31 March. "2026-27" */
export function financialYear(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  // Jan–Mar belong to the financial year that began the previous April.
  const startYear = d.getMonth() < 3 ? year - 1 : year;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export const DEFAULT_RECEIPT_PREFIX = "WPC";

/**
 * Next receipt number in the series for the entry's financial year.
 *
 * The series must be gapless, so it is derived from the highest number already
 * issued in that year rather than from a count (which would repeat a number
 * after a deletion).
 */
export function nextReceiptNo(
  existing: Donation[],
  receivedAt: string,
  prefix: string = DEFAULT_RECEIPT_PREFIX,
): string {
  const fy = financialYear(receivedAt);
  // The prefix is user-supplied, so escape it before it goes into a RegExp.
  const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${safePrefix}/${fy}/(\\d+)$`);
  let highest = 0;
  for (const d of existing) {
    const match = d.receiptNo?.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}/${fy}/${String(highest + 1).padStart(4, "0")}`;
}

/* ------------------------------------------------------- amount in words */

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const rest = n % 10;
    return TENS[Math.floor(n / 10)] + (rest ? `-${ONES[rest]}` : "");
  }
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${underThousand(rest)}` : ""}`;
}

/**
 * "Five thousand one hundred rupees only" — using the Indian numbering system
 * (crore, lakh, thousand), which is what a receipt in India must read.
 */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero rupees only";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1_000);
  const remainder = rupees % 1_000;

  if (crore) parts.push(`${underThousand(crore)} crore`);
  if (lakh) parts.push(`${underThousand(lakh)} lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} thousand`);
  if (remainder) parts.push(underThousand(remainder));

  let words = parts.join(" ");
  if (rupees) words += rupees === 1 ? " rupee" : " rupees";
  if (paise) words += `${rupees ? " and " : ""}${underThousand(paise)} paise`;

  return `${words.charAt(0).toUpperCase()}${words.slice(1)} only`;
}

/* ------------------------------------------------------- receipt content */

export interface ReceiptLine {
  label: string;
  value: string;
}

export function receiptLines(
  donation: Donation,
  society: SocietyData["society"],
  activity: Activity | null,
  receivedByName: string,
): ReceiptLine[] {
  const lines: ReceiptLine[] = [
    { label: "Receipt no.", value: donation.receiptNo },
    { label: "Date", value: shortDate(donation.receivedAt) },
    { label: "Received from", value: donation.donorName },
  ];
  if (donation.wing || donation.flat) {
    lines.push({
      label: "Flat",
      value: [donation.wing, donation.flat].filter(Boolean).join("-"),
    });
  }
  lines.push(
    { label: "Amount", value: money(donation.amount) },
    { label: "In words", value: amountInWords(donation.amount) },
    { label: "Towards", value: activity ? activity.title : "General society fund" },
    { label: "Mode", value: methodLabel(donation.method) },
  );
  if (donation.reference) lines.push({ label: "Reference", value: donation.reference });
  lines.push({ label: "Received by", value: receivedByName });
  if (donation.status === "pending") {
    lines.push({
      label: "Status",
      value: "Pending confirmation by the treasurer",
    });
  }
  void society;
  return lines;
}

/**
 * The receipt as a WhatsApp message. Plain text rather than an attachment,
 * because a wa.me deep link can carry text but not a file — and text arrives
 * legibly on every phone with no download.
 */
export function receiptMessage(
  donation: Donation,
  society: SocietyData["society"],
  activity: Activity | null,
  receivedByName: string,
  url?: string,
): string {
  const lines = [
    `🧾 *RECEIPT — ${donation.receiptNo}*`,
    `*${society.name}*`,
    society.address ? `_${society.address}_` : "",
    `━━━━━━━━━━━━━━━`,
    ``,
    `Received with thanks from`,
    `*${donation.donorName}*${
      donation.wing || donation.flat
        ? ` (${[donation.wing, donation.flat].filter(Boolean).join("-")})`
        : ""
    }`,
    ``,
    `Amount: *${money(donation.amount)}*`,
    `(${amountInWords(donation.amount)})`,
    ``,
    `Towards: ${activity ? activity.title : "General society fund"}`,
    `Date: ${shortDate(donation.receivedAt)}`,
    `Mode: ${methodLabel(donation.method)}${donation.reference ? ` — ${donation.reference}` : ""}`,
    `Received by: ${receivedByName}`,
    ``,
  ];

  if (donation.status === "pending") {
    lines.push(
      `_Note: this will be confirmed once the amount reaches the treasurer._`,
      ``,
    );
  }

  lines.push(
    `Thank you for supporting our society's celebrations 🙏`,
    `━━━━━━━━━━━━━━━`,
    `_Computer-generated receipt. No signature required._`,
  );

  if (url) lines.push(``, `All accounts are open to residents at:`, url);

  return lines.filter((l) => l !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Normalises an Indian mobile number to the `wa.me` format (country code, no
 * plus, no spaces). Returns null when it clearly isn't a usable number, so the
 * UI can say so instead of opening WhatsApp to nowhere.
 */
export function toWhatsAppNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  // 10-digit Indian mobile: prepend 91.
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  // Already has the country code.
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // 0-prefixed local form.
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  // Some other country's number, passed through if plausible.
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}
