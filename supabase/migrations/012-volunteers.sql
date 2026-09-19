-- Migration 012 — the people who ran the festival.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- The app has recorded every rupee in and out since August, and not one of the
-- people who carried the chairs, cooked the prasad or stood at the counter for
-- two days. A society that publishes its money and not its volunteers has said
-- something about what it counts.
--
-- Deliberately thinner than the donations table: a name, what they did, and a
-- line about it. No mobile number, no email — a credits page is for thanking
-- people in public, and a contact detail on one is a contact detail published.

create table if not exists public.volunteers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Optional, and shown only where given. Plenty of volunteers are known by
  -- name alone and asking a flat of everyone would leave gaps that look like
  -- omissions.
  wing        text,
  flat        text,
  -- What they did, in a few words: "Food counter", "Sound and stage".
  role        text not null,
  -- How they helped, in a sentence. The part that makes it a thank-you rather
  -- than a rota.
  note        text,
  activity_id uuid references public.activities (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists volunteers_activity_idx on public.volunteers (activity_id);

alter table public.volunteers enable row level security;

-- Read by anyone: the whole point is that residents see it.
drop policy if exists volunteers_read on public.volunteers;
create policy volunteers_read on public.volunteers for select using (true);

-- Writes go through /api/volunteers with the service key, as every other
-- committee write does, because the committee login is the app's own rather
-- than a Supabase Auth account.
drop policy if exists volunteers_admin on public.volunteers;
create policy volunteers_admin on public.volunteers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.volunteers to anon;
grant select, insert, update, delete on public.volunteers to authenticated;

-- Check: the table exists and is readable.
select count(*) as volunteers from public.volunteers;
