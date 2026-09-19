# Running UtsavKosh

Everything a committee member — or a fresh assistant session — needs to operate
this. Read `README.md` for what the app *is*; this is how it's *run*.

Society: **Wellington — Pride World City**, Charholi Budruk, Pune.

---

## Live URLs

| | |
|---|---|
| The app | https://utsavkosh.vercel.app |
| Donations (public) | `/donations` |
| Ledger (public) | `/ledger` |
| Receipt generator | `/receipt-generator.html` — password |
| Supabase project | `hnszgpoxxgpymybadcct` |

The society uses **utsavkosh.vercel.app**. A second Vercel project,
`utsav-receipt-generator`, serves the same repo against the same database at
`utsav-reciept-generator.vercel.app` — note the `reciept` typo in that domain.
It is the address that was shared first, so it is kept alive but paused; every
link handed out from September 2026 uses utsavkosh.

Two live copies is how the committee password once ended up changed on one and
not the other. If both are running, every environment change has to be made
twice.

---

## Who can do what

**Residents** need no account, and they see one page: **`/donations`**. Their
own receipt opens from it. Everything else — the home page, the ledger, the
festival pages, the activities, the gallery, food coupons, the receipt
generator — needs the committee password, and any other address redirects to
the donations list rather than showing an error.

Set that way on the committee's instruction in September 2026, after the
festival. Spending and the balance are hidden with it: five of the nine
expenses still have no bill against them, and a spending figure with nothing
behind it invites the question it cannot answer. Opening it back up is a
matter of shortening `OPEN_TO_ALL` in `src/middleware.ts`.

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

### Naming a QR contribution

The merchant export has twenty-one columns and the payer is not one of them —
the only names in it are `Shivanu`, the society's own account, and
`Terminal 1` to `Terminal 10`. So every QR row imports as
`Anonymous (QR payment)`, and no care with the import can change that.

**The PhonePe app does show the payer.** Open a transaction in PhonePe Business
and the name is on screen next to the UTR. So the names exist; they just have
to be read off and matched back.

Screenshot the transaction list into `reciept-ss/`, then read them without
typing anything — macOS has text recognition built in:

```bash
swiftc -O scripts/ocr-screenshots.swift -o /tmp/ocr
/tmp/ocr reciept-ss/*.jpeg > /tmp/raw.txt
```

Then pair each name with the UTR beneath it and feed the result to the matcher:

```bash
python3 scripts/read-screenshots.py /tmp/raw.txt > /tmp/names.txt
node --env-file=.env.local scripts/name-donors.mjs /tmp/names.txt --write
```

Thirty-three screenshots — 184 payments — took seconds this way. Move them to
`reciept-done/` afterwards, so whatever is left in `reciept-ss/` is what still
needs doing.

Or type the lines into a file by hand:

```bash
node --env-file=.env.local scripts/name-donors.mjs ~/Downloads/names.txt          # report
node --env-file=.env.local scripts/name-donors.mjs ~/Downloads/names.txt --write
```

A line needs a 12-digit UTR and a name, in either order. Pasting the app's own
messy line works — `09:15PM • Anita Sharma... UTR: 660917288476 | QR ₹1,100
Settled` reads as *Anita Sharma*, because the amount, the time and the words
the app prints around a payment are stripped. It matches by UTR, translating
to the PhonePe transaction id through the export where a row was stored under
that instead.

It will not overwrite a name already there. A row named from the bank statement
was named by the bank; a screenshot read in a hurry is not a reason to replace
it, so those are reported for a person to settle. Then rebuild what people read.

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

### The thanks page and its photos

**`/volunteers`** is open for anyone to read. Writing needs a sign-in, but not
the committee's: there is a second password, `volunteer` / `volunteer@2026`
(override with `VOLUNTEER_USER` and `VOLUNTEER_PASSWORD`), which opens that one
page and nothing else. Hand it round the volunteers' group and each person adds
their own name, what they helped with, and a line or two about how. No approval
step — what they write is published as they write it — and they can edit or
remove their own entry.

Whatever someone types in *What you helped with* becomes the heading they
appear under, so a new kind of job starts a new section on the page.

Each person can attach their own photo to their credit. Optional — where
there's none, their initial stands in.

**The photo wall** above the names is all uploaded through the app. Anyone
signed in taps *Add photos*, picks as many as they like, and they are on the
page; each tile then carries a small × to take it down again. `.jpg .jpeg .png
.webp .heic`, 10 MB a photo, 200 in the bucket.

There used to be a second source — a `public/collage/` folder read at build
time — and it was removed. Half the wall could be added to and not deleted,
with nothing on screen explaining which half, which reads as a broken button
rather than a rule. The sixteen photographs that were in it were uploaded to
the bucket like everyone else's. They are still in git history if the bucket
is ever emptied by accident.

Both buckets (`collage`, `faces`) are **public**, which is the point — an image
behind a URL that expires is an image that stops loading. So nothing private
should go in them, and a URL that has been shared keeps working after the photo
is removed from the page.

Sign out from the bottom of the thanks page. Worth mentioning when handing the
password out: it is shared, so the app knows *a* volunteer did something and
never *which*, and anyone holding it can edit or remove anyone else's entry.

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

## Keeping it awake

Supabase pauses a free project after about a week with no queries, and this
app is quiet between festivals. It happened once: the site was closed for
twelve days and the database was gone on return — nothing lost, but it needed
a manual restore in the Supabase dashboard before anything worked.

`vercel.json` runs a daily cron against `/api/health`, which counts a row and
so keeps both Supabase and Vercel warm. The route is public and reports only
that count. It answers 503 when the database is unreachable, so a sleeping
project shows up to a monitor rather than to a resident.

Cron runs on whichever Vercel project is live. If that project is ever paused,
nothing pings, and the database will sleep again about a week later.

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

**And redeploy without the build cache.** Next compiles `process.env` values
into the Edge bundle, so a redeploy that reuses the cache ships the old value:
the setting is gone from every screen and the deployed app still behaves as
though it were there. Untick *Use existing Build Cache*, or push a commit,
which always builds clean. Both the maintenance switch and the committee
password have failed this way.

**There are two Vercel projects**, `utsav-receipt-generator` and `utsavkosh`,
both deploying this repo and both pointing at the same database. Any
environment change has to be made on both, or half the doors keep the old
behaviour. The one residents use is `utsav-receipt-generator` — note that its
domain carries the `reciept` typo while the project name does not.

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

- **279 donations, ₹2,04,233** for Janmashtami & Dahi Handi 2026.
- 275 named, 4 still anonymous (₹4,002). Those four were paid from the PhonePe
  app, which shows the payer as masked digits — `********7781` — so there is
  no name to read even on screen. That is the floor, not an outstanding task.
- Every name taken from a screenshot has been checked back against the
  screenshots: 180 comparable rows, 180 agreements, no disagreement.
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
scripts/name-donors.mjs         UTR + name from a screenshot → names on rows
scripts/ocr-screenshots.swift   macOS text recognition, so the screenshots
                                need not be read by hand
scripts/read-screenshots.py     that text → UTR-and-name lines
scripts/backup.mjs              the whole register to ~/Downloads, CSV + JSON
scripts/excluded-transactions.txt  payments the committee removed for good
public/receipt-generator.html   the generator: one self-contained file
src/app/api/                    committee-only writes, session checks
src/components/funds-view.tsx   the donations table and the ledger
src/lib/supabase/               all database access
supabase/schema.sql             tables, RLS, storage buckets — safe to re-run
supabase/migrations/            changes since, in order
```
