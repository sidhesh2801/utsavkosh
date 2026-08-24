# UtsavKosh

**UtsavKosh** (उत्सव कोष — “festival treasury”) is a web app for a housing society to run its cultural activities and its money in the open:
donations received, exactly where the funds were spent, what's planned next, and a photo
gallery of every celebration.

Running for **Wellington — Pride World City**, Charholi Budruk, Pune.

**Running it day to day — daily imports, cash entries, passwords, current
state: [OPERATIONS.md](OPERATIONS.md).**

---

## Running it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

### Who signs in, and who doesn't

**Residents need no account.** They read the donations list and the ledger with
no login — that is the point of the app, and requiring 1800 signups would have
killed it before the first festival.

**The committee has one password**, covering the receipt generator, adding a
cash donation, and adding or removing a ledger entry. Set `GENERATOR_PASSWORD`
in the environment; unset, it falls back to `admin`.

| Route | Login |
|---|---|
| `/`, `/donations`, `/ledger`, `/activities`, `/gallery` | none |
| `/receipt-generator.html` | committee password |
| Adding a donation or expense | committee password |

`/collect`, `/admin` and `/login` are from an earlier design that used Supabase
Auth accounts. No such accounts exist, so those screens are unreachable in
practice and are candidates for removal.

---


## What's in it

- **Funds** — every donation and every expense, itemised with vendor, bill number and who
  entered it. Charts for money in/out per month, spending by category and by activity.
- **Collection drive** — several volunteers record door-to-door collections from their own
  phones at the same time. Each entry is *pending* until the treasurer confirms the
  handover, so **the balance never claims cash the society isn't holding.**
- **The doorstep flow** — pick wing + flat (name and mobile autofill from the register),
  enter the amount, show the society's **payment QR** for UPI, **photograph the proof**
  (paper receipt stub, or their "payment successful" screen), then send the numbered
  **receipt on WhatsApp**. "Next flat" resets without leaving the screen.
- **Tenants** — the register holds the owner, but a tenant often pays. Tick *tenant* and
  their own name goes on the receipt instead of the owner's.
- **Activities** — what's planned, the approved budget, and actual spend against it.
- **Photo gallery** — albums per event; uploads are downscaled to 1600px automatically.
- **Transparency report** — a printable statement of account for a general body meeting.
- **WhatsApp sharing** — composes a ready-made update for the society group (see below).
- **Installable** — residents can "Add to Home Screen" and it opens like an app.

- **Receipt lookup** — a resident who lost the WhatsApp message searches by receipt number
  or flat and gets the whole receipt back, no login.

---

## Where the data lives

A hosted Postgres database (Supabase), so what one committee member records,
every resident sees. `supabase/schema.sql` creates the tables, row-level
security and storage buckets and is safe to re-run; `supabase/migrations/`
holds the changes since, in order.

Without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app
falls back to storing everything in the visitor's own browser. That is a
development convenience, not a mode to deploy in — each visitor would get their
own private copy.

**Day-to-day operation — daily statement imports, cash entries, credentials,
current state — is in [OPERATIONS.md](OPERATIONS.md).**


### How the security works

Roles are enforced by Postgres, not the browser, so tampering with the client changes
nothing:

- A **volunteer** can insert a donation only with `recorded_by` set to themselves, and only
  with `status = 'pending'`. The UPDATE policy's `WITH CHECK` pins their own rows to
  `pending`, so **a volunteer cannot mark their own cash as handed over.**
- **Guests** (`anon`) read only the *columns* that belong on a notice board:
  amounts, dates, names and flats. `donor_mobile`, the free-text `note` and the
  payment screenshots are revoked. This is why the app selects explicit column
  lists — a `select *` fails outright for a signed-out visitor.
- **Receipt numbers are issued by a database trigger**, not the client. With thirty
  volunteers saving at once, two browsers computing "highest + 1" would hand out the same
  number; the trigger's atomic upsert keeps the series gapless. A second trigger makes a
  receipt number immutable once issued.
