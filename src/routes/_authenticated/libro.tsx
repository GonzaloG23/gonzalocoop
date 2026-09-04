import { createFileRoute } from "@tanstack/react-router";

import { AppShell, useContexto } from "@/components/AppShell";
import { LibroMensual } from "@/components/LibroMensual";

export const Route = createFileRoute("/_authenticated/libro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Libro mensual | Libro de Cooperadoras" },
      {
        name: "description",
        content:
          "Carga de ingresos y egresos del mes, saldo inicial heredado, saldo final calculado y cierre del período.",
      },
      { property: "og:title", content: "Libro mensual de la cooperadora" },
      {
        property: "og:description",
        content: "Movimientos del mes con rubro y comprobante, y cierre del período.",
      },
    ],
  }),
  component: LibroPage,
});

function LibroPage() {
  const { data: ctx, isLoading } = useContexto();

  return (
    <AppShell
      titulo="Libro mensual"
      descripcion={ctx?.cooperadora?.nombre ?? "Movimientos del mes"}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && !ctx?.cooperadora && (
        <p className="text-sm text-muted-foreground">
          Todavía no registraste tu cooperadora. Hacelo desde el panel para empezar a cargar
          movimientos.
        </p>
      )}
      {ctx?.cooperadora && <LibroMensual cooperadora={ctx.cooperadora} />}
    </AppShell>
  );
}
