-- Nombre legible del vehículo / consulta (alineado con landing y dashboard).
alter table public.landing_interactions
  add column if not exists vehicle_name text;

comment on column public.landing_interactions.vehicle_name is
  'Etiqueta del auto o "Consulta General"; redundante con metadata.vehicle_name para consultas SQL.';

create index if not exists idx_landing_interactions_vehicle_name
  on public.landing_interactions (vehicle_name)
  where vehicle_name is not null;
