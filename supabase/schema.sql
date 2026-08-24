-- UtsavKosh — Postgres schema and row-level security for Supabase.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It is safe to re-run; every object is created with "if not exists" or replaced.
--
-- Two ideas drive the whole design:
--
--  1. The LEDGER is public, the CONTACT DETAILS are not. Residents read the
--     contribution list and the expense ledger with no login — who gave, which
--     flat, how much, and every rupee spent — exactly as a chanda list and
--     accounts go up on the notice board. What `anon` never gets is what a
--     notice board never showed: phone numbers, UPI references, free-text
--     notes, payment screenshots, and the member register. Column-level GRANTs
--     do that, which is why the app selects explicit column lists rather than
--     `select *`.
--
--  2. Roles are enforced by the DATABASE, not the browser. A volunteer cannot
--     verify their own handover even if they tamper with the client, because the
--     UPDATE policy's WITH CHECK pins their rows to status = 'pending'.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tables ---

create table if not exists public.societies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  address        text not null default '',
  wings          text[] not null default '{}',
  receipt_prefix text not null default 'WPC',
  created_at     timestamptz not null default now()
);

create table if not exists public.members (
  id        uuid primary key default gen_random_uuid(),
  -- Null for households that are only in the flat register and never log in.
  user_id   uuid unique references auth.users (id) on delete set null,
  name      text not null,
  email     text,
  mobile    text,
  wing      text not null default '',
  flat      text not null default '',
  role      text not null default 'resident'
            check (role in ('admin', 'volunteer', 'resident')),
  status    text not null default 'approved'
            check (status in ('pending', 'approved', 'rejected')),
  joined_at timestamptz not null default now()
);

create index if not exists members_flat_idx on public.members (wing, flat);
create index if not exists members_user_idx on public.members (user_id);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  category    text not null default 'festival',
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  venue       text not null default '',
  budget      numeric(12, 2) not null default 0 check (budget >= 0),
  status      text not null default 'planned'
              check (status in ('planned', 'ongoing', 'completed', 'cancelled')),
  organiser   text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists activities_starts_idx on public.activities (starts_at desc);

create table if not exists public.donations (
  id              uuid primary key default gen_random_uuid(),
  -- Assigned by a trigger, never by the client. See next_receipt_no below.
  receipt_no      text not null unique,
  donor_name      text not null,
  donor_mobile    text,
  wing            text,
  flat            text,
  -- The register holds the owner; a tenant is often the one who actually pays.
  is_tenant       boolean not null default false,
  amount          numeric(12, 2) not null check (amount > 0),
  method          text not null check (method in ('upi', 'cash', 'bank-transfer', 'cheque')),
  reference       text,
  -- restrict, not cascade: deleting an activity must never silently delete money.
  activity_id     uuid references public.activities (id) on delete restrict,
  received_at     date not null default current_date,
  note            text,
  status          text not null default 'pending' check (status in ('pending', 'verified')),
  recorded_by     uuid not null references public.members (id) on delete restrict,
  verified_by     uuid references public.members (id) on delete set null,
  verified_at     timestamptz,
  receipt_sent_at timestamptz,
  -- Path in the private `proofs` storage bucket.
  proof_path      text,
  created_at      timestamptz not null default now()
);

