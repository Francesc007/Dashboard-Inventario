import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // CORS por ruta en los route handlers (p. ej. /api/track, /api/cars).
  // No usar Access-Control-Allow-Origin: * global en /api: choca con credenciales
  // y duplica cabeceras respecto a withCors().
};

export default nextConfig;