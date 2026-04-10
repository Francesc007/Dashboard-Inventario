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

  var api = {
    STORAGE_BUCKET: BUCKET,

    normalizeInventoryImageUrl: normalizeUrl,

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
  };

  root.carApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
