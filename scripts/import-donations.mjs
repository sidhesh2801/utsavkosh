#!/usr/bin/env node
/**
 * Turns a collection list or bank statement export into import SQL.
 *
 *   npm run import-donations -- ~/Downloads/statement.csv "Ganesh Chaturthi 2026"
 *
 * Reads a CSV however the bank happened to name its columns, checks the
 * arithmetic, reports anything that looks wrong, and writes a migration to
 * paste into the Supabase SQL Editor.
 *
 * It never writes to the database itself. Recompiling a list is a job you can
 * redo; writing wrong numbers into a live ledger is not — so the SQL is left
 * for a person to read first.
 *
 * Standalone on purpose: nothing in the app imports this, it lives outside
 * src/ so it is not part of the build, and it has no dependencies beyond Node.
 * It cannot affect the running site.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

/* ------------------------------------------------------------------ CSV */

/**
 * Copes with quoted fields containing commas and newlines. Bank exports quote
 * inconsistently, and a naive split on "," corrupts exactly the rows carrying
 * the most detail.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  // Strip a UTF-8 BOM; Excel adds one and it corrupts the first header.
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/* -------------------------------------------------------------- columns */

/**
 * Columns are found by what their header looks like, because no two banks
 * agree: "Amount Donated (Rs.)", "Credit" and "Deposit Amt." are all the same
 * thing.
 */
const COLUMN_PATTERNS = {
  name: /name|donor|payer|particular|description|narration|remit/i,
  amount: /amount|credit|deposit|value|rs\.?$|inr/i,
  date: /date|txn date|value date/i,
  flat: /flat|unit|house|apartment/i,
  reference: /utr|ref|transaction id|txn id|cheque|rrn/i,
  source: /source|mode|type|channel/i,
};

function detectColumns(header) {
  const found = {};
  header.forEach((raw, i) => {
    const h = raw.trim();
    if (!h) return;
    for (const [key, pattern] of Object.entries(COLUMN_PATTERNS)) {
      // First match wins, so a specific earlier column is not overwritten by a
      // vaguer one further right.
      if (found[key] === undefined && pattern.test(h)) found[key] = i;
    }
  });
  return found;
}

/* --------------------------------------------------------------- values */

function readAmount(raw) {
  const cleaned = String(raw ?? "")
    .replace(/(?:₹|rs\.?|inr)/gi, "")
    .replace(/,/g, "")
    .replace(/\s| /g, "")
    .replace(/(cr|dr)$/i, "")
    .trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Accepts the formats Indian banks actually emit; returns ISO or null. */
function readDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Day-first. Ambiguous with month-first, but Indian statements are day-first
  // and guessing the other way would move dates by up to eleven months without
  // anything looking wrong.
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) return null;
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${month}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** "N-130", "B/404", "O 140" → { wing: "N", flat: "130" } */
function readFlat(raw) {
  const m = String(raw ?? "").trim().match(/^([A-Za-z]{1,3})\s*[-/]?\s*(\d{1,5})$/);
  return m ? { wing: m[1].toUpperCase(), flat: m[2] } : { wing: null, flat: null };
}

/**
 * Bank statements shout, and often truncate. Title case reads better on a
 * receipt; the truncation stays, because completing a name from a guess is
 * worse than showing what the bank recorded.
 */
