#!/usr/bin/env node
/**
 * Turns a collection list or bank statement export into import SQL.
 *
 *   npm run import-donations -- ~/Downloads/statement.csv "Ganesh Chaturthi 2026"
 *   npm run import-donations -- ~/Downloads/statement.csv --write
 *
 * Reads a CSV however the bank happened to name its columns, checks the
 * arithmetic, and reports anything that looks wrong.
 *
 * By default it writes SQL for a person to read and run — recompiling a list
 * is a job you can redo, writing wrong numbers into a live ledger is not.
 * With --write it inserts directly, after showing the same report and asking.
 * Either way nothing reaches the database until a human has said so.
 *
 * Standalone on purpose: nothing in the app imports this, it lives outside
 * src/ so it is not part of the build, and it has no dependencies beyond Node.
 * It cannot affect the running site.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

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

const args = process.argv.slice(2);
const writeDirect = args.includes("--write");
/**
 * Rewrite the master CSV from the database and import nothing.
 *
 * Needed whenever the register changes without a statement: a cash entry typed
 * into the app, or a row the committee removed. Passing an empty CSV does not
 * work — and should not, since a statement with no rows is far more likely to
 * be a broken export than an intentional no-op.
 */
const refreshOnly = args.includes("--refresh");
const assumeYes = args.includes("--yes") || args.includes("-y");
const csvFlagAt = args.indexOf("--csv");
const csvPathArg = csvFlagAt >= 0 ? args[csvFlagAt + 1] : null;
// The guard on csvFlagAt matters: with no --csv flag it is -1, so a bare
// `i !== csvFlagAt + 1` drops argument 0 — the statement itself — and the
// activity name is read as the filename.
const positional = args.filter(
  (a, i) => !a.startsWith("-") && (csvFlagAt < 0 || i !== csvFlagAt + 1),
);
const [fileArg, activityArg] = positional;

if (!fileArg && !refreshOnly) {
  console.error(`
Usage:
  npm run import-donations -- <file.csv> ["Activity name"] [--write] [--yes]
  npm run import-donations -- --refresh ["Activity name"] --csv <path>

  --write        insert straight into the database instead of writing SQL
  --yes          with --write, skip the confirmation (for scheduled runs)
  --refresh      import nothing; just rewrite the master CSV from the database
  --csv <path>   where to write the refreshed master list
                 (default: donation_list.csv beside the statement)

Examples:
  npm run import-donations -- ~/Downloads/statement.csv
  npm run import-donations -- ~/Downloads/statement.csv "Ganesh Chaturthi 2026" --write
  npm run import-donations -- --refresh --csv ~/Downloads/donation_list.csv
`);
  process.exit(1);
}

// With --refresh there is no statement, so the master list needs somewhere to
// go: --csv, or Downloads, which is where every other output of this lands.
const path = fileArg
  ? resolve(fileArg.replace(/^~/, process.env.HOME ?? "~"))
  : join(process.env.HOME ?? ".", "Downloads", "statement.csv");

if (!refreshOnly && !existsSync(path)) {
  console.error(`Can't find ${path}`);
  process.exit(1);
}

const activity = activityArg || "Janmashtami & Dahi Handi 2026";
const rows = refreshOnly ? [] : parseCsv(readFileSync(path, "utf8"));
if (!refreshOnly && rows.length < 2) {
  console.error("That file has no rows.");
  process.exit(1);
}

const columns = refreshOnly ? {} : detectColumns(rows[0]);
if (!refreshOnly && columns.amount === undefined) {
  console.error(
    `Couldn't find an amount column. Headers seen:\n  ${rows[0].join(" | ")}\n` +
      `Rename the amount column to something containing "amount" or "credit".`,
  );
  process.exit(1);
}

