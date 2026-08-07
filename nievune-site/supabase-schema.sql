-- NIEVUNE PRIVATE SHOP SETUP
create extension if not exists pgcrypto;

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
  select exists(select 1 from public.shop_admins where user_id = auth.uid());
$$;

grant execute on function public.is_shop_admin() to authenticated;

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if exists(select 1 from public.shop_admins) then
    return exists(select 1 from public.shop_admins where user_id = auth.uid());
  end if;

  insert into public.shop_admins(user_id) values (auth.uid()) on conflict do nothing;
  return exists(select 1 from public.shop_admins where user_id = auth.uid());
end;
$$;

grant execute on function public.claim_first_admin() to authenticated;

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