function titleCase(name) {
  return String(name ?? "")
    .trim()
    .replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Statement lines that are not contributions. */
const NOT_A_DONATION =
  /\b(opening balance|closing balance|b\/f|c\/f|charges?|gst|reversal|refund|interest|atm|salary)\b/i;

/* ----------------------------------------------------------------- main */

const [, , fileArg, activityArg] = process.argv;

if (!fileArg) {
  console.error(`
Usage:
  npm run import-donations -- <file.csv> ["Activity name"]

Example:
  npm run import-donations -- ~/Downloads/statement.csv "Ganesh Chaturthi 2026"
`);
  process.exit(1);
}

const path = resolve(fileArg.replace(/^~/, process.env.HOME ?? "~"));
if (!existsSync(path)) {
  console.error(`Can't find ${path}`);
  process.exit(1);
}

const activity = activityArg || "Janmashtami & Dahi Handi 2026";
const rows = parseCsv(readFileSync(path, "utf8"));
if (rows.length < 2) {
  console.error("That file has no rows.");
  process.exit(1);
}

const columns = detectColumns(rows[0]);
if (columns.amount === undefined) {
  console.error(
    `Couldn't find an amount column. Headers seen:\n  ${rows[0].join(" | ")}\n` +
      `Rename the amount column to something containing "amount" or "credit".`,
  );
  process.exit(1);
}

console.log(`\nReading ${path}`);
console.log("Columns detected:");
for (const [key, index] of Object.entries(columns)) {
  console.log(`  ${key.padEnd(10)} -> "${rows[0][index].trim()}"`);
}

const entries = [];
const problems = [];
let statedTotal = null;

rows.slice(1).forEach((row, i) => {
  const line = i + 2;
  const cell = (k) => (columns[k] === undefined ? "" : (row[columns[k]] ?? "").trim());

  const rawName = cell("name");
  const rawAmount = cell("amount");

  // A "TOTAL" line is the compiler's own arithmetic — kept to check against,
  // never imported.
  if (/^total$/i.test(rawName)) {
    statedTotal = readAmount(rawAmount);
    return;
  }
  if (!rawAmount) return;
  if (NOT_A_DONATION.test(rawName)) return;

  const amount = readAmount(rawAmount);
  if (amount === null) {
    problems.push({ line, reason: `amount "${rawAmount}" isn't a number I can read` });
    return;
  }

  const date = readDate(cell("date"));
  if (cell("date") && !date) {
    problems.push({ line, reason: `date "${cell("date")}" isn't a format I recognise` });
    return;
  }

  const { wing, flat } = readFlat(cell("flat"));
  entries.push({
    line,
    name: rawName ? titleCase(rawName) : null,
    wing,
    flat,
    amount,
    date: date ?? new Date().toISOString().slice(0, 10),
    reference: cell("reference") || null,
    source: cell("source") || null,
  });
});

/* ------------------------------------------------------------ the report */

const total = entries.reduce((t, e) => t + e.amount, 0);
const named = entries.filter((e) => e.name);
const anon = entries.filter((e) => !e.name);
const tiny = entries.filter((e) => e.amount <= 10);

const byName = new Map();
for (const e of named) {
  const k = e.name.toLowerCase();
  byName.set(k, [...(byName.get(k) ?? []), e]);
}
const duplicates = [...byName.values()].filter((g) => g.length > 1);

const inr = (n) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

console.log(`\n  entries          ${entries.length}`);
console.log(`  total            ${inr(total)}`);
if (statedTotal !== null) {
  const diff = total - statedTotal;
  console.log(`  stated total     ${inr(statedTotal)}`);
  console.log(
    Math.abs(diff) < 0.01
      ? `  reconciles       yes`
      : `  MISMATCH         off by ${inr(diff)} — check before importing`,
  );
}
console.log(`  named            ${named.length}`);
console.log(`  no name given    ${anon.length}`);
console.log(`  with flat no.    ${entries.filter((e) => e.flat).length}`);

if (tiny.length) {
  console.log(`\n  ${tiny.length} entries of Rs 10 or less — usually test payments:`);
  for (const e of tiny) console.log(`     line ${e.line}: ${inr(e.amount)} ${e.reference ?? ""}`);
}
if (duplicates.length) {
  console.log(`\n  repeated names — two people, or one entered twice?`);
  for (const g of duplicates) {
    console.log(`     ${g[0].name}: ${g.map((e) => inr(e.amount)).join(", ")}`);
  }
}
if (problems.length) {
  console.log(`\n  ${problems.length} rows skipped:`);
  for (const p of problems) console.log(`     line ${p.line}: ${p.reason}`);
}

if (!entries.length) {
  console.error("\nNothing to import.");
  process.exit(1);
}

/* ---------------------------------------------------------------- output */

const sqlString = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const values = entries
  .map(
    (e) =>
      `  (${sqlString(e.name ?? "Anonymous (QR payment)")}, ${sqlString(e.wing)}, ` +
      `${sqlString(e.flat)}, ${e.amount.toFixed(2)}, 'upi', ${sqlString(e.reference)}, ` +
      `DATE ${sqlString(e.date)}, ${sqlString(e.source)})`,
  )
  .join(",\n");

const slug = activity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const outDir = join(process.cwd(), "supabase", "migrations");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `import-${slug}.sql`);

writeFileSync(
  outFile,
  `-- Generated by scripts/import-donations.mjs from ${path}
--
-- ${entries.length} contributions totalling ${inr(total)}.
-- Run in the Supabase SQL Editor. Safe to re-run: it does nothing if this
-- activity already has entries against it.
--
-- Read this before running it. Everything the importer questioned was printed
-- to the console, not silently corrected.

do $$
declare
  v_activity uuid;
  v_admin    uuid;
  v_existing int;
begin
  -- Entries are attributed to someone, because the ledger records who entered
  -- what. A committee record is created if no admin exists, so importing does
  -- not depend on anyone having a login yet.
  select id into v_admin from public.members where role = 'admin' order by joined_at limit 1;
  if v_admin is null then
    insert into public.members (name, role, status)
    values ('Festival Committee', 'admin', 'approved')
    returning id into v_admin;
  end if;

  select id into v_activity from public.activities where title = ${sqlString(activity)};
  if v_activity is null then
    insert into public.activities (title, category, starts_at, venue, budget, status, organiser)
    values (${sqlString(activity)}, 'festival', now(), '', 0, 'planned', 'Festival Committee')
    returning id into v_activity;
  end if;

  select count(*) into v_existing from public.donations where activity_id = v_activity;
  if v_existing > 0 then
    raise notice 'Already imported (% rows) — nothing to do.', v_existing;
    return;
  end if;

  insert into public.donations
    (donor_name, wing, flat, amount, method, reference, received_at, note,
     activity_id, recorded_by, status, verified_by, verified_at)
  select v.donor_name, v.wing, v.flat, v.amount, v.method, v.reference, v.received_at,
         v.source, v_activity, v_admin, 'verified', v_admin, now()
  from (values
${values}
  ) as v(donor_name, wing, flat, amount, method, reference, received_at, source);
end;
$$;

-- Check: expect ${entries.length} rows and ${inr(total)}.
select count(*) as entries, to_char(sum(amount), 'FM9,99,999.00') as total
from public.donations d
join public.activities a on a.id = d.activity_id
where a.title = ${sqlString(activity)};
`,
  "utf8",
);

console.log(`\n  written -> ${outFile}`);
console.log(`  next: open it, read it, then paste into the Supabase SQL Editor and Run.\n`);
