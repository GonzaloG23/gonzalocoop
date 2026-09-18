import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, SlidersHorizontal } from "lucide-react";
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
        content:
          "Día límite de cierre mensual, topes de egresos y controles de cuenta bancaria y Recibos de Gastos Varios.",
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
  const [saldoMinimo, setSaldoMinimo] = useState("0");
  const [topeReciboGastosVarios, setTopeReciboGastosVarios] = useState("0");
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!parametros.data) return;
    setDia(String(parametros.data.dia_limite_cierre));
    setTope(String(num(parametros.data.tope_egreso)));
    setSaldoMinimo(String(num(parametros.data.saldo_minimo_cuenta_bancaria ?? 0)));
    setTopeReciboGastosVarios(String(num(parametros.data.tope_recibo_gastos_varios ?? 0)));
  }, [parametros.data]);

  function cargarValoresActuales() {
    if (!parametros.data) return;
    setDia(String(parametros.data.dia_limite_cierre));
    setTope(String(num(parametros.data.tope_egreso)));
    setSaldoMinimo(String(num(parametros.data.saldo_minimo_cuenta_bancaria ?? 0)));
    setTopeReciboGastosVarios(String(num(parametros.data.tope_recibo_gastos_varios ?? 0)));
  }

  async function guardar() {
    if (!parametros.data) return;

    const diaNum = Number(dia);
    const topeNum = Number(tope.replace(/\./g, "").replace(",", "."));
    const saldoMinimoNum = Number(saldoMinimo.replace(/\./g, "").replace(",", "."));
    const topeReciboNum = Number(topeReciboGastosVarios.replace(/\./g, "").replace(",", "."));

    if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31) {
      toast.error("El día límite debe ser un número entre 1 y 31");
      return;
    }
    if (!Number.isFinite(topeNum) || topeNum < 0) {
      toast.error("El tope debe ser un monto válido");
      return;
    }
    if (!Number.isFinite(saldoMinimoNum) || saldoMinimoNum < 0) {
      toast.error("El saldo mínimo para apertura de cuenta debe ser un monto válido");
      return;
    }
    if (!Number.isFinite(topeReciboNum) || topeReciboNum < 0) {
      toast.error("El monto autorizado por Recibo de Gastos Varios debe ser un monto válido");
      return;
    }

    setGuardando(true);
    try {
      await guardarParametros({
        id: parametros.data.id,
        dia_limite_cierre: diaNum,
        tope_egreso: topeNum,
        saldo_minimo_cuenta_bancaria: saldoMinimoNum,
        tope_recibo_gastos_varios: topeReciboNum,
        modificado_por_id: ctx?.userId ?? null,
        modificado_por_nombre: ctx?.nombre ?? null,
        modificado_por_email: ctx?.email ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ["parametros"] });
      setEditando(false);
      toast.success("Parámetros guardados y modificación registrada.");

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
      {esAuditor && parametros.data && !editando && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <SlidersHorizontal className="h-5 w-5" /> Parámetros de control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Día límite para cerrar cada mes</p>
                  <p className="mt-1 font-medium">{parametros.data.dia_limite_cierre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tope por gasto individual</p>
                  <p className="mt-1 font-medium">{money(num(parametros.data.tope_egreso))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo mínimo para obligación de cuenta bancaria</p>
                  <p className="mt-1 font-medium">
                    {num(parametros.data.saldo_minimo_cuenta_bancaria) > 0
                      ? money(num(parametros.data.saldo_minimo_cuenta_bancaria))
                      : "Desactivado"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto autorizado por Recibo de Gastos Varios</p>
                  <p className="mt-1 font-medium">
                    {num(parametros.data.tope_recibo_gastos_varios) > 0
                      ? money(num(parametros.data.tope_recibo_gastos_varios))
                      : "Desactivado"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <p className="text-xs text-muted-foreground">Control anual de Recibos de Gastos Varios</p>
                <p className="mt-1 text-sm font-medium">Alerta cuando se superan 25 recibos en el ejercicio.</p>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Última modificación</p>
              {parametros.data.ultima_modificacion_por_nombre ? (
                <>
                  <p className="mt-1 font-medium">{parametros.data.ultima_modificacion_por_nombre}</p>
                  {parametros.data.ultima_modificacion_por_email && (
                    <p className="text-sm text-muted-foreground">{parametros.data.ultima_modificacion_por_email}</p>
                  )}
                  {parametros.data.ultima_modificacion_en && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(parametros.data.ultima_modificacion_en).toLocaleString("es-AR")}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Todavía no hay una modificación registrada.</p>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => {
                cargarValoresActuales();
                setEditando(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Modificar parámetros
            </Button>
          </CardContent>
        </Card>
      )}

      {esAuditor && parametros.data && editando && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Pencil className="h-5 w-5" /> Modificar parámetros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dia">Día límite para cerrar cada mes</Label>
              <Input id="dia" type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Si un mes se cierra después del día {dia || "…"} del mes siguiente, se marca como "cerrado fuera de plazo".
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tope">Tope por gasto individual (en pesos)</Label>
              <Input id="tope" inputMode="decimal" value={tope} onChange={(e) => setTope(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Todo egreso que supere {money(Number(tope.replace(/\./g, "").replace(",", ".")) || 0)} queda observado en el libro del mes.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldo-minimo-cuenta">Saldo mínimo que obliga a abrir una cuenta bancaria</Label>
              <Input
                id="saldo-minimo-cuenta"
                inputMode="decimal"
                value={saldoMinimo}
                onChange={(e) => setSaldoMinimo(e.target.value)}
                placeholder="Importe"
              />
              <p className="text-xs text-muted-foreground">
                Cuando el saldo actual del Libro sea igual o superior a este monto y la Cooperadora no tenga cuenta bancaria declarada, se genera una alerta para Auditoría. Con 0, este criterio queda desactivado.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tope-recibo-gastos-varios">Monto autorizado por cada Recibo de Gastos Varios</Label>
              <Input
                id="tope-recibo-gastos-varios"
                inputMode="decimal"
                value={topeReciboGastosVarios}
                onChange={(e) => setTopeReciboGastosVarios(e.target.value)}
                placeholder="Importe autorizado"
              />
              <p className="text-xs text-muted-foreground">
                Con 0, el control de monto queda desactivado. Auditoría recibe una alerta por cada recibo que supere el importe configurado.
              </p>
              <p className="text-xs text-muted-foreground">
                Además, se genera una alerta cuando una Cooperadora registra más de 25 Recibos de Gastos Varios durante el ejercicio anual.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={guardar} disabled={guardando || !parametros.data}>
                {guardando ? "Guardando…" : "Guardar parámetros"}
              </Button>
              <Button
                variant="outline"
                disabled={guardando}
                onClick={() => {
                  cargarValoresActuales();
                  setEditando(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
}
    </AppShell>
  );
}
