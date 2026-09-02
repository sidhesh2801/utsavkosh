#!/usr/bin/env node
/**
 * A complete copy of the register, on this machine.
 *
 *   node --env-file=.env.local scripts/backup.mjs
 *
 * Writes ~/Downloads/utsavkosh-backup-<date>/ with one CSV per table and a
 * single JSON holding everything. The CSVs are for a person to open; the JSON
 * is what would be used to put it all back.
 *
 * Worth having before the app is taken down, not because taking it down is
 * risky — the data lives in Supabase and the app is only a window onto it —
 * but because the whole record of a festival's money should exist somewhere
 * that does not depend on one account staying paid up.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with:  node --env-file=.env.local scripts/backup.mjs");
  process.exit(1);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

/** Everything the committee would need. Members carry no personal data worth
 *  withholding here — this file never leaves the machine it is written on. */
const TABLES = [
  "societies",
  "activities",
  "donations",
  "expenses",
  "members",
  "albums",
  "photos",
  "food_coupons",
  "food_servings",
];

const stamp = new Date().toISOString().slice(0, 10);
const dir = join(homedir(), "Downloads", `utsavkosh-backup-${stamp}`);
mkdirSync(dir, { recursive: true });

/** A leading =, +, - or @ makes a spreadsheet treat the cell as a formula. */
function cell(v) {
  if (v === null || v === undefined) return "";
  let t = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const everything = {};
let grandTotal = 0;

for (const table of TABLES) {
  const { data, error } = await db.from(table).select("*").limit(20000);
  if (error) {
    console.log(`  ${table.padEnd(16)} skipped — ${error.message}`);
    continue;
  }
  const rows = data ?? [];
  everything[table] = rows;

  if (rows.length) {
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const csv = [
      headers.map(cell).join(","),
      ...rows.map((r) => headers.map((h) => cell(r[h])).join(",")),
    ].join("\r\n");
    // A BOM, so Excel reads the rupee amounts and Indian names correctly.
    writeFileSync(join(dir, `${table}.csv`), `﻿${csv}`, "utf8");
  }

  const money = rows.reduce((t, r) => t + (Number(r.amount) || 0), 0);
  if (table === "donations") grandTotal = money;
  console.log(
    `  ${table.padEnd(16)} ${String(rows.length).padStart(5)} rows` +
      (money ? `   Rs ${money.toLocaleString("en-IN")}` : ""),
  );
}

writeFileSync(
  join(dir, "everything.json"),
  JSON.stringify({ takenAt: new Date().toISOString(), tables: everything }, null, 2),
  "utf8",
);

console.log(`\n  donations total  Rs ${grandTotal.toLocaleString("en-IN")}`);
console.log(`  written to       ${dir}\n`);
