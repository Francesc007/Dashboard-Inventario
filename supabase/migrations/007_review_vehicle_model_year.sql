-- Campos explícitos de modelo y año en reseñas (texto libre, sin inventario).
alter table public.reviews
  add column if not exists vehicle_model text;

alter table public.reviews
  add column if not exists vehicle_year smallint;

alter table public.reviews
  add constraint reviews_vehicle_year_range
  check (
    vehicle_year is null
    or (vehicle_year >= 1900 and vehicle_year <= 2100)
  );
