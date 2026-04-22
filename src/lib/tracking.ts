import type { TrackEventType } from "@/types";

/** Tipos que acepta POST /api/track (incl. alias que normaliza el servidor). */
export type TrackEventInput =
  | TrackEventType
  | "whatsapp_click"
  | "form_submit"
  | "car_view";

type TrackOptions = {
  carId?: string | null;
  /** Prioridad en API: agrupa métricas por esta columna. */
  carLabel?: string | null;
  /** Alias; si no hay carLabel se envía como car_label en servidor. */
  vehicleName?: string | null;
  metadata?: Record<string, unknown>;
};

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * URL base del API (panel Next). En Next usa `process.env`;
 * en Vite (landing externa) usa `import.meta.env.NEXT_PUBLIC_API_URL`.
 */
function getPublicApiBase(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL);
  }
  try {
    const im = import.meta as unknown as {
      env?: { NEXT_PUBLIC_API_URL?: string };
    };
    if (im.env?.NEXT_PUBLIC_API_URL) {
      return trimTrailingSlash(im.env.NEXT_PUBLIC_API_URL);
    }
  } catch {
    /* entorno sin import.meta */
  }
  return "";
}

function getPublicTrackKey(): string | undefined {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TRACK_KEY) {
    return process.env.NEXT_PUBLIC_TRACK_KEY;
  }
  try {
    return (
      import.meta as unknown as { env?: { NEXT_PUBLIC_TRACK_KEY?: string } }
    ).env?.NEXT_PUBLIC_TRACK_KEY;
  } catch {
    return undefined;
  }
}

/**
 * Envía un evento de tracking al panel (`POST /api/track`).
 * Requiere `NEXT_PUBLIC_API_URL` apuntando al origen del panel (sin `/api/track`).
 */
export async function trackEvent(
  eventType: TrackEventInput,
  options?: TrackOptions,
): Promise<void> {
  const base = getPublicApiBase();
  if (!base) {
    if (typeof console !== "undefined") {
      console.warn(
        "[tracking] Define NEXT_PUBLIC_API_URL (URL del panel, p. ej. https://tu-app.vercel.app)",
      );
    }
    return;
  }

  const url = `${base}/api/track`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const key = getPublicTrackKey();
  if (key) {
    headers["x-track-key"] = key;
  }

  const meta = { ...(options?.metadata ?? {}) };
  const label =
    options?.carLabel?.trim() || options?.vehicleName?.trim() || "";
  if (label) {
    meta.car_label = label;
    meta.vehicle_name = label;
  }

  const body = JSON.stringify({
    eventType,
    carId: options?.carId ?? null,
    carLabel: options?.carLabel?.trim() || undefined,
    vehicleName: options?.vehicleName?.trim() || undefined,
    metadata: meta,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.warn("[tracking] Error", res.status, j);
    }
  } catch (e) {
    console.warn("[tracking] fetch falló", e);
  }
}
