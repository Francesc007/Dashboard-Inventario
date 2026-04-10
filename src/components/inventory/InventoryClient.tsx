"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { CarRow, CarCondition } from "@/types";
import { compressImageForUpload } from "@/lib/compress-image-upload";
import { formatCurrency, formatIntegerThousands } from "@/lib/utils";

const defaultYear = () => new Date().getFullYear();

/** Solo dígitos del precio; vacío = sin valor mostrado (no “0” inicial). */
function formatPriceThousandsDisplay(digits: string): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) return "";
  return formatIntegerThousands(n);
}

function formatAccelOnCard(sec: number | null): string | null {
  if (sec == null || Number.isNaN(Number(sec))) return null;
  const v = Number(sec);
  const t = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, "");
  return `${t} s`;
}

function formatHpOnCard(hp: number | null): string | null {
  if (hp == null || Number.isNaN(Number(hp))) return null;
  return `${formatIntegerThousands(Math.round(Number(hp)))} HP`;
}

const emptyForm = () => ({
  brand: "",
  model: "",
  year: defaultYear(),
  priceDigits: "",
  discount_percent: 0,
  mileage_km: 0,
  engine: "",
  acceleration_0_100_sec: "" as string | number,
  power_hp: "" as string | number,
  condition: "nuevo" as CarCondition,
  cover_image_url: "",
  gallery_urls: [] as string[],
});

