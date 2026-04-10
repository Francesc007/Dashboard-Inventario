import imageCompression from "browser-image-compression";

const MAX_SIZE_MB = 1;
const MAX_WIDTH_OR_HEIGHT_PX = 1200;

/**
 * Reduce peso (≤1 MB) y tamaño (lado mayor ≤1200 px) manteniendo buena calidad.
 * Los GIF se suben sin comprimir para no perder animación.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") {
    return file;
  }
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    return file;
  }

  return imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT_PX,
    useWebWorker: true,
    initialQuality: 0.85,
    alwaysKeepResolution: false,
  });
}
