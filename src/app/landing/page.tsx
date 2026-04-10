import Link from "next/link";
import { LandingTrackButtons } from "@/components/landing/LandingTrackButtons";

export const metadata = {
  title: "Landing — Tracking demo",
  description: "Demostración de eventos view_car, click_whatsapp y click_form",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070a12] px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-cyan-500/80">
          SIGMA AI AGENCY
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Landing — eventos de seguimiento
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Los botones envían POST a{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-cyan-200">
            NEXT_PUBLIC_API_URL/api/track
          </code>
          . Configura la variable en{" "}
          <code className="text-zinc-300">.env.local</code> (p. ej.{" "}
          <code className="text-zinc-300">http://localhost:3000</code>).
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-xl">
        <LandingTrackButtons />
      </div>

      <p className="mt-10 text-center text-sm text-zinc-500">
        <Link href="/login" className="text-cyan-400/90 underline-offset-4 hover:underline">
          Ir al panel
        </Link>
      </p>
    </div>
  );
}