- **Gallery images are public; proof images are not.** A UPI confirmation screenshot can
  carry the payer's name, handle and phone, so the `proofs` bucket is private and served
  through short-lived signed URLs to staff only.
- Deleting an activity with money against it is refused by a foreign key, not by a check
  the client could skip.

## Notes on the design

The code is written for this swap. All reads and writes go through one place —
[`src/lib/store.tsx`](src/lib/store.tsx) — and the domain types in
[`src/lib/types.ts`](src/lib/types.ts) map 1:1 to Postgres tables. The photo split in
[`src/lib/idb.ts`](src/lib/idb.ts) (records separate from image blobs) is already the
shape Supabase Storage wants.

What changes:

| Now | With Supabase |
|---|---|
| IndexedDB | Postgres tables (`members`, `activities`, `donations`, `expenses`, `albums`, `photos`) |
| Passwords in a seed file | Supabase Auth (hashed server-side, password reset emails) |
| Image data URLs | Supabase Storage bucket |
| `BroadcastChannel` (one device) | Supabase Realtime (every phone, instantly) |
| Role checks in the client | Postgres **Row Level Security** — enforced by the database |

That last row matters: today a determined visitor could edit their own browser copy. With
RLS the rules ("only admins insert expenses", "volunteers cannot verify their own
handovers") are enforced server-side and cannot be bypassed from the client.

Cost: **₹0** on Supabase's free tier at society scale (500 MB database, 1 GB photos).
Note free projects pause after 7 days of *zero* activity and need one click to restore.

---

## Deploying

```bash
npm run build        # verify it compiles first
```

Then, once:

1. Push this folder to a **GitHub** repo.
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New Project** →
   pick the repo → **Deploy**. No configuration needed; Vercel detects Next.js.
3. You get a URL like `utsavkosh.vercel.app`. Share that in the society group.

Free tier is comfortably enough for a few hundred residents. A custom domain
(`yoursociety.in`, ~₹800/year) can be pointed at it later from Vercel → Settings → Domains.

### Icons

`public/icon.svg` is used for the home-screen icon. iOS prefers PNG for
`apple-touch-icon` — export a 180×180 and a 512×512 PNG from that SVG and add them to
`src/app/manifest.ts` when you want the crispest result on iPhone.

---

## WhatsApp updates — what is and isn't possible

The app composes a formatted update and hands it to WhatsApp; you pick the society group
and send. One tap, no typing.

**Automatic posting into a WhatsApp group is not possible legitimately.** WhatsApp's
official Cloud API does not support group messaging at all. Libraries that automate groups
(`whatsapp-web.js`, Baileys) impersonate WhatsApp Web, violate the terms, and get phone
numbers permanently banned — not worth risking on the secretary's number.

If you later want genuine automation, the supported route is Meta's Cloud API sending to
residents **individually** (~₹0.15/message, first 1,000 conversations/month free), which
needs Meta business verification and template approval. Message bodies already live in
[`src/lib/messages.ts`](src/lib/messages.ts), so they'd be reused as templates.

---

## Design notes

- Chart colours are **not** the credit-green/debit-red pair. Green-vs-red cannot clear the
  red-green colourblindness threshold, and red for expenses implies alarm when spending on
  a festival is the whole point. The emerald/marigold pair used instead passes contrast,
  chroma and CVD-separation checks (ΔE 11.1) against white.
- Money uses Indian digit grouping (₹1,85,000, not ₹185,000) and tabular figures in
  columns so numbers line up.
- Everything is keyboard reachable; charts each have a table view so no value is
  hover-only.

## Project layout

```
src/lib/types.ts       domain model (mirrors the future DB schema)
src/lib/store.tsx      the only place data is read or written
src/lib/finance.ts     all money maths, pure functions
src/lib/messages.ts    WhatsApp message composers
src/lib/seed.ts        sample society data
src/components/        UI primitives, charts, forms, gallery
src/app/(app)/         signed-in screens
src/app/login/         sign in / register
```
