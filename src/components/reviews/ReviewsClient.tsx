"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { ReviewRow } from "@/types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  location: string;
  vehicle_model: string;
  vehicle_year: string;
  photo_url: string;
  comment: string;
};

const empty: FormState = {
  name: "",
  location: "",
  vehicle_model: "",
  vehicle_year: "",
  photo_url: "",
  comment: "",
};

/** Separa modelo / año al editar (columnas propias o texto legacy en `model` tipo "Jetta · 2024"). */
function parseReviewFormVehicle(rv: ReviewRow): {
  vehicle_model: string;
  vehicle_year: string;
} {
  const yCol =
    rv.vehicle_year != null && !Number.isNaN(Number(rv.vehicle_year))
      ? Math.round(Number(rv.vehicle_year))
      : null;

  if (yCol != null && yCol >= 1900 && yCol <= 2100) {
    const vm = (rv.vehicle_model ?? "").trim();
    if (vm) {
      return { vehicle_model: vm, vehicle_year: String(yCol) };
    }
    const combined = (rv.model ?? "").trim();
    const stripped = combined
      .replace(new RegExp(`\\s*·\\s*${yCol}\\s*$`), "")
      .trim();
    return {
      vehicle_model: stripped,
      vehicle_year: String(yCol),
    };
  }

  const vmOnly = (rv.vehicle_model ?? "").trim();
  if (vmOnly) {
    return { vehicle_model: vmOnly, vehicle_year: "" };
  }

  const raw = (rv.model ?? "").trim();
  if (!raw) {
    return { vehicle_model: "", vehicle_year: "" };
  }

  const parts = raw.split(/\s*·\s*/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    const y = Number(last);
    if (
      /^\d{4}$/.test(last) &&
      Number.isInteger(y) &&
      y >= 1900 &&
      y <= 2100
    ) {
      return {
        vehicle_model: parts.slice(0, -1).join(" · ").trim(),
        vehicle_year: String(y),
      };
    }
  }

  if (parts.length === 1 && /^\d{4}$/.test(parts[0]!)) {
    const y = Number(parts[0]);
    if (y >= 1900 && y <= 2100) {
      return { vehicle_model: "", vehicle_year: String(y) };
    }
  }

  return { vehicle_model: raw, vehicle_year: "" };
}

