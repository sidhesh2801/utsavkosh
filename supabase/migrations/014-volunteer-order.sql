-- Migration 014 — putting the credits in the order the committee wants them.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- The thanks page grouped people by what they did and showed the groups in
-- whatever order their first member happened to be added. That is an accident
-- of typing order standing in for a decision, and on a page of thanks the
-- order is part of the thanks: the senior citizens should not appear below a
-- section that exists because somebody signed up at nine in the morning.
--
-- One integer per person. The group's place on the page is the lowest number
-- in it, so moving a section moves everybody in it together, and a person's
-- place inside the section is their own number.

alter table public.volunteers
  add column if not exists sort integer not null default 0;

-- Seed it from the order things are currently in, so turning this on changes
-- nothing on screen until somebody actually moves a section.
with ordered as (
  select id, row_number() over (order by created_at) - 1 as n
  from public.volunteers
)
update public.volunteers v
set sort = ordered.n
from ordered
where v.id = ordered.id and v.sort = 0;

create index if not exists volunteers_sort_idx on public.volunteers (sort, created_at);

-- Check.
select role, min(sort) as position, count(*) as people
from public.volunteers
group by role
order by position;
