-- Migration 007 — cap a coupon at five people.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- The committee's number. A cap is what makes the registration total a usable
-- estimate of how much food to cook; without one, a few optimistic entries
-- commit the kitchen to meals nobody planned. The committee can still issue a
-- larger coupon at the counter for a genuinely larger family.

alter table public.societies
  alter column max_coupon_members set default 5;

update public.societies set max_coupon_members = 5;

select max_coupon_members from public.societies;
