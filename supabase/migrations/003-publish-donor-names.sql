-- Migration 003 — publish donor names and flats on the public list.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- This reverses part of migration 002. The committee's decision is that the
-- contribution list should be open to every resident, exactly as a chanda list
-- goes up on the notice board: who gave, which flat, how much.
--
-- What stays private, because a notice board never showed it either:
--   donor_mobile — a personal phone number
--   note         — free text, could contain anything
--   proof_path   — payment screenshots carry the payer's handle and phone
--
-- `reference` IS public, unlike in 002. A third of the Janmashtami collection
-- came through the QR and carries no donor name at all, so the transaction
-- reference is the only way one of those residents can find their own entry.
-- A UTR is a transaction number: unlike a UPI handle it identifies nobody on
-- its own.
--
-- Search engines are still blocked at the app level (robots: noindex), so the
-- list is open to anyone with the link rather than published to the web.

revoke all on public.donations from anon;

grant select (
  id,
  receipt_no,
  donor_name,
  wing,
  flat,
  is_tenant,
  amount,
  method,
  reference,
  activity_id,
  received_at,
  status,
  created_at
) on public.donations to anon;

-- Check: expect the thirteen columns above, and none of donor_mobile, note or
-- proof_path.
select string_agg(column_name, ', ' order by column_name) as anon_can_read
from information_schema.column_privileges
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'donations'
  and privilege_type = 'SELECT';
