import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

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
  const tipo = new URLSearchParams(window.location.search).get("tipo");
  const tipoDirecto = tipo === "ingreso" || tipo === "egreso" ? tipo : null;

  useEffect(() => {
    if (!tipoDirecto || !ctx?.cooperadora) return;

    const abrirFormulario = window.setTimeout(() => {
      const boton = Array.from(document.querySelectorAll("button")).find(
        (elemento) => elemento.textContent?.trim().includes("Nuevo movimiento"),
      ) as HTMLButtonElement | undefined;

      boton?.click();

      window.setTimeout(() => {
        const dialogo = document.querySelector('[role="dialog"]');
        if (!dialogo) return;

        const etiquetaTipo = Array.from(dialogo.querySelectorAll("label")).find(
          (elemento) => elemento.textContent?.trim() === "Tipo",
        );
        const campoTipo = etiquetaTipo?.parentElement as HTMLElement | null;
        const selectTipo = campoTipo?.querySelector('[role="combobox"]') as HTMLButtonElement | null;

        selectTipo?.click();

        window.setTimeout(() => {
          const opcion = Array.from(document.querySelectorAll('[role="option"]')).find(
            (elemento) => elemento.textContent?.trim().toLowerCase() === tipoDirecto,
          ) as HTMLElement | undefined;
          opcion?.click();

          window.setTimeout(() => {
            if (campoTipo) campoTipo.style.display = "none";
          }, 50);
        }, 100);
      }, 200);
    }, 150);

    return () => window.clearTimeout(abrirFormulario);
  }, [tipoDirecto, ctx?.cooperadora?.id]);

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
