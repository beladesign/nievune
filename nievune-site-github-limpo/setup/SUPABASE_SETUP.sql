-- NIEVUNE DATABASE SETUP
-- Run this entire file once in Supabase SQL Editor.

-- NIEVUNE STORE SETUP
-- Run this entire file in the Supabase SQL Editor.
create extension if not exists pgcrypto;

/* --------------------------------------------------------------------------
   CUSTOMER ACCOUNTS
   Supabase Auth stores passwords and sessions. Public tables below store only
   profile data, favorites and cart rows protected by Row Level Security.
   -------------------------------------------------------------------------- */

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.handle_new_nievune_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_nievune_user_created on auth.users;
create trigger on_nievune_user_created
after insert on auth.users
for each row execute procedure public.handle_new_nievune_user();

/* --------------------------------------------------------------------------
   ADMIN ACCESS
   Customer accounts never become admins automatically. After creating your own
   account, assign it manually with the SQL shown in README.txt.
   -------------------------------------------------------------------------- */

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shop_admins enable row level security;

create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.shop_admins where user_id = (select auth.uid()));
$$;

grant execute on function public.is_shop_admin() to authenticated;

-- Remove the old unsafe "first signed-up user becomes owner" mechanism.
drop function if exists public.claim_first_admin();

/* --------------------------------------------------------------------------
   PRODUCTS
   -------------------------------------------------------------------------- */

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
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
  preview_kind text default 'image-only',
  preview_image text,
  video_embed text,
  purchase_url text,
  features jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "public read active products" on public.products;
create policy "public read active products"
on public.products for select
to anon, authenticated
using (is_active = true or public.is_shop_admin());

drop policy if exists "owner inserts products" on public.products;
create policy "owner inserts products"
on public.products for insert
to authenticated
with check (public.is_shop_admin());

drop policy if exists "owner updates products" on public.products;
create policy "owner updates products"
on public.products for update
to authenticated
using (public.is_shop_admin())
with check (public.is_shop_admin());

drop policy if exists "owner deletes products" on public.products;
create policy "owner deletes products"
on public.products for delete
to authenticated
using (public.is_shop_admin());

/* --------------------------------------------------------------------------
   FAVORITES
   Each authenticated user can only read and change their own rows.
   -------------------------------------------------------------------------- */

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists user_favorites_user_id_idx on public.user_favorites(user_id);
create index if not exists user_favorites_product_id_idx on public.user_favorites(product_id);

alter table public.user_favorites enable row level security;

drop policy if exists "users read own favorites" on public.user_favorites;
create policy "users read own favorites"
on public.user_favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users add own favorites" on public.user_favorites;
create policy "users add own favorites"
on public.user_favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own favorites" on public.user_favorites;
create policy "users delete own favorites"
on public.user_favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, delete on public.user_favorites to authenticated;

/* --------------------------------------------------------------------------
   OPTIONAL ACCOUNT CART STORAGE
   The current storefront still keeps the active cart in browser cache for fast
   guest checkout. This table is ready for future cross-device cart syncing.
   -------------------------------------------------------------------------- */

create table if not exists public.user_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.user_cart_items enable row level security;

drop policy if exists "users manage own cart" on public.user_cart_items;
create policy "users manage own cart"
on public.user_cart_items for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_cart_items to authenticated;

