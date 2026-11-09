-- جداول تازه CineVerse V2؛ جدول قدیمی movies دست‌نخورده می‌ماند.
create table if not exists public.cv_movies(id uuid primary key default gen_random_uuid(),title text not null,year integer,rating numeric(3,1),overview text,poster_url text,cloud_url text,category text default 'سایر',language text,published boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.cv_admins(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.cv_movies enable row level security;
alter table public.cv_admins enable row level security;
drop policy if exists "cv public read" on public.cv_movies;
create policy "cv public read" on public.cv_movies for select to anon,authenticated using(published=true or exists(select 1 from public.cv_admins a where a.user_id=auth.uid()));
drop policy if exists "cv admin insert" on public.cv_movies;
create policy "cv admin insert" on public.cv_movies for insert to authenticated with check(exists(select 1 from public.cv_admins a where a.user_id=auth.uid()));
drop policy if exists "cv admin update" on public.cv_movies;
create policy "cv admin update" on public.cv_movies for update to authenticated using(exists(select 1 from public.cv_admins a where a.user_id=auth.uid())) with check(exists(select 1 from public.cv_admins a where a.user_id=auth.uid()));
drop policy if exists "cv admin delete" on public.cv_movies;
create policy "cv admin delete" on public.cv_movies for delete to authenticated using(exists(select 1 from public.cv_admins a where a.user_id=auth.uid()));
drop policy if exists "cv admin self read" on public.cv_admins;
create policy "cv admin self read" on public.cv_admins for select to authenticated using(user_id=auth.uid());
-- پس از ساخت کاربر در Authentication > Users، UUID او را جایگزین و اجرا کن:
-- insert into public.cv_admins(user_id) values('USER_UUID');
