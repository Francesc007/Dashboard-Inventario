/**
 * Zona IANA para agrupar métricas por día y formatear horas en el panel.
 * `NEXT_PUBLIC_*` está en el cliente; `METRICS_TIMEZONE` solo en servidor (API).
 */
export const METRICS_TIMEZONE =
  process.env.NEXT_PUBLIC_METRICS_TIMEZONE?.trim() ||
  process.env.METRICS_TIMEZONE?.trim() ||
  "America/Mexico_City";
