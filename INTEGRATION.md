# Integración con tu landing (tracking externo)

El endpoint público **`POST /api/track`** recibe eventos desde cualquier sitio (landing en otro dominio, SPA, HTML estático) y los guarda en Supabase. El dashboard consulta esos datos y se actualiza cada pocos segundos.

## URL base

Usa la URL pública de tu despliegue en Vercel, por ejemplo:

`https://tu-proyecto.vercel.app/api/track`

En desarrollo local:

`http://localhost:3000/api/track`

## Cuerpo JSON

| Campo        | Tipo   | Obligatorio | Descripción |
|-------------|--------|-------------|-------------|
| `eventType` | string | Sí          | Uno de: `view_car`, `click_whatsapp`, `click_form`, `submit_lead` |
| `carId`     | UUID   | No          | ID del vehículo en tu inventario (copia desde el panel). Si no aplica, omite o usa `null`. |
| `metadata`  | objeto | No          | Datos extra (p. ej. `utm`, `email` en `submit_lead`). |

## Ejemplo con `fetch`

```javascript
const DASHBOARD_ORIGIN = "https://tu-proyecto.vercel.app";
const CAR_ID = "uuid-del-auto-en-inventario"; // opcional

await fetch(`${DASHBOARD_ORIGIN}/api/track`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    eventType: "view_car",
    carId: CAR_ID,
    metadata: { page: "/catalogo", ref: "google" },
  }),
});
```

### Clic en WhatsApp

```javascript
await fetch(`${DASHBOARD_ORIGIN}/api/track`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    eventType: "click_whatsapp",
    carId: CAR_ID,
  }),
});
```

### Lead enviado

```javascript
await fetch(`${DASHBOARD_ORIGIN}/api/track`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    eventType: "submit_lead",
    carId: CAR_ID,
    metadata: { source: "formulario_principal" },
  }),
});
```

## CORS

Configura en Vercel (variables de entorno) el valor **`ALLOWED_ORIGINS`** con el dominio de tu landing, separado por comas:

`https://www.tu-landing.com,https://tu-landing.com`

Si usas `*`, el servidor reflejará el `Origin` de la petición cuando sea posible.

## Clave opcional `TRACK_API_KEY`

Si defines **`TRACK_API_KEY`** en el entorno del dashboard, cada petición debe incluir el header:

`x-track-key: <mismo valor>`

Ejemplo:

```javascript
await fetch(`${DASHBOARD_ORIGIN}/api/track`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-track-key": process.env.NEXT_PUBLIC_TRACK_KEY, // en la landing, expón solo una clave pública acordada
  },
  body: JSON.stringify({ eventType: "view_car", carId: CAR_ID }),
});
```

> En la landing no guardes secretos del servidor de Supabase; solo la URL del API y, si aplica, una clave de tracking pensada para uso en cliente (rotable si se filtra).

## Obtener `carId`

1. Entra al panel → **Inventario**.
2. Cada vehículo tiene un UUID en la base de datos; puedes leerlo desde la API autenticada `GET /api/cars` en el panel o guardar el ID al crear el auto y usarlo en la landing.

## SQL y políticas (Supabase)

- El archivo `supabase/migrations/001_initial.sql` crea tablas, índices, **RLS** activado y suscripción a **Realtime** en `track_events`.
- Las escrituras desde la landing pasan por **Next.js** con `SUPABASE_SERVICE_ROLE_KEY` (nunca expongas esa clave en el navegador).

## Comportamiento en tiempo casi real

El dashboard hace polling a `/api/metrics` cada ~2,5 s. Cada evento nuevo aparece en gráficas y tablas sin recargar la página.
