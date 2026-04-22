"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/tracking";
import type { TrackEventInput } from "@/lib/tracking";

const EVENTS: {
  type: TrackEventInput;
  label: string;
  description: string;
  vehicleName?: string;
}[] = [
  {
    type: "view_car",
    label: "Ver auto",
    description: "Simula la vista de detalle de un vehículo",
  },
  {
    type: "whatsapp_click",
    label: "WA flotante (general)",
    description: 'Registra whatsapp_click + vehicle "Consulta General"',
    vehicleName: "Consulta General",
  },
  {
    type: "whatsapp_click",
    label: "WA desde ficha",
    description: "whatsapp_click con vehicleName = marca + modelo (rellena UUID arriba)",
  },
  {
    type: "form_submit",
    label: "Envío formulario",
    description: "Solo form_submit; incluye modelo en vehicleName o carId",
  },
];

export function LandingTrackButtons() {
  const [carId, setCarId] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function send(
    type: TrackEventInput,
    label: string,
    vehicleName?: string,
  ) {
    setLastSent(null);
    setPendingKey(label);
    const vn =
      vehicleName?.trim() ||
      (vehicleLabel.trim() ? vehicleLabel.trim() : undefined);
    await trackEvent(type, {
      carId: carId.trim() || null,
      vehicleName: vn,
      metadata: { source: "landing" },
    });
    setPendingKey(null);
    setLastSent(label);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-400">
          ID del vehículo (UUID, opcional)
        </label>
        <input
          type="text"
          placeholder="Ej. copiado desde Inventario en el panel"
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
          className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600"
        />
        <label className="mt-3 block text-xs font-medium text-zinc-400">
          Nombre del auto (Marca + modelo, como en inventario)
        </label>
        <input
          type="text"
          placeholder='Ej. Mercedes Benz EQS · o "Consulta General"'
          value={vehicleLabel}
          onChange={(e) => setVehicleLabel(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600"
        />
      </div>

      <div className="grid gap-3">
        {EVENTS.map(({ type, label, description, vehicleName }) => (
          <button
            key={`${type}-${label}`}
            type="button"
            disabled={pendingKey !== null}
            onClick={() => void send(type, label, vehicleName)}
            className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-blue-950/50 to-cyan-950/30 px-4 py-4 text-left transition hover:border-cyan-400/50 hover:from-blue-900/40 disabled:opacity-50"
          >
            <span className="block font-semibold text-white">{label}</span>
            <span className="mt-1 block text-xs text-zinc-400">{description}</span>
            <span className="mt-2 inline-block rounded bg-black/30 px-2 py-0.5 font-mono text-[10px] text-cyan-300/90">
              {type}
            </span>
            {pendingKey === label && (
              <span className="ml-2 text-xs text-zinc-500">Enviando…</span>
            )}
          </button>
        ))}
      </div>

      {lastSent && (
        <p className="text-center text-sm text-emerald-400/90">
          Último evento enviado: <strong>{lastSent}</strong>
        </p>
      )}
    </div>
  );
}
