# Running UtsavKosh

Everything a committee member — or a fresh assistant session — needs to operate
this. Read `README.md` for what the app *is*; this is how it's *run*.

Society: **Wellington — Pride World City**, Charholi Budruk, Pune.

---

## Live URLs

| | |
|---|---|
| The app | https://utsav-reciept-generator.vercel.app |
| Donations (public) | `/donations` |
| Ledger (public) | `/ledger` |
| Receipt generator | `/receipt-generator.html` — password |
| Supabase project | `hnszgpoxxgpymybadcct` |

The project name contains a typo (`reciept`). Renaming it changes the URL and
breaks saved links, so it stays until someone decides to take that hit.

---

## Who can do what

**Residents** need no account. They read the donations list, the ledger and the
activities. They cannot change anything, and there's nothing for them to sign
into.

**The committee** has one password, covering three things: the receipt
generator, adding a cash donation, and adding or removing a ledger entry. A
session lasts 12 hours per device.

Default is `admin` / `admin`. Override it by setting `GENERATOR_USER` and
`GENERATOR_PASSWORD` in Vercel — the code reads those and falls back to the
default only when they're unset.

There is a second, older login (`/login`, Supabase Auth) left over from an
earlier design. Nothing uses it; no accounts exist in it.

---

## The daily job

Money arrives two ways, so there are two routes in.

### Bank and QR — import the statement

Whoever sends the statement should send **CSV or Excel, not password
protected**. A locked PDF cannot be opened; an unlocked PDF has no real columns,
so amounts land against the wrong names.

```bash
npm run import-donations -- ~/Downloads/statement.csv "Janmashtami & Dahi Handi 2026" --write
```

It prints a report, then asks before writing:

```
  entries          116
  total            Rs 81,240.00
  stated total     Rs 81,240.00
  reconciles       yes
  already recorded 104
  new to add       12

  Insert 12 new entries? [y/N]
```

Drop `--write` and it writes SQL to `supabase/migrations/` to paste into the
Supabase SQL Editor instead. Same duplicate logic either way.

**Re-running any statement is safe** and is the point: it adds only what's new,
so re-importing a whole month proves the ledger matches the bank. Duplicates are
caught on the transaction reference where the bank gives one, otherwise on name
+ amount + date together.

### PhonePe QR — import the merchant export, not the bank line

The bank shows QR money as three or four lump `NEFT … PHONEPE LIMITED`
settlements. **Never import those.** They are the same contributions the
merchant export lists one by one, and taking both records every payment twice.

Get the export from **PhonePe Business → Transactions → download**, as CSV. It
arrives named `M22V4M40T0EIO_FORWARD_TRANSACTION_<digits>.csv`.

```bash
node --env-file=.env.local scripts/import-phonepe.mjs \
  ~/Downloads/M22V4M40T0EIO_FORWARD_TRANSACTION_*.csv \
  "Janmashtami & Dahi Handi 2026" --write
```

A separate script from the statement importer, because three things differ and
each one has already caused a wrong number:

- **`Transaction Status` — about one row in twenty is `ERRORED`.** A failed
  payment. A bank statement never shows these because no money moved, so the
  statement importer has no idea they exist. Four of them once went in as
  donations, Rs 3,202 nobody gave, on rows with no name to notice it by. The
  script drops them, and reports any already recorded so they can be removed.
- **Every payment has two ids** — the PhonePe transaction id (`T2608…`) and the
  bank UTR. The same contribution appears under the T-id here and under the UTR
  on the statement, so the duplicate check tries both. Two payments were once in
  twice for exactly this reason.
- **No payer name.** PhonePe does not pass one to the merchant; `Store Name` is
  the society's own account, not the donor. Every row lands as
  `Anonymous (QR payment)` and residents claim their own from the WhatsApp list
  by amount, date and the last four digits.

The export reconciles against the bank by settlement, one day later: completed
payments dated the 23rd equalled the settlement received on the 24th, to the
rupee. That check is worth running whenever a total looks wrong.

### Deleting a donation — it comes back unless you say so

A removed row is recorded nowhere, so the next import puts it straight back.
Add its transaction id (and its UTR, if the bank has one) to
**`scripts/excluded-transactions.txt`**, with a note saying why. Both importers
read it. Without that line, a routine job quietly undoes the committee's
decision.

### Cash — enter it in the app

Cash never reaches a statement, so it has to be typed:

