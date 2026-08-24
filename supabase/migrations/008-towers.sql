-- Migration 008 — the society's towers.
--
-- Run in the Supabase SQL Editor. Safe to re-run. Already applied to the live
-- database; this file exists so a fresh setup matches.
--
-- A, B, C, M, N, O. The earlier placeholder of A to D made three real towers
-- impossible to pick — the imported donations alone contain N-130, M-401 and
-- O-140.
--
-- An exact list beats the whole alphabet: a resident cannot choose a tower that
-- does not exist, so the flat references stay clean enough to match on later.

update public.societies set wings = array['A', 'B', 'C', 'M', 'N', 'O'];

select wings, max_coupon_members from public.societies;
