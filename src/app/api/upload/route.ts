import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { STORAGE_BUCKET } from "@/lib/storage-inventory";
import { randomUUID } from "crypto";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Falta el campo file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Archivo demasiado grande (máx. 8 MB)" },
      { status: 413 },
    );
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { error: "Tipo no permitido (usa JPEG, PNG, WebP o GIF)" },
      { status: 415 },
    );
  }

  const ext =
    type === "image/jpeg"
      ? "jpg"
      : type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : "gif";

  const path = `uploads/${randomUUID()}.${ext}`;

  try {
    const supabase = createAdminClient();
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buf, {
      contentType: type,
      upsert: false,
    });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "No se pudo subir al almacenamiento" },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: publicUrl, path });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al subir" },
      { status: 500 },
    );
  }
}