export function ReviewsClient() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rRes = await fetch("/api/reviews");
    if (!rRes.ok) {
      setError("No se pudieron cargar los datos");
      setLoading(false);
      return;
    }
    const rj = (await rRes.json()) as { reviews: ReviewRow[] };
    setReviews(rj.reviews);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(empty);
    setModal("create");
  }

  function openEdit(rv: ReviewRow) {
    setEditingId(rv.id);
    const { vehicle_model, vehicle_year } = parseReviewFormVehicle(rv);
    setForm({
      name: rv.name,
      location: rv.location ?? "",
      vehicle_model,
      vehicle_year,
      photo_url: rv.photo_url ?? "",
      comment: rv.comment,
    });
    setModal("edit");
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Error al subir");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    setForm((f) => ({ ...f, photo_url: url }));
  }

  function removePhoto() {
    setForm((f) => ({ ...f, photo_url: "" }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const yearStr = form.vehicle_year.trim();
    const yearParsed =
      yearStr === ""
        ? null
        : (() => {
            const n = Number(yearStr);
            return Number.isFinite(n) ? n : null;
          })();
    const payload = {
      car_id: null,
      name: form.name,
      location: form.location || null,
      model: null,
      vehicle_model: form.vehicle_model || null,
      vehicle_year: yearParsed,
      photo_url: form.photo_url || null,
      comment: form.comment,
    };
    const url = editingId ? `/api/reviews/${editingId}` : "/api/reviews";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Error al guardar");
      return;
    }
    setModal(null);
    void load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta reseña?")) return;
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (!res.ok) setError("No se pudo eliminar");
    else void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            SIGMA AI AGENCY
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Testimonios de clientes satisfechos
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          aria-pressed={modal === "create"}
          className={cn(
            "inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-[transform,box-shadow,filter] duration-150 sm:w-auto",
            modal === "create"
              ? "translate-y-0.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] brightness-[0.92] ring-1 ring-inset ring-black/40"
              : "shadow-lg shadow-cyan-950/30 hover:brightness-105",
            "active:translate-y-0.5 active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] active:brightness-[0.92] active:ring-1 active:ring-inset active:ring-black/40",
          )}
        >
          <Plus className="h-4 w-4" />
          Nueva reseña
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {reviews.map((rv) => (
            <motion.article
              key={rv.id}
              initial={false}
              className="group flex min-w-0 items-stretch gap-4 overflow-hidden rounded-2xl border border-zinc-400/35 bg-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(212,212,216,0.22),0_0_28px_-10px_rgba(161,161,170,0.2),inset_0_1px_0_0_rgba(255,255,255,0.07)] ring-1 ring-zinc-400/25"
            >
              <div className="relative w-32 shrink-0 self-stretch min-h-[7.5rem] overflow-hidden rounded-xl bg-zinc-900">
                {rv.photo_url ? (
                  <Image
                    src={rv.photo_url}
                    alt={rv.name}
                    fill
                    className="object-cover transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.05]"
                    sizes="128px"
                  />
                ) : (
                  <div className="flex h-full min-h-[7.5rem] items-center justify-center text-[10px] text-zinc-600">
                    Sin foto
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{rv.name}</p>
                <p className="text-xs text-zinc-500">
                  {rv.location ?? "—"}
                  {(() => {
                    const lineModel = rv.vehicle_model || rv.model;
                    const bits = [
                      lineModel,
                      rv.vehicle_year != null && !Number.isNaN(Number(rv.vehicle_year))
                        ? String(rv.vehicle_year)
                        : null,
                    ].filter(Boolean);
                    return bits.length ? ` · ${bits.join(" · ")}` : "";
                  })()}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-zinc-300">
                  {rv.comment}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(rv)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.08] py-1.5 text-xs font-medium text-zinc-200 transition-all duration-150 hover:border-white/[0.14] hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.08)] active:bg-white/[0.14] active:brightness-110"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(rv.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] p-2 text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-300"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0c0e18] p-5 shadow-2xl sm:p-6"
            >
              <h3 className="text-lg font-semibold text-white">
                {editingId ? "Editar reseña" : "Nueva reseña"}
              </h3>
              <div className="mt-4 space-y-3 text-sm">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Nombre</span>
                  <input
                    className="panel-field"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Ubicación</span>
                  <input
                    className="panel-field"
                    value={form.location}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, location: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Modelo</span>
                  <input
                    className="panel-field"
                    placeholder="Ej. Jetta, CR-V Touring…"
                    value={form.vehicle_model}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vehicle_model: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Año</span>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    className="panel-field"
                    placeholder="Ej. 2024"
                    value={form.vehicle_year}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vehicle_year: e.target.value }))
                    }
                  />
                </label>
                <div className="space-y-3">
                  <span className="text-xs font-medium text-zinc-400">Foto</span>
                  <div className="flex flex-wrap items-start gap-3">
                    {form.photo_url ? (
                      <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 shadow-inner ring-1 ring-white/5">
                        <Image
                          src={form.photo_url}
                          alt="Foto de la reseña"
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-zinc-200 backdrop-blur-sm transition-colors hover:bg-red-500/85 hover:text-white"
                          aria-label="Quitar foto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-[11px] text-zinc-500">
                        Vista previa
                      </div>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 self-center rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]">
                      <Upload className="h-3.5 w-3.5" />
                      {form.photo_url ? "Cambiar imagen" : "Subir imagen"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadPhoto(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-400">Comentario</span>
                  <textarea
                    rows={4}
                    className="panel-field min-h-[7rem] resize-y"
                    value={form.comment}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, comment: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-white/[0.04]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || uploading}
                  onClick={() => void save()}
                  className="rounded-lg bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
