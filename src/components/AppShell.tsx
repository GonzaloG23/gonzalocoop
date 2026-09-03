import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarRange, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cargarContexto } from "@/lib/libro";
import { Button } from "@/components/ui/button";

export function useContexto() {
  return useQuery({ queryKey: ["contexto"], queryFn: cargarContexto, staleTime: 30_000 });
}

const nav = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/libro", label: "Libro mensual", icon: BookOpenCheck },
  { to: "/anual", label: "Resumen anual", icon: CalendarRange },
] as const;

export function AppShell({
  children,
  titulo,
  descripcion,
  acciones,
}: {
  children: ReactNode;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  const navigate = useNavigate();
  const { data: ctx } = useContexto();

  async function salir() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/panel" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-base font-semibold">Libro de Cooperadoras</span>
              <span className="block text-xs opacity-75">Provincia de Tucumán</span>
            </span>
          </Link>

          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm opacity-80 transition-colors hover:bg-sidebar-accent hover:opacity-100"
                activeProps={{ className: "bg-sidebar-accent opacity-100 font-medium" }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            {ctx?.esAuditor && (
              <Link
                to="/auditoria"
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm opacity-80 transition-colors hover:bg-sidebar-accent hover:opacity-100"
                activeProps={{ className: "bg-sidebar-accent opacity-100 font-medium" }}
              >
                <ShieldCheck className="h-4 w-4" />
                Auditoría
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-xs">
            <span className="hidden opacity-80 sm:inline">{ctx?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={salir}
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">{titulo}</h1>
            {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
        {children}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Registro inalterable: los movimientos no se editan ni se eliminan, se corrigen con ajustes contables.
      </footer>
    </div>
  );
}
