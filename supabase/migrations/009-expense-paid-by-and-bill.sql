-- Migration 009 — who paid the vendor, and the proof.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Two additions to the ledger:
--
--   paid_by    the committee member who actually handed over the money. The
--              ledger already records who *entered* the row; that is not the
--              same person, and "who is out of pocket" is the question asked
--              at every reimbursement.
--
--   bill_path  a photo of the vendor's bill or the payment confirmation.
--
-- The photo is deliberately NOT public. A UPI confirmation screenshot carries
-- the payer's own name, handle and often their balance — publishing it to make
-- the committee's spending transparent would expose a committee member's bank
-- details to 1800 flats. So the file sits in a private bucket behind a
-- short-lived signed URL, exactly like the donation proof screenshots, and
-- residents see only that a bill is on file. They can ask to see it; the bill
-- number in the public row is what lets them ask for the right one.

alter table public.expenses
  add column if not exists paid_by   text,
  add column if not exists bill_path text;

comment on column public.expenses.paid_by is
  'Who handed the money to the vendor. Public.';
comment on column public.expenses.bill_path is
  'Object key in the private "bills" bucket. Never granted to anon.';

-- Lets a resident see that proof exists without exposing where it lives.
alter table public.expenses
  add column if not exists has_bill boolean
  generated always as (bill_path is not null) stored;

-- ------------------------------------------------------------- grants ------
--
-- Until now anon held a blanket select on this table, so a new column would
-- have been public the moment it was added. Replaced with an explicit list:
-- everything the ledger shows, and not bill_path.
--
-- NOTE: this is why src/lib/supabase/repo.ts must select expense columns by
-- name. A `select *` asks for bill_path too and fails for a signed-out
-- visitor — the same trap the donations table already carries.

revoke select on public.expenses from anon;

grant select (
  id, title, category, amount, vendor, activity_id, paid_at, method,
  bill_no, note, paid_by, has_bill, recorded_by, created_at
) on public.expenses to anon;

-- ------------------------------------------------------------ storage ------

insert into storage.buckets (id, name, public)
values ('bills', 'bills', false)
on conflict (id) do update set public = false;

-- Writes go through /api/expenses/attachment with the service key, which
-- bypasses these. They matter for anyone reaching the bucket with a user
-- token, and they say the same thing: staff only, never anon.
drop policy if exists bills_staff_read on storage.objects;
create policy bills_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'bills' and public.is_staff());

drop policy if exists bills_staff_write on storage.objects;
create policy bills_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'bills' and public.is_staff());

drop policy if exists bills_staff_delete on storage.objects;
create policy bills_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'bills' and public.is_staff());

-- Check: the bucket is private, and anon cannot see bill_path.
select id, public from storage.buckets where id = 'bills';

select column_name
  from information_schema.column_privileges
 where table_name = 'expenses' and grantee = 'anon'
 order by column_name;