create index if not exists donations_activity_idx on public.donations (activity_id);
create index if not exists donations_received_idx on public.donations (received_at desc);
create index if not exists donations_recorded_by_idx on public.donations (recorded_by);
create index if not exists donations_status_idx on public.donations (status);
create index if not exists donations_flat_idx on public.donations (wing, flat);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'miscellaneous',
  amount      numeric(12, 2) not null check (amount > 0),
  vendor      text,
  activity_id uuid references public.activities (id) on delete restrict,
  paid_at     date not null default current_date,
  method      text not null check (method in ('upi', 'cash', 'bank-transfer', 'cheque')),
  bill_no     text,
  note        text,
  recorded_by uuid not null references public.members (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_activity_idx on public.expenses (activity_id);
create index if not exists expenses_paid_idx on public.expenses (paid_at desc);

create table if not exists public.albums (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  activity_id uuid references public.activities (id) on delete set null,
  date        date not null default current_date,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albums (id) on delete cascade,
  caption     text,
  -- Path in the public `gallery` bucket.
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists photos_album_idx on public.photos (album_id);

create table if not exists public.payment_qrs (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  -- Path in the `qrcodes` bucket.
  storage_path text not null,
  activity_id uuid references public.activities (id) on delete set null,
  archived    boolean not null default false,
  added_at    timestamptz not null default now()
);

-- ------------------------------------------------- receipt numbering -------
--
-- Generated in the database, not the browser. With thirty volunteers collecting
-- at once, two clients computing "highest + 1" would hand out the same receipt
-- number. The upsert below is atomic, so the series stays gapless per financial
-- year even under concurrent inserts.

create table if not exists public.receipt_counters (
  financial_year text primary key,
  last_no        integer not null default 0
);

-- Indian financial year: 1 April to 31 March, formatted "2026-27".
create or replace function public.financial_year(on_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(month from on_date) < 4
      then (extract(year from on_date) - 1)::int || '-' ||
           lpad(((extract(year from on_date))::int % 100)::text, 2, '0')
    else extract(year from on_date)::int || '-' ||
         lpad(((extract(year from on_date)::int + 1) % 100)::text, 2, '0')
  end
$$;

create or replace function public.assign_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fy     text := public.financial_year(new.received_at);
  prefix text;
  seq    integer;
begin
  -- Client-supplied receipt numbers are ignored on insert.
  select coalesce(max(receipt_prefix), 'WPC') into prefix from public.societies;

  insert into public.receipt_counters (financial_year, last_no)
  values (fy, 1)
  on conflict (financial_year)
    do update set last_no = public.receipt_counters.last_no + 1
  returning last_no into seq;

  new.receipt_no := prefix || '/' || fy || '/' || lpad(seq::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists donations_assign_receipt_no on public.donations;
create trigger donations_assign_receipt_no
  before insert on public.donations
  for each row execute function public.assign_receipt_no();

-- A receipt number is issued once. A resident may already be holding a copy.
create or replace function public.freeze_receipt_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.receipt_no := old.receipt_no;
  return new;
end;
$$;

drop trigger if exists donations_freeze_receipt_no on public.donations;
create trigger donations_freeze_receipt_no
  before update on public.donations
  for each row execute function public.freeze_receipt_no();

-- ------------------------------------------------------ role helpers -------
--
-- security definer so they can read `members` regardless of that table's own
-- policies, which is what breaks the recursion of "policy needs role, role
-- lives in a table with a policy". search_path is pinned per Supabase guidance.

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.members
  where user_id = auth.uid() and status = 'approved'
  limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from public.members
     where user_id = auth.uid() and status = 'approved'
     limit 1),
    'guest'
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$ select public.current_role() = 'admin' $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$ select public.current_role() in ('admin', 'volunteer') $$;

-- ------------------------------------------------------------- RLS ---------

alter table public.societies       enable row level security;
alter table public.members         enable row level security;
alter table public.activities      enable row level security;
alter table public.donations       enable row level security;
alter table public.expenses        enable row level security;
alter table public.albums          enable row level security;
alter table public.photos          enable row level security;
alter table public.payment_qrs     enable row level security;
alter table public.receipt_counters enable row level security;

-- societies: everyone reads, admins edit.
drop policy if exists societies_read on public.societies;
create policy societies_read on public.societies for select using (true);

drop policy if exists societies_write on public.societies;
create policy societies_write on public.societies for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists societies_insert on public.societies;
create policy societies_insert on public.societies for insert to authenticated
  with check (public.is_admin());

-- members: the flat register carries phone numbers and e-mail, so it is NOT
-- public. Staff read it (for autofill and the "still to visit" list); admins
-- manage it; anyone signed in can read their own row.
drop policy if exists members_read_staff on public.members;
create policy members_read_staff on public.members for select to authenticated
  using (public.is_staff() or user_id = auth.uid());

drop policy if exists members_admin_all on public.members;
create policy members_admin_all on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- activities / albums / photos: public reading, admin writing.
drop policy if exists activities_read on public.activities;
create policy activities_read on public.activities for select using (true);

drop policy if exists activities_admin on public.activities;
create policy activities_admin on public.activities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists albums_read on public.albums;
create policy albums_read on public.albums for select using (true);

drop policy if exists albums_admin on public.albums;
create policy albums_admin on public.albums for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists photos_read on public.photos;
create policy photos_read on public.photos for select using (true);

drop policy if exists photos_admin on public.photos;
create policy photos_admin on public.photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- expenses: public reading is the whole point of the app.
drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select using (true);

drop policy if exists expenses_admin on public.expenses;
create policy expenses_admin on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payment QRs: not public. Only staff need to show one at a door.
drop policy if exists payment_qrs_read on public.payment_qrs;
create policy payment_qrs_read on public.payment_qrs for select to authenticated
  using (public.is_staff());

drop policy if exists payment_qrs_admin on public.payment_qrs;
create policy payment_qrs_admin on public.payment_qrs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- donations -----------------------------------------------------------------

drop policy if exists donations_read on public.donations;
create policy donations_read on public.donations for select using (true);

-- Staff record collections. `recorded_by` is pinned to the signer, so an entry
-- can never be attributed to someone else. A volunteer's row must start
-- pending — the money is in their pocket, not the society's account.
drop policy if exists donations_insert_staff on public.donations;
create policy donations_insert_staff on public.donations for insert to authenticated
  with check (
    public.is_staff()
    and recorded_by = public.current_member_id()
    and (public.is_admin() or status = 'pending')
  );

drop policy if exists donations_update_admin on public.donations;
create policy donations_update_admin on public.donations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A volunteer may correct their own entry only while it is still pending, and
-- the WITH CHECK keeps it pending — this is what stops a volunteer marking
-- their own cash as handed over.
drop policy if exists donations_update_own_pending on public.donations;
create policy donations_update_own_pending on public.donations for update to authenticated
  using (
    public.current_role() = 'volunteer'
    and recorded_by = public.current_member_id()
    and status = 'pending'
  )
  with check (
    recorded_by = public.current_member_id()
    and status = 'pending'
  );

drop policy if exists donations_delete_admin on public.donations;
create policy donations_delete_admin on public.donations for delete to authenticated
  using (public.is_admin());

drop policy if exists donations_delete_own_pending on public.donations;
create policy donations_delete_own_pending on public.donations for delete to authenticated
  using (
    public.current_role() = 'volunteer'
    and recorded_by = public.current_member_id()
    and status = 'pending'
  );

-- receipt_counters is machinery, not data. Nobody reads or writes it directly;
-- the security-definer trigger bypasses RLS. No policies = no access.

-- --------------------------------------------- column-level grants ---------
--
-- This is what keeps the public ledger from leaking personal data. anon may
-- read the money, but not donor_mobile and not the free-text note (which
-- volunteers may use for anything).

-- Signed-in staff need the whole row (they use donor_mobile to send receipts).
grant select, insert, update, delete on public.donations   to authenticated;
grant select, insert, update, delete on public.expenses    to authenticated;
grant select, insert, update, delete on public.activities  to authenticated;
grant select, insert, update, delete on public.albums      to authenticated;
grant select, insert, update, delete on public.photos      to authenticated;
grant select, insert, update, delete on public.members     to authenticated;
grant select, insert, update, delete on public.payment_qrs to authenticated;
grant select, insert, update          on public.societies   to authenticated;

-- Guests get the money, not the personal data.
revoke all on public.donations   from anon;
revoke all on public.members     from anon;
revoke all on public.payment_qrs from anon;

-- The contribution list is public, as a chanda list on the notice board is:
-- who gave, which flat, how much. What stays private is what a notice board
-- never showed either — the phone number, the UPI reference, the free-text
-- note, and the payment screenshot.
grant select (
  id, receipt_no, donor_name, wing, flat, is_tenant, amount, method,
  activity_id, received_at, status, created_at
) on public.donations to anon;

grant select on public.societies  to anon;
grant select on public.activities to anon;
grant select on public.expenses   to anon;
grant select on public.albums     to anon;
grant select on public.photos     to anon;

-- ------------------------------------------------- storage buckets ---------

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

-- Proof images are UPI confirmation screenshots: they can carry the payer's
-- name, UPI handle and phone. They are shown on receipts the volunteer sends
-- directly, and must NOT be readable from a public URL.
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('qrcodes', 'qrcodes', false)
on conflict (id) do update set public = false;

drop policy if exists gallery_public_read on storage.objects;
create policy gallery_public_read on storage.objects for select
  using (bucket_id = 'gallery');

drop policy if exists gallery_admin_write on storage.objects;
create policy gallery_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_admin());

drop policy if exists gallery_admin_delete on storage.objects;
create policy gallery_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_admin());

drop policy if exists proofs_staff_read on storage.objects;
create policy proofs_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.is_staff());

drop policy if exists proofs_staff_write on storage.objects;
create policy proofs_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and public.is_staff());

drop policy if exists proofs_staff_delete on storage.objects;
create policy proofs_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and public.is_staff());

drop policy if exists qrcodes_staff_read on storage.objects;
create policy qrcodes_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'qrcodes' and public.is_staff());

drop policy if exists qrcodes_admin_write on storage.objects;
create policy qrcodes_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'qrcodes' and public.is_admin());

drop policy if exists qrcodes_admin_delete on storage.objects;
create policy qrcodes_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'qrcodes' and public.is_admin());

-- --------------------------------------------------------- realtime --------
-- Lets every phone see a volunteer's entry appear within a second.
-- Wrapped in a loop because ALTER PUBLICATION errors if the table is already
-- a member, and this file is meant to be safe to re-run.

do $$
declare
  t text;
begin
  foreach t in array array['donations', 'expenses', 'activities', 'photos', 'albums']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
