"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  MessageSquareQuote,
  LogOut,
} from "lucide-react";
import { SigmaLogo } from "@/components/brand/SigmaLogo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventario", icon: Car },
  { href: "/reviews", label: "Reseñas", icon: MessageSquareQuote },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-cyan-500/35 bg-card/95 shadow-[4px_0_36px_-6px_rgba(6,182,212,0.22),inset_0_0_60px_-30px_rgba(34,211,238,0.06)] ring-1 ring-cyan-500/20 backdrop-blur-xl">
        <div className="flex items-center justify-center border-b border-border px-4 py-6">
          <SigmaLogo
            width={360}
            height={84}
            className="mx-auto h-[100px] w-auto max-w-full object-contain object-center"
            priority
          />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
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
      <div className="ml-64 flex min-h-screen flex-1 flex-col">
        <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
