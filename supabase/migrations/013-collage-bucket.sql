-- Migration 013 — somewhere for the volunteers to put their photographs.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- The collage started as a folder in the repository, which works for whoever
-- has the repository and for nobody else. The people with the photographs are
-- the ones who were standing in front of the handi with a phone, and asking
-- them to send pictures to somebody who can push a commit is how a wall of
-- sixteen photographs stays a wall of sixteen photographs.
--
-- So: a public bucket. Public because these go on a page anyone can read, and
-- an image behind a signed URL that expires is an image that stops loading.
-- Nothing private is meant to be here — the upload route is the place that
-- says so.
--
-- Writes go through /api/collage with the service key, as every other write in
-- this app does, because the sign-in is the app's own rather than a Supabase
-- Auth account. The route accepts the volunteers' password as well as the
-- committee's.

insert into storage.buckets (id, name, public)
values ('collage', 'collage', true)
on conflict (id) do update set public = true;

-- And a second one for the volunteers' own faces on the thanks page. Separate
-- from the collage rather than a folder inside it, so that listing the wall
-- cannot accidentally hang forty portraits on it.
insert into storage.buckets (id, name, public)
values ('faces', 'faces', true)
on conflict (id) do update set public = true;

drop policy if exists collage_public_read on storage.objects;
create policy collage_public_read on storage.objects for select
  using (bucket_id in ('collage', 'faces'));

-- A picture beside the name, so people can place who did what. Optional, and
-- it stays optional: plenty of volunteers will not want their face on a page
-- the whole society reads, and a blank where a photo would be must not look
-- like something went wrong.
alter table public.volunteers
  add column if not exists photo_url text;

-- Check: the buckets exist, are public, and the column is there.
select id, public from storage.buckets where id in ('collage', 'faces');
