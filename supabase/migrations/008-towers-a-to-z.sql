-- Migration 008 — towers A to Z.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- The society's towers include at least A, B, C, M, N and O — the imported
-- donations alone show N-130, M-401, O-140, B-404 and C-140, and the earlier
-- placeholder of A to D would have made three of those impossible to select.
-- Listing the whole alphabet costs nothing and cannot be wrong.

update public.societies
set wings = array(
  select chr(i) from generate_series(ascii('A'), ascii('Z')) as i
);

select wings from public.societies;
