"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { SigmaLogo } from "@/components/brand/SigmaLogo";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Error al iniciar sesión");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(6,182,212,0.1),_transparent_55%)]" />
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-cyan-400/50 bg-card/90 p-8 shadow-[0_0_0_1px_rgba(34,211,238,0.45),0_0_36px_-2px_rgba(34,211,238,0.4),0_0_64px_-8px_rgba(59,130,246,0.25),0_20px_50px_-12px_rgba(15,23,42,0.85)] ring-1 ring-cyan-400/35 backdrop-blur-xl"
      >
        <div className="mb-8 flex w-full justify-center px-2">
          <SigmaLogo width={200} height={62} className="min-h-[62px]" priority />
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-muted/30 py-2.5 pl-4 pr-11 text-sm text-foreground outline-none ring-ring/40 transition placeholder:text-muted-foreground focus:border-primary focus:ring-2"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 transition-all duration-150 ease-out hover:brightness-105 hover:shadow-xl hover:shadow-cyan-500/30 active:translate-y-0.5 active:scale-[0.98] active:shadow-[inset_0_3px_14px_rgba(0,0,0,0.45)] active:brightness-95 disabled:pointer-events-none disabled:opacity-50 disabled:hover:brightness-100 disabled:active:translate-y-0 disabled:active:scale-100 disabled:active:shadow-lg"
          >
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
