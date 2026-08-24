-- Migration 006 — fix serve_coupon.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- 005 declared the function's return columns as members/served/remaining, and
-- then wrote `set served = served + p_count`. Inside the body, `served` matches
-- both the table column and the function's own output column, so Postgres
-- refused it: "column reference served is ambiguous". Every attempt to serve
-- failed with a 500.
--
-- Fixed by reading through the row variable that was already fetched, which is
-- unambiguous, rather than renaming the output columns — those names are what
-- the counter reads, and changing them would move the bug into the app.

create or replace function public.serve_coupon(p_code text, p_count integer)
returns table (ok boolean, reason text, members integer, served integer, remaining integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.food_coupons%rowtype;
begin
  if p_count is null or p_count < 1 then
    return query select false, 'Count must be at least one'::text, 0, 0, 0;
    return;
  end if;

  -- Locked for the length of the transaction: two volunteers scanning the same
  -- coupon at the same moment must not both spend the last meal.
  select * into c from public.food_coupons where code = upper(p_code) for update;

  if not found then
    return query select false, 'No such coupon'::text, 0, 0, 0;
    return;
  end if;

  if c.served + p_count > c.members then
    return query select
      false,
      (case when c.served >= c.members
            then 'Already fully served'
            else 'Only ' || (c.members - c.served) || ' left on this coupon' end)::text,
      c.members,
      c.served,
      c.members - c.served;
    return;
  end if;

  update public.food_coupons
     set served = c.served + p_count
   where id = c.id;

  insert into public.food_servings (coupon_id, count) values (c.id, p_count);

  return query select
    true,
    'Served'::text,
    c.members,
    c.served + p_count,
    c.members - c.served - p_count;
end;
$$;

-- Check: serving a code that does not exist should report so, not error.
select * from public.serve_coupon('ZZZZZZ', 1);
