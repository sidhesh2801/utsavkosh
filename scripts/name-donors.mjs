#!/usr/bin/env node
/**
 * Puts names on QR contributions, matched by UTR.
 *
 *   node --env-file=.env.local scripts/name-donors.mjs names.txt            # report
 *   node --env-file=.env.local scripts/name-donors.mjs names.txt --write
 *
 * The merchant export carries no payer name — twenty-one columns and the only
 * names in it are the society's own account and the terminal. The PhonePe app
 * does show the payer, so the names have to be read off the screen and matched
 * back. This does the matching, because doing it by eye across a hundred and
 * eighty contributions of mostly Rs 501 is how the wrong name ends up on
 * somebody's receipt.
 *
 * Input is one per line, in any of these shapes — whatever is easiest to type
 * from a screenshot:
 *
 *   129099855311  Rajashree Kailas
 *   Rajashree Kailas, 129099855311
 *   UTR: 129099855311 | Rajashree Kailas | 1001
 *
 * A UTR is twelve digits; anything else on the line is taken as the name.
 *
 * Refuses to overwrite a name that is already there. A row named from the bank
 * statement was named by the bank, and a screenshot read in a hurry is not a
 * reason to replace it — those are reported instead, for a person to settle.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const write = args.includes("--write");
const [fileArg] = args.filter((a) => !a.startsWith("-"));

if (!fileArg) {
  console.error(`
Usage:
  node --env-file=.env.local scripts/name-donors.mjs <names.txt> [--write]

  One per line: a 12-digit UTR and a name, in either order.
`);
  process.exit(1);
}

const path = resolve(fileArg.replace(/^~/, homedir()));
if (!existsSync(path)) {
  console.error(`Can't find ${path}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ input */

const entries = [];
const unreadable = [];

for (const [i, raw] of readFileSync(path, "utf8").split(/\r?\n/).entries()) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;

  const utr = line.match(/\b\d{12}\b/);
  if (!utr) {
    unreadable.push({ line: i + 1, text: line, why: "no 12-digit UTR" });
    continue;
  }

  // Everything that isn't the UTR, an amount, a time, or one of the words the
  // app prints around a payment. Those words look like part of a name once the
  // line is flattened — the first pass at this recorded a donor as
  // "Someone New QR".
  const name = line
    .replace(utr[0], " ")
    .replace(/\bUTR\b:?/gi, " ")
    .replace(/₹\s*[\d,]+(\.\d+)?/g, " ")
    .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/gi, " ")
    .replace(/\b\d[\d,]*(\.\d+)?\b/g, " ")
    .replace(
      /\b(QR|UPI|RCC|Settled|Settlement|Pending|Failed|Completed|Errored|G\s*Pay|GPay|PhonePe|Paytm|Wallet|Terminal|Credited|Received)\b/gi,
      " ",
    )
    // A truncated name in the app ends in an ellipsis; keep the name, drop that.
    .replace(/[.…]{2,}/g, " ")
    .replace(/[|,;•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) {
    unreadable.push({ line: i + 1, text: line, why: "no name found" });
    continue;
  }
  // A payment made from the PhonePe app shows the payer as masked digits —
  // "********7781" — rather than a name. There is nothing there to record, and
  // writing it would put a row of asterisks on somebody's receipt.
  if (/^[*x\s]*\d*$/i.test(name) || (name.match(/\*/g) ?? []).length >= 3) {
    unreadable.push({ line: i + 1, text: line, why: "payer is masked, not a name" });
    continue;
  }
  entries.push({ line: i + 1, utr: utr[0], name });
}

/* ------------------------------------------- UTR -> PhonePe transaction id */

/**
 * The register stores whichever reference the source gave it: a bank RRN for
 * the rows that came off the statement, a T-id for the rows that came from the
 * merchant export. The app shows the UTR, so one has to be translated into the
 * other, and the export is the only thing that knows both.
 */
