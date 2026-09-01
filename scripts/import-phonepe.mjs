#!/usr/bin/env node
/**
 * Imports a PhonePe merchant export into the register.
 *
 *   node --env-file=.env.local scripts/import-phonepe.mjs ~/Downloads/M22V4...csv
 *   node --env-file=.env.local scripts/import-phonepe.mjs <file> --write
 *
 * Separate from import-donations.mjs because a PhonePe export is not a bank
 * statement and the differences matter:
 *
 *   - It has a Transaction Status, and roughly one row in twenty is ERRORED —
 *     a payment that failed. A bank statement never shows those, because
 *     nothing moved. Importing them would inflate the collection by money no
 *     resident ever gave, and there is no name on the row to notice it by.
 *
 *   - Each payment carries two identities: the PhonePe transaction id and the
 *     bank UTR. The same contribution appears under the T-id here and under
 *     the UTR on the statement, so a duplicate check that knows only one of
 *     them records the payment twice.
 *
 *   - There is no payer name. PhonePe does not pass one to the merchant, so
 *     every row lands as "Anonymous (QR payment)" and residents claim their
 *     own by amount, date and the last four digits.
 *
 * Reports before it writes, and asks. Nothing reaches the database until a
 * person has said yes.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------- args */

const args = process.argv.slice(2);
const write = args.includes("--write");
const assumeYes = args.includes("--yes") || args.includes("-y");
const positional = args.filter((a) => !a.startsWith("-"));
const [fileArg, activityArg] = positional;
const activity = activityArg || "Janmashtami & Dahi Handi 2026";

if (!fileArg) {
  console.error(`
Usage:
  node --env-file=.env.local scripts/import-phonepe.mjs <export.csv> ["Activity"] [--write] [--yes]

  --write   insert into the database (otherwise it only reports)
  --yes     skip the confirmation
`);
  process.exit(1);
}

const path = resolve(fileArg.replace(/^~/, process.env.HOME ?? "~"));
if (!existsSync(path)) {
  console.error(`Can't find ${path}`);
  process.exit(1);
}

/* -------------------------------------------------------------------- csv */

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') { if (input[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = []; field = "";
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const raw = parseCsv(readFileSync(path, "utf8"));
const header = raw[0].map((h) => h.trim());
const records = raw.slice(1).map((r) =>
  Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])),
);

const need = ["PhonePe Reference Id", "Total Transaction Amount", "Transaction Date", "Transaction Status"];
const missing = need.filter((c) => !header.includes(c));
if (missing.length) {
  console.error(`This doesn't look like a PhonePe export — no ${missing.join(", ")} column.`);
  console.error(`Headers seen:\n  ${header.join(" | ")}`);
  process.exit(1);
}

const inr = (n) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/* ------------------------------------------------------------ exclusions */

const excludePath = join(HERE, "excluded-transactions.txt");
const excluded = new Set(
  existsSync(excludePath)
    ? readFileSync(excludePath, "utf8")
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, "").trim())
        .filter(Boolean)
    : [],
);

/* ---------------------------------------------------------------- sorting */

const completed = [], errored = [], skipped = [];

for (const r of records) {
  const id = r["PhonePe Reference Id"];
  const utr = r["Transaction UTR"];
  const amount = Number(r["Total Transaction Amount"]);
  const date = String(r["Transaction Date"]).slice(0, 10);
  const entry = { id, utr, amount, date, at: r["Transaction Date"] };

  if (!id || !Number.isFinite(amount) || amount <= 0) continue;
  if (r["Transaction Status"] !== "COMPLETED") { errored.push(entry); continue; }
  if (excluded.has(id) || (utr && excluded.has(utr))) { skipped.push(entry); continue; }
  completed.push(entry);
}

const sum = (rows) => rows.reduce((t, r) => t + r.amount, 0);

