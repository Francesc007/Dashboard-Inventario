-- Galería: hasta 5 URLs; la portada es cover_image_url (independiente).
alter table public.cars drop constraint if exists gallery_max_five;
alter table public.cars
  add constraint gallery_max_five
  check (coalesce(cardinality(gallery_urls), 0) <= 5);