const byUtr = new Map();
const downloads = join(homedir(), "Downloads");
if (existsSync(downloads)) {
  const exports_ = readdirSync(downloads).filter((f) => /FORWARD_TRANSACTION.*\.csv$/.test(f));
  for (const f of exports_) {
    const lines = readFileSync(join(downloads, f), "utf8").trim().split(/\r?\n/);
    const head = lines[0].split(",").map((h) => h.trim());
    const iUtr = head.indexOf("Transaction UTR");
    const iTxn = head.indexOf("PhonePe Reference Id");
    if (iUtr < 0 || iTxn < 0) continue;
    for (const l of lines.slice(1)) {
      const p = l.split(",");
      const utr = (p[iUtr] ?? "").trim();
      const txn = (p[iTxn] ?? "").trim();
      if (utr && txn) byUtr.set(utr, txn);
    }
  }
  console.log(`Read ${exports_.length} PhonePe export(s): ${byUtr.size} UTRs mapped\n`);
}

/* --------------------------------------------------------------- matching */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const { data: rows, error } = await db
  .from("donations")
  .select("id, receipt_no, donor_name, amount, received_at, reference")
  .limit(5000);
if (error) {
  console.error(error.message);
  process.exit(1);
}

const byReference = new Map();
for (const r of rows) if (r.reference) byReference.set(String(r.reference), r);

const isAnon = (r) => String(r.donor_name).includes("QR");

const toName = [], alreadyNamed = [], notFound = [];

for (const e of entries) {
  const row = byReference.get(e.utr) ?? byReference.get(byUtr.get(e.utr) ?? "");
  if (!row) { notFound.push(e); continue; }
  if (!isAnon(row)) { alreadyNamed.push({ ...e, row }); continue; }
  toName.push({ ...e, row });
}

const money = (n) => `Rs ${Number(n).toLocaleString("en-IN")}`;

console.log(`  read from the file   ${entries.length}`);
console.log(`  will be named        ${toName.length}`);
console.log(`  already have a name  ${alreadyNamed.length}`);
console.log(`  no matching payment  ${notFound.length}`);
console.log(`  lines I couldn't read ${unreadable.length}`);

if (toName.length) {
  console.log(`\n  to name:`);
  for (const t of toName) {
    console.log(`     ${t.row.receipt_no}  ${t.row.received_at}  ${money(t.row.amount).padStart(11)}  ${t.name}`);
  }
}
if (alreadyNamed.length) {
  console.log(`\n  already named — left alone, check if these disagree:`);
  for (const a of alreadyNamed) {
    console.log(`     ${a.row.receipt_no}  recorded as "${a.row.donor_name}"  screenshot says "${a.name}"`);
  }
}
if (notFound.length) {
  console.log(`\n  no payment with that UTR — not imported yet, or a typo:`);
  for (const n of notFound) console.log(`     line ${n.line}: ${n.utr}  ${n.name}`);
}
if (unreadable.length) {
  console.log(`\n  couldn't read:`);
  for (const u of unreadable) console.log(`     line ${u.line}: ${u.why} — ${u.text}`);
}

if (!write) {
  console.log(`\n  Nothing written. Re-run with --write to apply.\n`);
  process.exit(0);
}
if (!toName.length) {
  console.log(`\n  Nothing to do.\n`);
  process.exit(0);
}

let done = 0;
for (const t of toName) {
  const { error: bad } = await db
    .from("donations")
    .update({ donor_name: t.name })
    .eq("id", t.row.id);
  if (bad) console.log(`     FAILED ${t.row.receipt_no}: ${bad.message}`);
  else done++;
}

const after = (await db.from("donations").select("donor_name, amount").limit(5000)).data ?? [];
const anon = after.filter((r) => String(r.donor_name).includes("QR"));
console.log(`\n  named ${done}`);
console.log(
  `  register: ${after.length} donations, ${after.length - anon.length} named, ` +
    `${anon.length} still anonymous (${money(anon.reduce((t, r) => t + Number(r.amount), 0))})`,
);
console.log(`\n  now rebuild what people read:`);
console.log(`     npm run import-donations -- --refresh --write --csv ~/Downloads/donation_list.csv`);
console.log(`     node --env-file=.env.local scripts/build-donor-message.mjs\n`);