console.log(`\nReading ${path}`);
console.log(`\n  rows              ${records.length}`);
console.log(`  completed         ${completed.length + skipped.length}   ${inr(sum(completed) + sum(skipped))}`);
console.log(`  failed (ERRORED)  ${errored.length}   ${inr(sum(errored))}   — never imported`);
if (skipped.length) {
  console.log(`  deliberately out  ${skipped.length}   ${inr(sum(skipped))}   — see scripts/excluded-transactions.txt`);
}

const byDay = new Map();
for (const c of completed) {
  const d = byDay.get(c.date) ?? [0, 0];
  byDay.set(c.date, [d[0] + 1, d[1] + c.amount]);
}
console.log("\n  usable payments by day:");
for (const d of [...byDay.keys()].sort()) {
  const [n, t] = byDay.get(d);
  console.log(`     ${d}   ${String(n).padStart(3)}   ${inr(t)}`);
}

/* -------------------------------------------------------- the database */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("\nNeeds NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with:  node --env-file=.env.local scripts/import-phonepe.mjs ...");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const { data: activityRow } = await db
  .from("activities").select("id").eq("title", activity).maybeSingle();
if (!activityRow) {
  console.error(`\nNo festival called "${activity}". Open it in the app first.`);
  process.exit(1);
}

const { data: existing } = await db
  .from("donations").select("id, amount, reference, receipt_no, received_at")
  .eq("activity_id", activityRow.id).limit(5000);

// A payment is known by two ids; either one already on a row means it is in.
const known = new Map();
for (const row of existing ?? []) if (row.reference) known.set(String(row.reference), row);

const fresh = completed.filter((c) => !known.has(c.id) && !(c.utr && known.has(c.utr)));

// Failed payments that were imported before this script existed, when the
// export being pasted around had no status column to filter on.
const badRows = [];
for (const e of errored) {
  const hit = known.get(e.id) || (e.utr && known.get(e.utr));
  if (hit) badRows.push({ ...e, row: hit });
}

console.log(`\n  already recorded  ${completed.length - fresh.length}`);
console.log(`  new to add        ${fresh.length}   ${inr(sum(fresh))}`);

if (badRows.length) {
  console.log(`\n  ${badRows.length} FAILED payments are recorded as donations and should not be:`);
  for (const b of badRows) {
    console.log(`     ${b.date}  ${inr(b.amount).padStart(14)}  ${b.receipt_no ?? b.row.receipt_no}  ${b.id}`);
  }
  console.log(`     total ${inr(badRows.reduce((t, b) => t + b.amount, 0))}`);
}

if (!write) {
  console.log("\n  Nothing written. Re-run with --write to apply.\n");
  process.exit(0);
}
if (!fresh.length && !badRows.length) {
  console.log("\n  Nothing to change.\n");
  process.exit(0);
}

if (!assumeYes) {
  const answer = await new Promise((res) => {
    process.stdout.write(
      `\n  Add ${fresh.length} and remove ${badRows.length} failed? [y/N] `,
    );
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (d) => res(String(d).trim().toLowerCase()));
  });
  if (answer !== "y" && answer !== "yes") {
    console.log("  Nothing written.\n");
    process.exit(0);
  }
}

if (badRows.length) {
  const { error } = await db.from("donations").delete().in("id", badRows.map((b) => b.row.id));
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`  removed ${badRows.length} failed payments`);
}

if (fresh.length) {
  const { data: member } = await db
    .from("members").select("id").eq("role", "admin").order("joined_at").limit(1).maybeSingle();

  const { error } = await db.from("donations").insert(
    fresh.map((c) => ({
      donor_name: "Anonymous (QR payment)",
      amount: c.amount,
      method: "upi",
      reference: c.id,
      received_at: c.date,
      activity_id: activityRow.id,
      recorded_by: member?.id,
      status: "verified",
      note: "PhonePe QR",
    })),
  );
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`  added ${fresh.length}`);
}

const { data: after } = await db
  .from("donations").select("amount").eq("activity_id", activityRow.id).limit(5000);
console.log(
  `\n  ${activity} now stands at ${after.length} entries, ` +
    `${inr(after.reduce((t, d) => t + Number(d.amount), 0))}\n`,
);
