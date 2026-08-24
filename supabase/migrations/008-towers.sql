-- Migration 008 — the society's actual towers.
--
-- Run in the Supabase SQL Editor. Safe to re-run. Already applied to the live
-- database; this file exists so a fresh setup matches.
--
-- A, B, C, M, N, O — the committee's list. The earlier placeholder of A to D
-- would have made M, N and O impossible to pick, and the imported donations
-- alone contain N-130, M-401 and O-140.
--
-- A short exact list beats the whole alphabet: a resident cannot choose a
-- tower that does not exist, so the flat numbers stay clean enough to match
-- against later.

update public.societies set wings = array['A', 'B', 'C', 'M', 'N', 'O'];

select wings from public.societies;
