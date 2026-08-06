create extension if not exists pgcrypto;

create table if not exists public.store_owner (
  id smallint primary key default 1 check (id = 1),
  owner_id uuid unique not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  badge text,
  category text,
  section text not null default 'chat-widgets',
  short_description text,
  description text,
  price numeric(10,2) not null default 0,
  compare_at_price numeric(10,2),
  currency text not null default 'USD',
  preview_kind text not null default 'image-only',
  preview_image text,
  video_embed text,
  purchase_url text,
  tags jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_store_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_owner where owner_id = auth.uid()
  );
$$;

create or replace function public.claim_store_owner()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.store_owner (id, owner_id)
  values (1, auth.uid())
  on conflict (id) do nothing;

  return public.is_store_owner();
end;
$$;

grant execute on function public.is_store_owner() to anon, authenticated;
grant execute on function public.claim_store_owner() to authenticated;

alter table public.store_owner enable row level security;
alter table public.products enable row level security;

drop policy if exists "Owner can read owner row" on public.store_owner;
create policy "Owner can read owner row"
on public.store_owner for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
using (is_active = true or public.is_store_owner());

drop policy if exists "Owner can insert products" on public.products;
create policy "Owner can insert products"
on public.products for insert
to authenticated
with check (public.is_store_owner());

drop policy if exists "Owner can update products" on public.products;
create policy "Owner can update products"
on public.products for update
to authenticated
using (public.is_store_owner())
with check (public.is_store_owner());

drop policy if exists "Owner can delete products" on public.products;
create policy "Owner can delete products"
on public.products for delete
to authenticated
using (public.is_store_owner());
