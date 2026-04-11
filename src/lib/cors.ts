import { NextResponse } from "next/server";

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Siempre permitidos además de ALLOWED_ORIGINS (landing en Vercel, etc.). */
const DEFAULT_EXTRA_ORIGINS = ["https://mercedes-benz-two.vercel.app"];

/** Orígenes permitidos desde ALLOWED_ORIGINS (coma). Vacío o * = cualquier origen. */
export function getAllowedOriginsList(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw?.trim()) {
    return ["*"];
  }
  const fromEnv = raw
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter(Boolean);
  if (fromEnv.includes("*")) {
    return ["*"];
  }
  return [...new Set([...fromEnv, ...DEFAULT_EXTRA_ORIGINS])];
}

function allowsAnyOrigin(): boolean {
  const list = getAllowedOriginsList();
  return list.includes("*");
}

/**
 * Valor para Access-Control-Allow-Origin, o null si no debe enviarse (no permitido).
 */
export function getAccessControlAllowOrigin(request: Request): string | null {
  const list = getAllowedOriginsList();
  const origin = request.headers.get("origin");

  if (allowsAnyOrigin()) {
    return origin ?? "*";
  }

  if (!origin) {
    return null;
  }

  const normalized = normalizeOrigin(origin);
  if (list.some((o) => normalizeOrigin(o) === normalized)) {
    return origin;
  }

  return null;
}

/** Si el navegador envía Origin, debe estar en la lista (salvo modo *). */
export function isTrackOriginAllowed(request: Request): boolean {
  if (allowsAnyOrigin()) {
    return true;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  return getAccessControlAllowOrigin(request) !== null;
}

export function withCors(
  request: Request,
  response: NextResponse,
): NextResponse {
  const allowOrigin = getAccessControlAllowOrigin(request);

  if (allowOrigin !== null) {
    response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  }

  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, x-track-key, Authorization",
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  if (request.headers.get("origin")) {
    response.headers.set("Vary", "Origin");
  }

  return response;
}

/** CORS para rutas API de solo lectura (GET / JSON público). */
export function withApiReadCors(
  request: Request,
  response: NextResponse,
): NextResponse {
  const allowOrigin = getAccessControlAllowOrigin(request);

  if (allowOrigin !== null) {
    response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, HEAD, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-track-key",
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  if (request.headers.get("origin")) {
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export function apiReadCorsPreflightResponse(request: Request): NextResponse {
  const origin = request.headers.get("origin");

  if (origin && !isTrackOriginAllowed(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const res = new NextResponse(null, { status: 204 });
  return withApiReadCors(request, res);
}

export function corsPreflightResponse(request: Request): NextResponse {
  const origin = request.headers.get("origin");

  if (origin && !isTrackOriginAllowed(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const res = new NextResponse(null, { status: 204 });
  return withCors(request, res);
}
