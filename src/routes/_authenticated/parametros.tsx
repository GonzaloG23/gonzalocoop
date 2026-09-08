import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import { cargarParametros, guardarParametros } from "@/lib/libro";
import { money, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/parametros")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Parámetros de control | Libro de Cooperadoras" },
      {
        name: "description",
        content: "Día límite de cierre mensual y tope por gasto individual para las observaciones de control.",
      },
    ],
  }),
  component: ParametrosPage,
});

function ParametrosPage() {
  const { data: ctx, isLoading } = useContexto();
  const queryClient = useQueryClient();
  const parametros = useQuery({ queryKey: ["parametros"], queryFn: cargarParametros });

  const esAuditor = !!ctx?.esAuditor;
  const [dia, setDia] = useState("10");
  const [tope, setTope] = useState("500000");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!parametros.data) return;
    setDia(String(parametros.data.dia_limite_cierre));
    setTope(String(num(parametros.data.tope_egreso)));
  }, [parametros.data]);

  async function guardar() {
    if (!parametros.data) return;
    const diaNum = Number(dia);
    const topeNum = Number(tope.replace(/\./g, "").replace(",", "."));
    if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31) {
      toast.error("El día límite debe ser un número entre 1 y 31");
      return;
    }
    if (!Number.isFinite(topeNum) || topeNum < 0) {
      toast.error("El tope debe ser un monto válido");
      return;
    }
    setGuardando(true);
    try {
      await guardarParametros({ id: parametros.data.id, dia_limite_cierre: diaNum, tope_egreso: topeNum });
      await queryClient.invalidateQueries({ queryKey: ["parametros"] });
      toast.success("Parámetros guardados. Las observaciones se recalculan con los nuevos valores.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los parámetros");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppShell
      titulo="Parámetros de control"
      descripcion="Valores provinciales que usan las observaciones de todos los ejercicios."
    >
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && !esAuditor && (
        <p className="text-sm text-muted-foreground">
          Solo los auditores pueden ver y modificar estos parámetros.
        </p>
      )}
      {esAuditor && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <SlidersHorizontal className="h-5 w-5" /> Observaciones automáticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dia">Día límite para cerrar cada mes</Label>
              <Input
                id="dia"
                type="number"
                min={1}
                max={31}
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si un mes se cierra después del día {dia || "…"} del mes siguiente, se marca como
                "cerrado fuera de plazo".
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tope">Tope por gasto individual (en pesos)</Label>
              <Input id="tope" inputMode="decimal" value={tope} onChange={(e) => setTope(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Todo egreso que supere {money(Number(tope.replace(/\./g, "").replace(",", ".")) || 0)} queda
                observado en el libro del mes.
              </p>
            </div>
            <Button onClick={guardar} disabled={guardando || !parametros.data}>
              {guardando ? "Guardando…" : "Guardar parámetros"}
            </Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
