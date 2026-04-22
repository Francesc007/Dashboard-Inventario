-- Etiqueta de agrupación enviada por la landing (nombre del auto, "Consulta General", etc.)
alter table public.landing_interactions
  add column if not exists car_label text;

comment on column public.landing_interactions.car_label is
  'Nombre mostrado para métricas; misma semántica que vehicle_name en filas nuevas.';

-- Filas existentes: copiar vehicle_name si car_label sigue vacío
update public.landing_interactions
set car_label = vehicle_name
where (car_label is null or car_label = '')
  and vehicle_name is not null
  and trim(vehicle_name) <> '';

create index if not exists idx_landing_interactions_car_label
  on public.landing_interactions (car_label)
  where car_label is not null;