if (!refreshOnly) {
  console.log(`\nReading ${path}`);
  console.log("Columns detected:");
  for (const [key, index] of Object.entries(columns)) {
    console.log(`  ${key.padEnd(10)} -> "${rows[0][index].trim()}"`);
  }
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

if (!refreshOnly) {
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

}

if (!entries.length && !refreshOnly) {
  console.error("\nNothing to import.");
  process.exit(1);
}

if (refreshOnly && !writeDirect) {
  console.error("\n--refresh reads the database, so it needs --write too.");
  process.exit(1);
}

/* --------------------------------------------------- writing it directly */

/**
 * Inserts straight into Supabase, after asking.
 *
 * Uses the same duplicate test as the generated SQL — reference where the bank
 * gives one, otherwise name, amount and date — so the two routes cannot
 * disagree about what is already recorded.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY, which is read from .env.local and stays on
 * this machine.
 */
async function writeDirectly() {
  // .env.local isn't loaded automatically outside Next, so read it here.
  const envPath = join(process.cwd(), ".env.local");
  const env = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(`
  Can't write directly: the service key isn't on this machine.

  Add it to .env.local in this folder (it is gitignored, so it stays here):

    NEXT_PUBLIC_SUPABASE_URL=${url || "https://YOUR-PROJECT.supabase.co"}
    SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

  Get the secret key from Supabase → Project Settings → API Keys → Secret keys.
  Or drop --write and paste the SQL instead.
`);
    process.exit(1);
  }

  const rest = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };

  // The activity these belong to, created if this is the first import for it.
  let [act] = await rest(
    `activities?select=id&title=eq.${encodeURIComponent(activity)}&limit=1`,
  );
  if (!act) {
    [act] = await rest("activities", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        title: activity,
        category: "festival",
        starts_at: new Date().toISOString(),
        status: "planned",
        organiser: "Festival Committee",
      }),
    });
  }

  // Nothing to insert, so no member to attribute it to and no duplicate test
  // to run — just rewrite the file from what the database now holds.
  if (refreshOnly) {
    await refreshMasterList(rest, act.id, 0);
    return;
  }

  // Someone to attribute the entries to.
  let [member] = await rest("members?select=id&role=eq.admin&order=joined_at&limit=1");
  if (!member) {
    [member] = await rest("members", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name: "Festival Committee", role: "admin", status: "approved" }),
    });
  }

  // What is already recorded against this activity, so only new rows go in.
  const existing = await rest(
    `donations?select=donor_name,amount,received_at,reference&activity_id=eq.${act.id}&limit=5000`,
  );
  const seenRefs = new Set(existing.filter((d) => d.reference).map((d) => d.reference));
  const seenRows = new Set(
    existing.map((d) => `${d.donor_name}|${Number(d.amount).toFixed(2)}|${d.received_at}`),
  );

  const fresh = entries.filter((e) => {
    if (e.reference) return !seenRefs.has(e.reference);
    const name = e.name ?? "Anonymous (QR payment)";
    return !seenRows.has(`${name}|${e.amount.toFixed(2)}|${e.date}`);
  });

  console.log(`\n  already recorded ${entries.length - fresh.length}`);
  console.log(`  new to add       ${fresh.length}`);

  if (!fresh.length) {
    console.log("\n  Nothing new in this statement.");
    // Still refresh the file: cash entered in the app changes the list without
    // any import, so the master CSV would otherwise fall behind.
    await refreshMasterList(rest, act.id, 0);
    return;
  }

  if (!assumeYes) {
    const answer = await new Promise((res) => {
      process.stdout.write(`\n  Insert ${fresh.length} new entries? [y/N] `);
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (d) => res(String(d).trim().toLowerCase()));
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("  Nothing written.\n");
      process.exit(0);
    }
  }

  const now = new Date().toISOString();
  await rest("donations", {
    method: "POST",
    body: JSON.stringify(
      fresh.map((e) => ({
        donor_name: e.name ?? "Anonymous (QR payment)",
        wing: e.wing,
        flat: e.flat,
        amount: e.amount,
        method: "upi",
        reference: e.reference,
        received_at: e.date,
        note: e.source,
        activity_id: act.id,
        recorded_by: member.id,
        status: "verified",
        verified_by: member.id,
        verified_at: now,
      })),
    ),
  });

  await refreshMasterList(rest, act.id, fresh.length);
}

/**
 * Rewrites the master CSV from the database.
 *
 * Regenerated rather than appended to, because the database is the record: it
 * already holds the cash entries typed into the app, which no bank statement
 * will ever contain. Appending to the old file would quietly drift from what
 * residents see on the site, and the drift would only show up at an audit.
 */
