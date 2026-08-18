-- Migration 002 — take donor identity off the public ledger.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Why:
--   The first cut let guests read donor_name, wing and flat so a resident could
--   look up their own receipt. But that also meant anyone with the link — or
--   just the publishable key and a curl command — could read what every
--   individual household had given. Hiding the search box in the app would not
--   have fixed it; the API was serving the data regardless.
--
-- What guests can still see, which is the whole point of the app:
--   every amount, when it came in, how it was paid, which festival it was for,
--   and every expense in full detail with vendor and bill number. Residents can
--   still audit where the money went. They just can't see who gave what.
--
-- Donor identity is now visible only to signed-in committee admins and
-- volunteers, who need it to issue and re-send receipts.

revoke all on public.donations from anon;

grant select (
  id,
  receipt_no,
  amount,
  method,
  activity_id,
  received_at,
  status,
  created_at
) on public.donations to anon;

-- Deliberately NOT granted to anon:
--   donor_name, wing, flat  — identify the household
--   donor_mobile            — personal contact detail
--   is_tenant               — reveals a household's tenancy arrangement
--   reference               — a UPI id can identify the payer
--   note                    — free text, could contain anything
--   recorded_by, verified_by, verified_at, receipt_sent_at, proof_path
--                           — internal handling detail

-- Check what anon can now read. Expect exactly the eight columns above.
select string_agg(column_name, ', ' order by column_name) as anon_can_read
from information_schema.column_privileges
where grantee = 'anon'
  and table_schema = 'public'
  and table_name = 'donations'
  and privilege_type = 'SELECT';
