"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  MessageSquareQuote,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { SigmaLogo } from "@/components/brand/SigmaLogo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventario", icon: Car },
  { href: "/reviews", label: "Reseñas", icon: MessageSquareQuote },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {nav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <span
              className={cn(
                "flex items-center gap-3.5 rounded-lg px-3 py-3 text-base transition-all duration-150 ease-out",
                active
                  ? "translate-y-px border border-primary/25 bg-primary/15 text-primary shadow-[inset_0_2px_10px_rgba(0,0,0,0.28)] dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.45)]"
                  : "border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:translate-y-px active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.12)] dark:active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]",
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Barra superior móvil: logo centrado + hamburguesa */}
      <header className="fixed inset-x-0 top-0 z-40 flex min-h-[calc(4.25rem+env(safe-area-inset-top))] items-center justify-center border-b border-cyan-500/25 bg-card/95 pt-[env(safe-area-inset-top)] shadow-[0_8px_32px_-12px_rgba(6,182,212,0.2)] ring-1 ring-cyan-500/15 backdrop-blur-xl md:hidden">
        <SigmaLogo
          width={280}
          height={64}
          className="h-[52px] w-auto max-w-[min(72vw,280px)] object-contain object-center"
          priority
        />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-foreground shadow-inner transition hover:bg-cyan-500/15"
          aria-expanded={mobileOpen}
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            aria-label="Cerrar menú"
            onClick={closeMobile}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-l border-cyan-500/35 bg-card/98 shadow-[-12px_0_48px_rgba(0,0,0,0.45)] ring-1 ring-cyan-500/20 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Menú
              </span>
              <button
                type="button"
                onClick={closeMobile}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={closeMobile} />
            <div className="border-t border-border p-3">
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  void logout();
                }}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-lg px-3 py-3 text-left text-base transition-colors",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <LogOut className="h-5 w-5 shrink-0 opacity-90" />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-cyan-500/35 bg-card/95 shadow-[4px_0_36px_-6px_rgba(6,182,212,0.22),inset_0_0_60px_-30px_rgba(34,211,238,0.06)] ring-1 ring-cyan-500/20 backdrop-blur-xl md:flex">
        <div className="flex items-center justify-center border-b border-border px-4 py-6">
          <SigmaLogo
            width={360}
            height={84}
            className="mx-auto h-[100px] w-auto max-w-full object-contain object-center"
            priority
          />
        </div>
        <NavLinks pathname={pathname} />
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "flex w-full items-center gap-3.5 rounded-lg px-3 py-3 text-left text-base transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0 opacity-90" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pt-[calc(4.25rem+env(safe-area-inset-top))] md:ml-64 md:pt-0">
        <main className="flex-1 px-4 py-5 sm:px-6 md:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
