-- Migration 004 — import the Janmashtami 2026 collection.
--
-- Run in the Supabase SQL Editor AFTER migration 003. Safe to re-run: it does
-- nothing if these entries are already present.
--
-- 104 contributions totalling Rs 74,344, reconciled against the
-- committee's own total before import.
--
-- Notes on the data, none of it altered:
--   * 35 of these came through the PhonePe QR and carry no donor name — the
--     bank records only a reference. They are listed as anonymous rather than
--     guessed at, with the UTR kept so a resident can recognise their own.
--   * Five Rs 1.00 entries are almost certainly QR tests. They are imported
--     because they are real lines on the bank statement and the ledger has to
--     reconcile; delete them if the committee decides otherwise.
--   * Names are truncated by the bank (eight characters). Left as recorded.

do $$
declare
  v_activity uuid;
  v_admin    uuid;
  v_existing int;
begin
  select id into v_admin from public.members where role = 'admin' order by joined_at limit 1;
  if v_admin is null then
    raise exception 'No admin member found — run bootstrap.sql first.';
  end if;

  -- The drive these contributions belong to.
  select id into v_activity from public.activities
   where title = 'Janmashtami & Dahi Handi 2026';

  if v_activity is null then
    insert into public.activities (title, description, category, starts_at, ends_at,
                                   venue, budget, status, organiser)
    values ('Janmashtami & Dahi Handi 2026',
            'Krishna Janmashtami celebration and the Dahi Handi on the podium.',
            'festival', '2026-09-04 17:00+05:30', '2026-09-05 13:00+05:30',
            'Podium & central lawn', 0, 'planned', 'Festival Committee')
    returning id into v_activity;
  end if;

  select count(*) into v_existing from public.donations where activity_id = v_activity;
  if v_existing > 0 then
    raise notice 'Already imported (% rows) — nothing to do.', v_existing;
    return;
  end if;

  insert into public.donations
    (donor_name, wing, flat, amount, method, reference, received_at, note,
     activity_id, recorded_by, status, verified_by, verified_at)
  select v.donor_name, v.wing, v.flat, v.amount, v.method, v.reference, v.received_at,
         v.source, v_activity, v_admin, 'verified', v_admin, now()
  from (values
  ('Anand Pr', null, null, 1100.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Rajesh U', null, null, 1111.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Sudhin', null, null, 1101.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Sumeet M', null, null, 1111.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Aman Tan', null, null, 1101.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Aradhana', null, null, 500.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Shilpa', null, null, 500.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Pooja Go', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Shashank', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Shubham', null, null, 251.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Ronak Sh', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Vivek An', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Amitprak', null, null, 1100.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Shivali', null, null, 1001.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Gyana Ra', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Divyendu', null, null, 651.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Ganesh R', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Narendra', null, null, 1000.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Prashant', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Aakashna', null, null, 1001.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Kanchan', null, null, 1000.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Rajeev S', null, null, 2100.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Amit Sha', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Rohit Ku', null, null, 1001.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Pranjal', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Anup Deo', 'N', '130', 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Kanthima', 'M', '401', 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Hiteshmi', null, null, 1100.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Neha Pa', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Deepak K', null, null, 1111.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Gyan Ran', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Peeyush', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Chetan K', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Hema Tri', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Aditya P', 'O', '140', 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Somesh', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Pramod D', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Sachin B', null, null, 510.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Varsha S', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Samir Ku', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Vitthal', null, null, 501.00, 'upi', null, DATE '2026-08-21', 'Bank UPI'),\n  ('Vikas Pa', null, null, 501.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Shreya C', null, null, 1001.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Divya De', null, null, 501.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Pooja K', null, null, 1000.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Satyajee', null, null, 501.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Mahendra', null, null, 501.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Binay Ku', null, null, 1001.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Vaidyana', 'B', '404', 1001.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Smita Ga', null, null, 500.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Saugata', null, null, 551.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Priyanka', null, null, 1001.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Shraddha', null, null, 501.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Harshad', null, null, 1111.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Mohit Ki', 'N', '506', 501.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Abhisekm', null, null, 500.00, 'upi', null, DATE '2026-08-22', 'Bank UPI'),\n  ('Mritunja', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Vedant S', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Sidhesh', null, null, 2100.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Arvind K', null, null, 1001.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Vikash O', 'C', '140', 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Chetan A', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Rajat Sh', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Sonali', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Ankit Dr', 'O', '140', 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Krishan', null, null, 1100.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Richa V', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Harshad', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Pinak Ray', null, null, 501.00, 'upi', null, DATE '2026-08-23', 'Bank UPI'),\n  ('Anonymous (QR payment)', null, null, 1.00, 'upi', 'T2608220950596106655244', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1.00, 'upi', '623423432527', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1111.00, 'upi', '128316997934', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1.00, 'upi', '240973755310', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1.00, 'upi', '110494912787', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1.00, 'upi', '110494910044', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1500.00, 'upi', '110494998093', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1001.00, 'upi', '623414194493', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 2100.00, 'upi', '110495174654', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1000.00, 'upi', '110495180021', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1001.00, 'upi', '623428340146', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '623484643241', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '560475809654', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 2501.00, 'upi', '128326167751', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '623419529923', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660095607347', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1001.00, 'upi', '110495815934', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '110495841377', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '128328894676', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '110496088309', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 2100.00, 'upi', '623426632587', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660095721427', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660002807521', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1100.00, 'upi', '128339677635', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 551.00, 'upi', '660001309807', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '128344682879', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '584417573994', DATE '2026-08-22', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660186355837', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660199148752', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '128361368938', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '111401745960', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 1100.00, 'upi', '660166233687', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '128367813563', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660105160678', DATE '2026-08-23', 'PhonePe QR'),\n  ('Anonymous (QR payment)', null, null, 501.00, 'upi', '660115030218', DATE '2026-08-23', 'PhonePe QR')
  ) as v(donor_name, wing, flat, amount, method, reference, received_at, source);
end;
$$;

-- Check: expect 104 rows and Rs 74,344.00.
select count(*) as entries, to_char(sum(amount), 'FM9,99,999.00') as total
from public.donations d
join public.activities a on a.id = d.activity_id
where a.title = 'Janmashtami & Dahi Handi 2026';
