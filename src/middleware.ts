import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "dashboard_session";

export async function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE)?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      ok = true;
    } catch {
      ok = false;
    }
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/inventory/:path*", "/reviews/:path*"],
};
