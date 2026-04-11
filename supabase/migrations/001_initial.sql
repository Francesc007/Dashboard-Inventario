-- Auto Inventory SaaS — esquema inicial
-- Ejecutar en Supabase SQL Editor o con CLI: supabase db push

create extension if not exists "pgcrypto";

do $$ begin
  create type car_condition as enum ('nuevo', 'seminuevo');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type track_event_type as enum (
    'view_car',
    'click_whatsapp',
    'click_form',
    'submit_lead'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  year int not null check (year >= 1900 and year <= 2100),
  price numeric(14, 2) not null check (price >= 0),
  discount_percent numeric(5, 2) default 0 check (discount_percent >= 0 and discount_percent <= 100),
  mileage_km int not null default 0 check (mileage_km >= 0),
  engine text,
  acceleration_0_100_sec numeric(5, 2),
  power_hp int,
  condition car_condition not null default 'seminuevo',
  cover_image_url text,
  gallery_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_max_five check (coalesce(array_length(gallery_urls, 1), 0) <= 5)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  car_id uuid references public.cars (id) on delete set null,
  name text not null,
  location text,
  model text,
  photo_url text,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landing_interactions (
  id uuid primary key default gen_random_uuid(),
  car_id uuid references public.cars (id) on delete set null,
  event_type track_event_type not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_landing_interactions_car_created
  on public.landing_interactions (car_id, created_at desc);

create index if not exists idx_landing_interactions_type_created
  on public.landing_interactions (event_type, created_at desc);

create index if not exists idx_landing_interactions_created
  on public.landing_interactions (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cars_updated_at on public.cars;
create trigger cars_updated_at
  before update on public.cars
  for each row execute function public.set_updated_at();

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- RLS: el cliente público usa la API Next (service role).
-- Sin políticas, solo service_role / postgres acceden; preparado para añadir políticas por auth.
alter table public.cars enable row level security;
alter table public.reviews enable row level security;
alter table public.landing_interactions enable row level security;

-- Tiempo real para el dashboard (suscripción con anon + política de lectura opcional)
alter publication supabase_realtime add table public.landing_interactions;

-- Bucket público para imágenes de inventario y reseñas
insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', true)
on conflict (id) do update set public = excluded.public;

-- Lectura pública de objetos en bucket inventory
drop policy if exists "inventory_public_read" on storage.objects;
create policy "inventory_public_read"
  on storage.objects for select
  using (bucket_id = 'inventory');

-- Subida: solo usuarios autenticados en Supabase Auth (opcional) o usar solo service role desde API
drop policy if exists "inventory_authenticated_upload" on storage.objects;
create policy "inventory_authenticated_upload"
  on storage.objects for insert
  with check (bucket_id = 'inventory' and auth.role() = 'authenticated');

drop policy if exists "inventory_authenticated_update" on storage.objects;
create policy "inventory_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'inventory' and auth.role() = 'authenticated');

drop policy if exists "inventory_authenticated_delete" on storage.objects;
create policy "inventory_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'inventory' and auth.role() = 'authenticated');

comment on table public.cars is 'Inventario de vehículos';
comment on table public.reviews is 'Reseñas de clientes';
comment on table public.landing_interactions is 'Eventos de analytics (vistas, WhatsApp, formularios, leads)';
