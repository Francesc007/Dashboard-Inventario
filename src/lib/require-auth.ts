import { cookies } from "next/headers";
import { COOKIE, verifySessionToken } from "@/lib/auth";

export async function requireAuth(): Promise<Response | null> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t || !(await verifySessionToken(t))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
