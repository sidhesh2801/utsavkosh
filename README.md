# UtsavKosh

**UtsavKosh** (उत्सव कोष — “festival treasury”) is a web app for a housing society to run its cultural activities and its money in the open:
donations received, exactly where the funds were spent, what's planned next, and a photo
gallery of every celebration.

Set up for **Wellington — Pride World City** (with sample data) — replace it with your own records
from **Manage → Starting with your own society**.

---

## Running it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

### Who signs in, and who doesn't

**Only two kinds of account exist.** Residents have no login at all — with 1800 flats,
requiring 1800 signups (and an approval queue for the committee to work through) would
kill adoption before the first festival.

| | Signs in? | Can do |
|---|---|---|
| **Committee admin** — `secretary@wellingtonpwc.in` | Yes | Everything: funds, expenses, activities, gallery, payment QRs, members |
| **Volunteer** — `vikram.c@example.com` | Yes | Record collections and issue receipts. Cannot edit expenses, delete entries, or verify their own handovers |
| **Resident / anyone with the link** | **No account needed** | View the accounts, gallery and activities, and look up their own receipt |

Password for both sample accounts: `demo1234` — the login screen has buttons that fill
them in.

**Public routes:** `/`, `/funds`, `/funds/report`, `/activities`, `/gallery`, `/receipt`.
**Login required:** `/collect`, `/admin`.

A public ledger means donor names and amounts sit on a URL anyone with the link can open.
That mirrors the chanda list going up on the notice board, but a search engine is a
different matter — so the app sends `robots: noindex`. If a resident objects to their name
being visible, the next step would be masking names behind flat numbers on the public view.

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

## ⚠️ Current state of the data — read this before deploying

Right now all data lives **in each visitor's own browser** (IndexedDB). That's ideal for
trying the app out, but it means:

> If you deploy this as-is and send the link to 50 residents, **each of them gets their own
> private copy.** Nobody sees anybody else's entries. It is not yet a shared register.

Live updates currently work **across tabs on one device** (via `BroadcastChannel`) — enough
to see the behaviour with two windows side by side.

**To make it a real shared app**, the data layer needs a hosted database. See below.

---

## Making it multi-user (Supabase)

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
