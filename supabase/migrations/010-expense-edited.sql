-- Migration 010 — record when a ledger entry was changed.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- The committee can now correct an entry: fix an amount typed wrong, add the
-- vendor's bill once it arrives. That is necessary — the alternative was
-- deleting the row and retyping it, which loses more than it fixes.
--
-- But a public ledger whose entries can change quietly is worth less than one
-- where the change shows. So an edit stamps the row, and the row says so. A
-- resident who looked last week can see that this line is not what they read.
--
-- Deliberately only a timestamp, not a full history. Who edited it would be
-- "the committee" every time — there is one shared login — so the column would
-- carry no information the stamp doesn't already.

alter table public.expenses
  add column if not exists updated_at timestamptz;

comment on column public.expenses.updated_at is
  'Set when an entry is corrected. Null means untouched since it was recorded.';

-- Part of the public row: the point is that residents see it.
grant select (updated_at) on public.expenses to anon;

-- Check: anon can read the stamp, still not the attachment key.
select column_name
  from information_schema.column_privileges
 where table_name = 'expenses' and grantee = 'anon'
 order by column_name;
