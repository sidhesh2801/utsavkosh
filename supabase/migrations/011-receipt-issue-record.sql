-- Migration 011 — record every receipt that gets written.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Until now the generator and the register were two systems that never spoke.
-- The register assigned each donation a receipt number by trigger and froze
-- it; the generator invented its own, counting up per device, and recorded
-- nothing anywhere. So nobody could answer "has this person already been given
-- a receipt", and nothing stopped a receipt being written for an amount the
-- society never received.
--
-- The fix is not a check bolted onto the generator. It is that a receipt is no
-- longer something a volunteer types — it is something the register issues,
-- against a payment it already holds. Then the amount cannot be wrong because
-- nobody enters it, and a second receipt cannot be issued because the first
-- one is recorded here.

alter table public.donations
  -- How many times a receipt has been produced for this donation. The first is
  -- the original; any after it are re-issues and print as duplicates, because
  -- a lost receipt is a real thing and refusing to reprint would only push the
  -- volunteer back to writing one by hand.
  add column if not exists receipt_issues integer not null default 0;

comment on column public.donations.receipt_issues is
  'Receipts produced for this donation. 0 = none yet, 1 = original, 2+ = re-issued.';

-- Backfill: anything already marked as sent had one produced.
update public.donations
   set receipt_issues = 1
 where receipt_sent_at is not null and receipt_issues = 0;

-- Residents may see that a receipt exists — it is their own proof, and the
-- donations list already shows a Receipt column. The count is not sensitive;
-- withholding it would only mean the column reads "Not yet" for everyone.
grant select (receipt_issues, receipt_sent_at) on public.donations to anon;

-- Check: how many donations have a receipt against them.
select
  count(*) filter (where receipt_issues = 0) as none_yet,
  count(*) filter (where receipt_issues = 1) as issued_once,
  count(*) filter (where receipt_issues > 1) as re_issued
from public.donations;
