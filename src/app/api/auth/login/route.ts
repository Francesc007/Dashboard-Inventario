import { NextResponse } from "next/server";
import { createSessionToken, COOKIE } from "@/lib/auth";

/**
 * Lee ADMIN_PASSWORD desde process.env (incluye .env.local en dev y variables de Vercel en prod).
 * Trim evita fallos por espacio/salto de línea al final en el archivo .env.
 */
function getAdminPassword(): string | undefined {
  const raw = process.env.ADMIN_PASSWORD;
  if (raw === undefined) return undefined;
  return raw.replace(/^\uFEFF/, "").trim();
}

export async function POST(request: Request) {
  try {
    const expected = getAdminPassword();
    if (!expected) {
      return NextResponse.json(
        {
          error:
            "El servidor no tiene ADMIN_PASSWORD configurada. Revisa .env.local en la raíz del proyecto y reinicia `npm run dev`.",
          code: "ADMIN_PASSWORD_MISSING",
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password.trim() : "";

    if (password !== expected) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    let token: string;
    try {
      token = await createSessionToken();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error:
            "No se pudo crear la sesión. Comprueba AUTH_SECRET en .env.local (mínimo 32 caracteres).",
          code: "AUTH_SECRET_INVALID",
          detail: process.env.NODE_ENV === "development" ? msg : undefined,
        },
        { status: 500 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
