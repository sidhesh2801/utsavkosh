-- UtsavKosh — one-time bootstrap.
--
-- Run this in the Supabase SQL Editor AFTER you have created your own login
-- under Authentication → Users → Add user (tick "Auto Confirm User").
--
-- Why it has to run here rather than in the app: creating the society row
-- requires being an admin, and there is no admin yet. The SQL Editor runs as the
-- database owner, so it is the only thing that can break that circle. Everything
-- after this can be done from the app.
--
-- Safe to re-run: it does nothing if the society or the member already exists.

-- 1. The society itself -----------------------------------------------------
--    Edit these four values to match your society before running.

insert into public.societies (name, address, receipt_prefix, wings)
select
  'Wellington — Pride World City',
  'Pride World City, Charholi Budruk, Pune 412105',
  'WPC',
  -- Placeholder towers. Change them here, or later in the app under
  -- Manage → Society details, which is easier.
  array['A', 'B', 'C', 'D']
where not exists (select 1 from public.societies);

-- 2. Make yourself the first committee admin --------------------------------
--    Takes the earliest account in Authentication → Users. If you created more
--    than one, replace the `order by` clause with:  where u.email = 'you@…'

insert into public.members (user_id, name, email, mobile, wing, flat, role, status)
select
  u.id,
  -- Falls back to the part of the e-mail before the @; fix your name later in
  -- the app under Manage.
  coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.phone, ''),
  '',
  '',
  'admin',
  'approved'
from auth.users u
where not exists (select 1 from public.members m where m.user_id = u.id)
order by u.created_at
limit 1;

-- 3. Check it worked --------------------------------------------------------

select
  (select count(*) from public.societies) as societies,
  (select count(*) from public.members where role = 'admin') as admins,
  (select name from public.societies limit 1) as society_name,
  (select email from public.members where role = 'admin' limit 1) as admin_email;
