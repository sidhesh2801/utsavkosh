/**
 * Parses a pasted contributor list into receipt rows.
 *
 * Committees keep these lists in WhatsApp messages and spreadsheets, so the
 * input is messy by nature. Handled shapes, all seen in real lists:
 *
 *   1. Anand Pr – ₹1,100
 *   26. Anup Deo (N-130) – ₹501
 *   Sachin B - 510
 *   Rajeev S — Rs. 2,100
 *   Pooja K,1000
 *
 * Anything that can't be read is returned as a problem rather than silently
 * dropped — a missing name on a collection list means a missing receipt.
 */

export interface ParsedRow {
  /** Position in the pasted list, for showing errors against a line. */
  line: number;
  name: string;
  /** Extracted from a trailing "(N-130)" if present. */
  wing?: string;
  flat?: string;
  amount: number;
  raw: string;
}

export interface ParseProblem {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  problems: ParseProblem[];
  total: number;
}

/** Leading "12." or "12)" list numbering. */
const LEADING_INDEX = /^\s*\d{1,4}\s*[.)]\s*/;

/**
 * The amount, anchored to the end of the line.
 *
 * Anchoring here rather than splitting on a separator is deliberate: "₹1,100"
 * contains a comma, and a comma is also a separator people use, so splitting
 * would read ₹1,100 as ₹100 — a tenfold under-receipt.
 */
const AMOUNT_AT_END = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*$/i;

/** Separator characters left dangling on the name once the amount is removed. */
const TRAILING_SEPARATOR = /[\s–—\-:,]+$/;

/** "(N-130)", "(B-404)", "(O-140)" — a flat reference in brackets. */
const FLAT_IN_BRACKETS = /\(\s*([A-Za-z]{1,3})\s*[-/]?\s*(\d{1,5})\s*\)\s*$/;

/** Currency noise to strip before reading a number. */
const CURRENCY = /(?:₹|rs\.?|inr)/gi;

function readAmount(text: string): number | null {
  const cleaned = text.replace(CURRENCY, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  // Reject anything that isn't purely a number — "five hundred" is a problem,
  // not a silent zero.
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseContributorList(input: string): ParseResult {
  const rows: ParsedRow[] = [];
  const problems: ParseProblem[] = [];

  input.split(/\r?\n/).forEach((original, i) => {
    const line = i + 1;
    const raw = original.trim();
    if (!raw) return;

    const withoutIndex = raw.replace(LEADING_INDEX, "").trim();
    if (!withoutIndex) {
      problems.push({ line, raw, reason: "Nothing on this line but a number." });
      return;
    }

    const match = withoutIndex.match(AMOUNT_AT_END);
    if (!match || match.index === undefined) {
      problems.push({
        line,
        raw,
        reason: "Couldn't find an amount — expected something like “Name – ₹501”.",
      });
      return;
    }

    const amount = readAmount(match[1]);
    if (amount === null) {
      problems.push({ line, raw, reason: `“${match[1]}” isn't an amount I can read.` });
      return;
    }

    let namePart = withoutIndex.slice(0, match.index).replace(TRAILING_SEPARATOR, "").trim();

    let wing: string | undefined;
    let flat: string | undefined;
    const bracketed = namePart.match(FLAT_IN_BRACKETS);
    if (bracketed) {
      wing = bracketed[1].toUpperCase();
      flat = bracketed[2];
      namePart = namePart.slice(0, bracketed.index).trim();
    }

    if (!namePart) {
      problems.push({ line, raw, reason: "No name on this line." });
      return;
    }

    rows.push({ line, name: namePart, wing, flat, amount, raw });
  });

  return { rows, problems, total: rows.reduce((sum, r) => sum + r.amount, 0) };
}

/** Duplicate names, which on a collection list usually mean a double entry. */
export function findDuplicates(rows: ParsedRow[]): Map<string, ParsedRow[]> {
  const byName = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const key = row.name.toLowerCase().replace(/\s+/g, " ");
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }
  return new Map([...byName].filter(([, list]) => list.length > 1));
}
