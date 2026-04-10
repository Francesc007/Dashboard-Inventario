import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const COOKIE = "dashboard_session";

function getSecret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  }
  return new SignJWT({ sub: "admin", v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t) return false;
  return verifySessionToken(t);
}

export { COOKIE };