**Sign in → Donations → Add cash donation**

It refuses an entry matching one already recorded, using the same test the
import uses, so a cash entry typed at noon can't double up when the statement
imports at night.

Cash entries are the reason a total can move without any import having run —
worth remembering before treating a changed figure as a bug.

### After any change — rebuild what people read

The database is the record; these two are generated from it and drift silently
otherwise. Run both after an import, a cash entry or a deletion:

```bash
# donation_list.csv, from the register rather than from the statement
npm run import-donations -- --refresh --write --csv ~/Downloads/donation_list.csv

# the WhatsApp donor list and the QR claim sheet
node --env-file=.env.local scripts/build-donor-message.mjs
```

The WhatsApp message is written three times over — Marathi, Hindi, English — so
it is generated, never edited by hand. It had already drifted once, still
showing 104 donors and Rs 74,344 when the app held 175 and Rs 1,23,355.

### Spending

**Sign in → Ledger → Add expense.** Vendor and bill number are public; the
paper bill should be kept.

### Receipts

**Write a receipt →** fill in flat / name / amount → send on WhatsApp, save the
image, or print. Numbers itself per Indian financial year (`WPC/2026-27/0001`)
and counts up per device.

Numbering is per-device, so **give each volunteer a different starting range**
(1001, 2001, 3001…) or several will issue receipt 0001.

---

## Where the credentials live

| Secret | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env vars, and `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same — public by design, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars, and `.env.local` for `--write` |
| `GENERATOR_PASSWORD` | Vercel env vars (unset = `admin`) |

`.env.local` is gitignored and never leaves the machine.

**Environment variable changes only reach a new build.** Saving one in Vercel
does nothing until you redeploy — this cost an afternoon once, when a correctly
saved key kept reading as absent.

---

## How the security actually works

Enforced by Postgres, not the browser:

- **Guests read the money, not the people.** Column-level `GRANT`s give `anon`
  the amounts, dates, names and flats, and withhold `donor_mobile`, the
  free-text `note` and the payment screenshots. This is why the app selects
  explicit column lists rather than `select *` — a `select *` fails for a
  signed-out visitor.
- **Receipt numbers come from a database trigger**, not the client. Thirty
  volunteers computing "highest + 1" would collide. A second trigger makes an
  issued number immutable.
- **Gallery images are public; proof photos are not.** A UPI screenshot carries
  the payer's name and handle, so those sit in a private bucket behind
  short-lived signed URLs.
- **Committee writes go through server routes** (`/api/expenses`,
  `/api/donations`) using the service key, because the committee login is the
  app's own rather than a Supabase Auth account. Every request is re-checked
  there — the hidden buttons are a courtesy, not the control.
- `robots: noindex` — the ledger is open to anyone with the link, but not
  published to search engines.

---

## Current state

- **104 donations, ₹74,344.00** imported for Janmashtami & Dahi Handi 2026,
  reconciled exactly against the committee's own total.
- 69 named (bank UPI), 35 anonymous (PhonePe QR — the bank recorded no name).
- Five ₹1.00 entries are almost certainly QR tests. Kept, because they are real
  lines on the bank statement and the ledger has to reconcile with it.
- `Harshad` appears twice (₹1,111 and ₹501, different days). Two people or one
  person twice — left as recorded for the committee to judge.
- Bank names are truncated to eight characters. Title-cased, not completed.

---

## Loose ends

- `/api/diagnose` is a debugging route that reports configuration to anyone with
  the committee password. It solved a real problem and should be deleted once
  nobody needs it.
- `public/receipt-template.png` is a recreation of the committee's artwork, not
  their actual file. `public/stamp.png` *is* their real stamp.
- The `/collect` screen and the Supabase Auth login are from the earlier design
  and are currently unreachable in practice — no Auth accounts exist.

---

## Repository layout

```
scripts/import-donations.mjs    statement → report → SQL or direct write
scripts/import-phonepe.mjs      PhonePe merchant export → report → write
scripts/build-donor-message.mjs register → WhatsApp list + QR claim sheet
scripts/excluded-transactions.txt  payments the committee removed for good
public/receipt-generator.html   the generator: one self-contained file
src/app/api/                    committee-only writes, session checks
src/components/funds-view.tsx   the donations table and the ledger
src/lib/supabase/               all database access
supabase/schema.sql             tables, RLS, storage buckets — safe to re-run
supabase/migrations/            changes since, in order
```
