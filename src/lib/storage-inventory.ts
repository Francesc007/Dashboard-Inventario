/**
 * Bucket público de Supabase Storage para imágenes de inventario / reseñas.
 * Debe coincidir con `storage.buckets` en las migraciones SQL.
 */
export const STORAGE_BUCKET = "inventory";

/**
 * Corrige URLs antiguas que apuntaban al bucket `cars` para que usen `inventory`.
 */
export function normalizeInventoryPublicUrl(
  url: string | null | undefined,
): string | null {
  if (url == null || url === "") return null;
  if (!url.includes("/object/public/cars/")) return url;
  return url.replace(
    /\/object\/public\/cars\//g,
    `/object/public/${STORAGE_BUCKET}/`,
  );
}

export function normalizeCarImageUrls<T extends { cover_image_url: string | null; gallery_urls: string[] }>(
  car: T,
): T {
  return {
    ...car,
    cover_image_url: normalizeInventoryPublicUrl(car.cover_image_url),
    gallery_urls: (car.gallery_urls ?? []).map(
      (u) => normalizeInventoryPublicUrl(u) ?? u,
    ),
  };
}
