/**
 * Cliente mínimo para la landing: obtiene autos públicos y normaliza URLs del bucket.
 *
 * Uso:
 *   <script src="https://TU-PANEL.vercel.app/carApi.js"></script>
 *   <script>
 *     carApi.fetchCars("https://TU-PANEL.vercel.app").then(console.log);
 *   </script>
 *
 * Las imágenes deben usar el bucket público `inventory` en Supabase:
 *   .../storage/v1/object/public/inventory/...
 * Si en la base aún hay URLs con `/object/public/cars/`, aquí se reescriben a `inventory`.
 */
(function (root) {
  var BUCKET = "inventory";

  function normalizeUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.indexOf("/object/public/cars/") === -1) return url;
    return url.replace(/\/object\/public\/cars\//g, "/object/public/" + BUCKET + "/");
  }

  function normalizeCar(car) {
    if (!car || typeof car !== "object") return car;
    return {
      ...car,
      cover_image_url: normalizeUrl(car.cover_image_url) ?? null,
      gallery_urls: Array.isArray(car.gallery_urls)
        ? car.gallery_urls.map(normalizeUrl)
        : [],
    };
  }

  function normalizeReview(rv) {
    if (!rv || typeof rv !== "object") return rv;
    return {
      ...rv,
      photo_url: normalizeUrl(rv.photo_url) ?? null,
    };
  }

  /**
   * Envía un evento a POST /api/track del panel. **Siempre pasa carId** (UUID del coche)
   * cuando el usuario interactúa en la ficha de un auto; si no, el dashboard no puede
   * atribuir WA / form / leads a esa fila.
   *
   * @param {string} apiBase - Misma URL que en fetchCars (origen del panel).
   * @param {{ eventType: string, carId?: string|null, carLabel?: string|null, vehicleName?: string|null, metadata?: object, trackKey?: string }} opts
   *   eventType: "view_car" | "whatsapp_click" | "form_submit" | … (ver API /api/track)
   *   carId: UUID cuando aplique (ficha de auto).
   *   carLabel: preferido — texto que guarda la BD en car_label (Consulta General, Marca Modelo, etc.).
   *   vehicleName: alias de carLabel si no envías carLabel.
   */
  function track(apiBase, opts) {
    var base = (apiBase || "").replace(/\/+$/, "");
    if (!base) {
      return Promise.reject(new Error("carApi.track: falta apiBase"));
    }
    opts = opts || {};
    var meta =
      opts.metadata && typeof opts.metadata === "object" ? opts.metadata : {};
    var lbl =
      (opts.carLabel && String(opts.carLabel).trim()) ||
      (opts.vehicleName && String(opts.vehicleName).trim()) ||
      "";
    if (lbl) {
      meta = Object.assign({}, meta, { car_label: lbl, vehicle_name: lbl });
    }
    var body = JSON.stringify({
      eventType: opts.eventType,
      carId: opts.carId != null ? opts.carId : null,
      carLabel: lbl || undefined,
      vehicleName:
        opts.vehicleName != null && String(opts.vehicleName).trim()
          ? String(opts.vehicleName).trim()
          : undefined,
      metadata: meta,
    });
    var headers = { "Content-Type": "application/json" };
    var key = opts.trackKey || (typeof window !== "undefined" && window.__TRACK_API_KEY__);
    if (key) headers["x-track-key"] = key;
    return fetch(base + "/api/track", {
      method: "POST",
      headers: headers,
      body: body,
      mode: "cors",
      credentials: "omit",
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var msg = "HTTP " + res.status;
          try {
            var j = JSON.parse(txt);
            if (j && j.error) msg = String(j.error);
          } catch (_) {
            if (txt) msg = txt.slice(0, 200);
          }
          throw new Error(msg);
        });
      }
      return res.json().catch(function () {
        return { ok: true };
      });
    });
  }

  var api = {
    STORAGE_BUCKET: BUCKET,

    normalizeInventoryImageUrl: normalizeUrl,

    track: track,

    /**
     * @param {string} apiBase - Origen del panel (sin barra final), p. ej. https://xxx.vercel.app
     * @returns {Promise<Array>}
     */
    fetchCars: function (apiBase) {
      var base = (apiBase || "").replace(/\/+$/, "");
      if (!base) {
        return Promise.reject(new Error("carApi.fetchCars: falta apiBase"));
      }
      return fetch(base + "/api/cars", { method: "GET", credentials: "omit" })
        .then(function (res) {
          if (!res.ok) throw new Error("carApi: " + res.status);
          return res.json();
        })
        .then(function (data) {
          var list = data && data.cars ? data.cars : [];
          return list.map(normalizeCar);
        });
    },

    /**
     * Reseñas públicas (misma política CORS que fetchCars). Se actualizan al recargar o al volver a llamar.
     * @param {string} apiBase - Origen del panel (sin barra final)
     * @returns {Promise<Array>}
     */
    fetchReviews: function (apiBase) {
      var base = (apiBase || "").replace(/\/+$/, "");
      if (!base) {
        return Promise.reject(new Error("carApi.fetchReviews: falta apiBase"));
      }
      return fetch(base + "/api/reviews", { method: "GET", credentials: "omit" })
        .then(function (res) {
          if (!res.ok) throw new Error("carApi.reviews: " + res.status);
          return res.json();
        })
        .then(function (data) {
          var list = data && data.reviews ? data.reviews : [];
          return list.map(normalizeReview);
        });
    },
  };

  root.carApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
