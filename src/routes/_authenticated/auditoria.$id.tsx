import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, useContexto } from "@/components/AppShell";
import { LibroMensual } from "@/components/LibroMensual";
import type { Cooperadora } from "@/lib/libro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/auditoria/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Libro de la cooperadora | Auditoría" },
      {
        name: "description",
        content:
          "Vista de auditoría del libro mensual de una cooperadora escolar: movimientos, saldos y observaciones.",
      },
      { property: "og:title", content: "Libro de la cooperadora | Auditoría" },
      {
        property: "og:description",
        content: "Revisión mes a mes de los movimientos y saldos de una cooperadora escolar.",
      },
    ],
  }),
  component: AuditoriaLibroPage,
});

function AuditoriaLibroPage() {
  const { id } = Route.useParams();
  const { data: ctx } = useContexto();

  const coop = useQuery({
    queryKey: ["cooperadora", id],
    queryFn: async (): Promise<Cooperadora | null> => {
      const { data, error } = await supabase
        .from("cooperadoras")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Cooperadora | null) ?? null;
    },
    enabled: !!ctx?.esAuditor,
  });

  if (ctx && !ctx.esAuditor) {
    return (
      <AppShell titulo="Auditoría" descripcion="Acceso reservado a la auditoría.">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="font-serif">Sin permisos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu cuenta no tiene permisos de auditoría para ver este libro.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const volver = (
    <Button asChild variant="outline" size="sm">
      <Link to="/auditoria">
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver
      </Link>
    </Button>
  );

  if (coop.isLoading) {
    return (
      <AppShell titulo="Cargando libro…" acciones={volver}>
        <p className="text-sm text-muted-foreground">Buscando la cooperadora…</p>
      </AppShell>
    );
  }

  if (!coop.data) {
    return (
      <AppShell titulo="Cooperadora no encontrada" acciones={volver}>
        <p className="text-sm text-muted-foreground">
          No encontramos esa cooperadora o no tenés acceso a sus datos.
        </p>
      </AppShell>
    );
  }

  const c = coop.data;

  return (
    <AppShell
      titulo={c.nombre}
      descripcion={[c.localidad, c.cue ? `CUE ${c.cue}` : null, `Ejercicio ${c.ejercicio}`]
        .filter(Boolean)
        .join(" · ")}
      acciones={volver}
    >
      <LibroMensual cooperadora={c} soloLectura />
    </AppShell>
  );
}