async function refreshMasterList(rest, activityId, addedCount) {
  const rows = await rest(
    `donations?select=receipt_no,donor_name,wing,flat,amount,method,reference,received_at,status,note` +
      `&activity_id=eq.${activityId}&order=received_at.asc&limit=5000`,
  );

  const total = rows.reduce((t, d) => t + Number(d.amount), 0);
  console.log(`\n  added ${addedCount}`);
  console.log(`  ${activity} now stands at ${rows.length} entries, ${inr(total)}`);

  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula, so
  // a donor named "-Anil" would execute rather than display.
  const cell = (v) => {
    if (v === null || v === undefined) return "";
    let t = String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  const csv = [
    // "Transaction ID" rather than "Reference": it is the UPI reference or the
    // PhonePe id, and for the QR contributions that carry no name it is the
    // only thing a resident can recognise their own payment by.
    ["S.No", "Receipt No", "Name", "Flat No", "Amount (Rs.)", "Date", "Mode", "Source", "Transaction ID", "Status"]
      .map(cell)
      .join(","),
    ...rows.map((d, i) =>
      [
        i + 1,
        d.receipt_no,
        d.donor_name,
        [d.wing, d.flat].filter(Boolean).join("-"),
        Number(d.amount).toFixed(2),
        d.received_at,
        d.method,
        d.note ?? "",
        d.reference ?? "",
        d.status,
      ]
        .map(cell)
        .join(","),
    ),
    ["", "", "TOTAL", "", total.toFixed(2), "", "", "", "", ""].map(cell).join(","),
  ].join("\r\n");

  const target = csvPathArg
    ? resolve(csvPathArg.replace(/^~/, process.env.HOME ?? "~"))
    : join(dirname(path), "donation_list.csv");

  // A BOM, so Excel reads the rupee amounts and Indian names correctly.
  writeFileSync(target, `\ufeff${csv}`, "utf8");
  console.log(`  master list      ${target}\n`);
}

if (writeDirect) {
  await writeDirectly();
  process.exit(0);
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
-- Run in the Supabase SQL Editor. Safe to run every day: rows already present
-- are skipped, so re-importing a full statement only adds what is new.
--
-- How a duplicate is recognised:
--   * by transaction reference, where the statement gives one — a UTR is
--     unique, so this is exact;
--   * otherwise by name, amount and date together. Two genuinely separate
--     donations from the same person, for the same amount, on the same day
--     would be treated as one. That is rare, and under-counting once is
--     preferable to double-counting somebody's contribution every morning.
--
-- Read it before running. Everything the importer questioned was printed to
-- the console, not silently corrected.

do $$
declare
  v_activity uuid;
  v_admin    uuid;
  v_added    int;
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

  with incoming (donor_name, wing, flat, amount, method, reference, received_at, source) as (
    values
${values}
  ),
  inserted as (
    insert into public.donations
      (donor_name, wing, flat, amount, method, reference, received_at, note,
       activity_id, recorded_by, status, verified_by, verified_at)
    select i.donor_name, i.wing, i.flat, i.amount, i.method, i.reference, i.received_at,
           i.source, v_activity, v_admin, 'verified', v_admin, now()
    from incoming i
    where not exists (
      select 1
      from public.donations d
      where d.activity_id = v_activity
        and case
              when i.reference is not null and i.reference <> ''
                then d.reference = i.reference
              else d.donor_name = i.donor_name
                   and d.amount = i.amount
                   and d.received_at = i.received_at
            end
    )
    returning 1
  )
  select count(*) into v_added from inserted;

  raise notice 'Added % new entries (% in the file were already present).',
    v_added, ${entries.length} - v_added;
end;
$$;

-- Where the drive stands after this import.
select count(*) as entries,
       to_char(sum(amount), 'FM9,99,999.00') as total
from public.donations d
join public.activities a on a.id = d.activity_id
where a.title = ${sqlString(activity)};
`,
  "utf8",
);

console.log(`\n  written -> ${outFile}`);
console.log(`  next: open it, read it, then paste into the Supabase SQL Editor and Run.\n`);