export function InventoryClient() {
  const [cars, setCars] = useState<CarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/cars");
    if (!res.ok) {
      setError("No se pudo cargar el inventario");
      setLoading(false);
      return;
    }
    const j = (await res.json()) as { cars: CarRow[] };
    setCars(j.cars);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModal("create");
  }

  function openEdit(c: CarRow) {
    setEditingId(c.id);
    setForm({
      brand: c.brand,
      model: c.model,
      year: c.year,
      priceDigits:
        c.price != null && Number(c.price) > 0
          ? String(Math.round(Number(c.price)))
          : "",
      discount_percent: Number(c.discount_percent ?? 0),
      mileage_km: c.mileage_km,
      engine: c.engine ?? "",
      acceleration_0_100_sec: c.acceleration_0_100_sec ?? "",
      power_hp: c.power_hp ?? "",
      condition: c.condition,
      cover_image_url: c.cover_image_url ?? "",
      gallery_urls: [...(c.gallery_urls ?? [])],
    });
    setModal("edit");
  }

  async function uploadFile(file: File, slot: "cover" | "gallery") {
    setUploading(true);
    setError(null);
    let fileToSend = file;
    try {
      fileToSend = await compressImageForUpload(file);
    } catch {
      setError("No se pudo optimizar la imagen. Prueba con otro archivo.");
      setUploading(false);
      return;
    }
    const fd = new FormData();
    fd.append("file", fileToSend);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Error al subir");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    if (slot === "cover") {
      setForm((f) => ({ ...f, cover_image_url: url }));
    } else {
      setForm((f) => ({
        ...f,
        gallery_urls: [...f.gallery_urls, url].slice(0, 5),
      }));
    }
  }

  function removeCover() {
    setForm((f) => ({ ...f, cover_image_url: "" }));
  }

  function removeGalleryAt(index: number) {
    setForm((f) => ({
      ...f,
      gallery_urls: f.gallery_urls.filter((_, i) => i !== index),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      brand: form.brand,
      model: form.model,
      year: form.year,
      price:
        form.priceDigits === "" ? 0 : Number(form.priceDigits.replace(/\D/g, "")),
      discount_percent: form.discount_percent,
      mileage_km: form.mileage_km,
      engine: form.engine || null,
      acceleration_0_100_sec:
        form.acceleration_0_100_sec === "" || form.acceleration_0_100_sec === null
          ? null
          : Number(form.acceleration_0_100_sec),
      power_hp:
        form.power_hp === "" || form.power_hp === null
          ? null
          : Number(form.power_hp),
      condition: form.condition,
      cover_image_url: form.cover_image_url || null,
      gallery_urls: form.gallery_urls,
    };

    const url = editingId ? `/api/cars/${editingId}` : "/api/cars";
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
    if (!confirm("¿Eliminar este vehículo?")) return;
    const res = await fetch(`/api/cars/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("No se pudo eliminar");
      return;
    }
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            SIGMA AI AGENCY
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Portada + hasta 5 imágenes en galería
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30"
        >
          <Plus className="h-4 w-4" />
          Nuevo auto
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cars.map((c) => (
            <motion.article
              key={c.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <div className="relative aspect-[16/10] bg-zinc-900">
                {c.cover_image_url ? (
                  <Image
                    src={c.cover_image_url}
                    alt={`${c.brand} ${c.model}`}
                    fill
                    className="object-cover"
                    sizes="(max-width:768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                    Sin portada
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-white">
                  {c.brand} {c.model}
                </h2>
                <p className="text-xs text-zinc-500">
                  {c.year} · {c.condition === "nuevo" ? "Nuevo" : "Seminuevo"} ·{" "}
                  {formatIntegerThousands(c.mileage_km)} km
                </p>
                {(() => {
                  const accel = formatAccelOnCard(c.acceleration_0_100_sec);
                  const hp = formatHpOnCard(c.power_hp);
                  if (!accel && !hp) return null;
                  return (
                    <p className="mt-1 text-xs text-zinc-400">
                      {[accel, hp].filter(Boolean).join(" · ")}
                    </p>
                  );
                })()}
                <p className="mt-2 text-lg font-semibold text-emerald-400/90">
                  {formatCurrency(Number(c.price))}
                  {Number(c.discount_percent) > 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-400">
                      −{Number(c.discount_percent)}%
                    </span>
                  )}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.04]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10"
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
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0c0e18] p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-white">
                {editingId ? "Editar vehículo" : "Nuevo vehículo"}
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <label className="col-span-2">
                  <span className="text-xs text-zinc-500">Marca</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.brand}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, brand: e.target.value }))
                    }
                  />
                </label>
                <label className="col-span-2">
                  <span className="text-xs text-zinc-500">Modelo</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.model}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, model: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="text-xs text-zinc-500">Año</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.year}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        year: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="text-xs text-zinc-500">Precio (MXN)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder=""
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white placeholder:text-zinc-600"
                    value={formatPriceThousandsDisplay(form.priceDigits)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                      setForm((f) => ({ ...f, priceDigits: digits }));
                    }}
                  />
                </label>
                <label>
                  <span className="text-xs text-zinc-500">Descuento %</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.discount_percent}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        discount_percent: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="text-xs text-zinc-500">Kilometraje</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.mileage_km}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        mileage_km: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="col-span-2">
                  <span className="text-xs text-zinc-500">Condición</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.condition}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        condition: e.target.value as CarCondition,
                      }))
                    }
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="seminuevo">Seminuevo</option>
                  </select>
                </label>
                <label className="col-span-2">
                  <span className="text-xs text-zinc-500">Motor</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.engine}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, engine: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="text-xs text-zinc-500">0–100 km/h (s)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.acceleration_0_100_sec}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        acceleration_0_100_sec: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="text-xs text-zinc-500">Potencia (HP)</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white"
                    value={form.power_hp}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, power_hp: e.target.value }))
                    }
                  />
                </label>
                <div className="col-span-2 space-y-3">
                  <span className="text-xs text-zinc-500">Portada</span>
                  <div className="flex flex-wrap items-start gap-3">
                    {form.cover_image_url ? (
                      <div className="relative h-28 w-44 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 shadow-inner ring-1 ring-white/5">
                        <Image
                          src={form.cover_image_url}
                          alt="Portada"
                          fill
                          className="object-cover"
                          sizes="176px"
                        />
                        <button
                          type="button"
                          onClick={removeCover}
                          className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-zinc-200 backdrop-blur-sm transition-colors hover:bg-red-500/85 hover:text-white"
                          aria-label="Quitar portada"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-28 w-44 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-[11px] text-zinc-500">
                        Vista previa
                      </div>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 self-center rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]">
                      <Upload className="h-3.5 w-3.5" />
                      {form.cover_image_url ? "Cambiar" : "Subir"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadFile(f, "cover");
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="col-span-2 space-y-3">
                  <span className="text-xs text-zinc-500">
                    Galería ({form.gallery_urls.length}/5)
                  </span>
                  {form.gallery_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {form.gallery_urls.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80 ring-1 ring-white/5"
                        >
                          <Image
                            src={url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width:640px) 33vw, 120px"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryAt(idx)}
                            className="absolute right-1 top-1 rounded bg-black/55 p-0.5 text-zinc-200 backdrop-blur-sm transition-colors hover:bg-red-500/90 hover:text-white"
                            aria-label="Quitar imagen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] ${form.gallery_urls.length >= 5 ? "pointer-events-none opacity-40" : ""}`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Añadir imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading || form.gallery_urls.length >= 5}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadFile(f, "gallery");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
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
