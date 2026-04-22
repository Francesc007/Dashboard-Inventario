-- Galería: hasta 4 extras; la portada es cover_image_url (5 fotos en total).
update public.cars
set gallery_urls = gallery_urls[1:4]
where coalesce(cardinality(gallery_urls), 0) > 4;

alter table public.cars drop constraint if exists gallery_max_five;
alter table public.cars
  add constraint gallery_max_four_gallery_urls
  check (coalesce(cardinality(gallery_urls), 0) <= 4);