-- Starter products
insert into public.products (id,slug,title,badge,category,section,short_description,description,price,compare_at_price,currency,preview_kind,preview_image,video_embed,purchase_url,features,tags,is_active,sort_order)
values ('zigzag-chat','zigzag-chat','Zigzag Chat','CHAT WIDGET','Classic Collection','chat-widgets','A playful chat layout with alternating message flow and streamer-focused details.','Zigzag Chat is the more expressive option in the catalog. It gives your chat overlay a dynamic rhythm while preserving readability and customization inside StreamElements.',9.0,null,'USD','zigzag-chat','','','','["Alternating card rhythm", "Custom badges and platform icons", "Designed for StreamElements"]'::jsonb,'["chat", "playful", "zigzag", "streamelements"]'::jsonb,true,1)
on conflict (id) do update set title=excluded.title, slug=excluded.slug, badge=excluded.badge, category=excluded.category, section=excluded.section, short_description=excluded.short_description, description=excluded.description, price=excluded.price, compare_at_price=excluded.compare_at_price, currency=excluded.currency, preview_kind=excluded.preview_kind, preview_image=excluded.preview_image, features=excluded.features, tags=excluded.tags, sort_order=excluded.sort_order;
insert into public.products (id,slug,title,badge,category,section,short_description,description,price,compare_at_price,currency,preview_kind,preview_image,video_embed,purchase_url,features,tags,is_active,sort_order)
values ('minimalist-widget-chat','minimalist-widget-chat','Minimalist Widget Chat','CHAT WIDGET','Minimalist Collection','chat-widgets','Clean white message cards, elegant spacing, and a soft, modern visual system.','Minimalist Widget Chat is the refined chat overlay from the Nievune minimalist collection. It keeps the stream light and polished while still showing badges, platforms, and animations clearly.',8.0,null,'USD','minimalist-chat','assets/preview-chat.webp','','','["Left, right, or horizontal layout", "Adjustable message timing", "Continuous test mode"]'::jsonb,'["chat", "minimalist", "clean", "streamelements"]'::jsonb,true,2)
on conflict (id) do update set title=excluded.title, slug=excluded.slug, badge=excluded.badge, category=excluded.category, section=excluded.section, short_description=excluded.short_description, description=excluded.description, price=excluded.price, compare_at_price=excluded.compare_at_price, currency=excluded.currency, preview_kind=excluded.preview_kind, preview_image=excluded.preview_image, features=excluded.features, tags=excluded.tags, sort_order=excluded.sort_order;
insert into public.products (id,slug,title,badge,category,section,short_description,description,price,compare_at_price,currency,preview_kind,preview_image,video_embed,purchase_url,features,tags,is_active,sort_order)
values ('minimalist-notification','minimalist-notification','Minimalist Notification','NOTIFICATION WIDGET','Minimalist Collection','notifications','A polished last follow + last sub widget with flexible card layouts and separate styling.','Minimalist Notification includes last follow and last sub in the same product. You can keep them in one combined block or split them into separate cards with independent icons and colors.',8.0,null,'USD','minimalist-notification','assets/preview-events.webp','','','["Combined or separate cards", "Independent styling per event", "Supports custom icons"]'::jsonb,'["notification", "last follow", "last sub", "minimalist"]'::jsonb,true,3)
on conflict (id) do update set title=excluded.title, slug=excluded.slug, badge=excluded.badge, category=excluded.category, section=excluded.section, short_description=excluded.short_description, description=excluded.description, price=excluded.price, compare_at_price=excluded.compare_at_price, currency=excluded.currency, preview_kind=excluded.preview_kind, preview_image=excluded.preview_image, features=excluded.features, tags=excluded.tags, sort_order=excluded.sort_order;
insert into public.products (id,slug,title,badge,category,section,short_description,description,price,compare_at_price,currency,preview_kind,preview_image,video_embed,purchase_url,features,tags,is_active,sort_order)
values ('minimalist-chat-notification','minimalist-chat-notification','Minimalist Chat & Notification','BUNDLE','Minimalist Collection','bundles','The matching pair together for less than buying both separately.','This bundle combines Minimalist Widget Chat and Minimalist Notification in one more affordable package. Perfect for creators who want a cohesive overlay system from the start.',13.0,16.0,'USD','minimalist-bundle','assets/preview-bundle.webp','','','["Includes both minimalist widgets", "Lower bundle price than separate purchase", "Matching visual language"]'::jsonb,'["bundle", "chat", "notification", "minimalist"]'::jsonb,true,4)
on conflict (id) do update set title=excluded.title, slug=excluded.slug, badge=excluded.badge, category=excluded.category, section=excluded.section, short_description=excluded.short_description, description=excluded.description, price=excluded.price, compare_at_price=excluded.compare_at_price, currency=excluded.currency, preview_kind=excluded.preview_kind, preview_image=excluded.preview_image, features=excluded.features, tags=excluded.tags, sort_order=excluded.sort_order;


-- CUSTOMER ACCOUNTS + FAVORITES
-- NIEVUNE STORE SETUP
-- Run this entire file in the Supabase SQL Editor.
create extension if not exists pgcrypto;

/* --------------------------------------------------------------------------
   CUSTOMER ACCOUNTS
   Supabase Auth stores passwords and sessions. Public tables below store only
   profile data, favorites and cart rows protected by Row Level Security.
   -------------------------------------------------------------------------- */

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.handle_new_nievune_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_nievune_user_created on auth.users;
create trigger on_nievune_user_created
after insert on auth.users
for each row execute procedure public.handle_new_nievune_user();

/* --------------------------------------------------------------------------
   ADMIN ACCESS
   Customer accounts never become admins automatically. After creating your own
   account, assign it manually with the SQL shown in README.txt.
   -------------------------------------------------------------------------- */

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shop_admins enable row level security;

create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.shop_admins where user_id = (select auth.uid()));
$$;

grant execute on function public.is_shop_admin() to authenticated;

-- Remove the old unsafe "first signed-up user becomes owner" mechanism.
drop function if exists public.claim_first_admin();

/* --------------------------------------------------------------------------
   PRODUCTS
   -------------------------------------------------------------------------- */

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
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
  preview_kind text default 'image-only',
  preview_image text,
  video_embed text,
  purchase_url text,
  features jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "public read active products" on public.products;
create policy "public read active products"
on public.products for select
to anon, authenticated
using (is_active = true or public.is_shop_admin());

drop policy if exists "owner inserts products" on public.products;
create policy "owner inserts products"
on public.products for insert
to authenticated
with check (public.is_shop_admin());

drop policy if exists "owner updates products" on public.products;
create policy "owner updates products"
on public.products for update
to authenticated
using (public.is_shop_admin())
with check (public.is_shop_admin());

drop policy if exists "owner deletes products" on public.products;
create policy "owner deletes products"
on public.products for delete
to authenticated
using (public.is_shop_admin());

/* --------------------------------------------------------------------------
   FAVORITES
   Each authenticated user can only read and change their own rows.
   -------------------------------------------------------------------------- */

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists user_favorites_user_id_idx on public.user_favorites(user_id);
create index if not exists user_favorites_product_id_idx on public.user_favorites(product_id);

alter table public.user_favorites enable row level security;

drop policy if exists "users read own favorites" on public.user_favorites;
create policy "users read own favorites"
on public.user_favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users add own favorites" on public.user_favorites;
create policy "users add own favorites"
on public.user_favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own favorites" on public.user_favorites;
create policy "users delete own favorites"
on public.user_favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, delete on public.user_favorites to authenticated;

/* --------------------------------------------------------------------------
   OPTIONAL ACCOUNT CART STORAGE
   The current storefront still keeps the active cart in browser cache for fast
   guest checkout. This table is ready for future cross-device cart syncing.
   -------------------------------------------------------------------------- */

create table if not exists public.user_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.user_cart_items enable row level security;

drop policy if exists "users manage own cart" on public.user_cart_items;
create policy "users manage own cart"
on public.user_cart_items for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_cart_items to authenticated;

