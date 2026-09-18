import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { toast } from "sonner";

import { cargarCooperadorasAuditoria, otorgarRolAuditor, reclamarRolAuditor } from "@/lib/data/auditoria";
import { cargarConcesionKiosco } from "@/lib/data/concesion";
import {
  asegurarPlazoAperturaCuenta,
  aperturaCuentaVencida,
} from "@/lib/data/apertura-cuenta-bancaria";
import { cargarDatosInstitucionales } from "@/lib/data/datos-institucionales";
import { AppShell, useContexto } from "@/components/AppShell";
import {
  calcularEjercicio,
  cargarEjercicio,
  cargarParametros,
  guardarParametros,
  totalesAnuales,
  type Cooperadora,
} from "@/lib/libro";
import { exportarComparativoExcel } from "@/lib/exportar";
import { money, nombreMes, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/auditoria/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Auditoría de cooperadoras | Libro de Cooperadoras" },
      {
        name: "description",
        content:
          "Listado de todas las cooperadoras escolares con su saldo actual, estado de rendiciones y alertas de control.",
      },
      { property: "og:title", content: "Auditoría de cooperadoras escolares" },
      {
        property: "og:description",
        content: "Saldos, rendiciones y alertas de todas las cooperadoras en una sola pantalla.",
      },
    ],
  }),
  component: AuditoriaPage,
});

type Alerta = { mes: number; texto: string };

type Fila = {
  coop: Cooperadora;
  saldoActual: number;
  ingresos: number;
  egresos: number;
  mesesCerrados: number;
  alertas: Alerta[];
};

async function cargarPanelAuditor(): Promise<Fila[]> {
  const data = await cargarCooperadorasAuditoria();
  const coops = (data ?? []) as Cooperadora[];
  const hoy = new Date();

  const parametros = await cargarParametros();
  const saldoMinimoCuenta = num(parametros.saldo_minimo_cuenta_bancaria);

  return Promise.all(
    coops.map(async (coop) => {
      const [{ periodos, movimientos }, datosInstitucionales, concesion] = await Promise.all([
        cargarEjercicio(coop.id, coop.ejercicio),
        cargarDatosInstitucionales(coop),
        cargarConcesionKiosco(coop.id),
      ]);
      const resumen = calcularEjercicio(num(coop.saldo_inicial_ejercicio), periodos, movimientos, parametros);
      const totales = totalesAnuales(resumen);
      const mesTope = coop.ejercicio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
      const saldoActual = resumen.find((r) => r.mes === mesTope)?.saldoFinal ?? totales.saldoFinal;
      const alertasCuenta: Alerta[] = [];
      const motivosApertura = [
        concesion ? "concesion_kiosco" : null,
        saldoMinimoCuenta > 0 && saldoActual >= saldoMinimoCuenta ? "saldo_minimo" : null,
      ].filter((valor): valor is "saldo_minimo" | "concesion_kiosco" => Boolean(valor));

      let plazoApertura: Awaited<ReturnType<typeof asegurarPlazoAperturaCuenta>> | null = null;
      if (!datosInstitucionales.posee_cuenta_bancaria && motivosApertura.length > 0) {
        plazoApertura = await asegurarPlazoAperturaCuenta(coop.id, motivosApertura);
        const textoPlazo = aperturaCuentaVencida(plazoApertura)
          ? " El plazo de 05 días hábiles se encuentra vencido."
          : ` El plazo vence el ${new Date(plazoApertura.fechaVencimiento + "T00:00:00").toLocaleDateString("es-AR")}.`;

        if (concesion) {
          alertasCuenta.push({
            mes: mesTope,
            texto: "Posee concesión de kiosco/cantina y no tiene cuenta bancaria declarada." + textoPlazo,
          });
        }

        if (saldoMinimoCuenta > 0 && saldoActual >= saldoMinimoCuenta) {
          alertasCuenta.push({
            mes: mesTope,
            texto: `El saldo actual de ${money(saldoActual)} alcanza el monto de ${money(saldoMinimoCuenta)} que obliga a abrir una cuenta bancaria, y la escuela no tiene cuenta declarada.${textoPlazo}`,
          });
        }
      }

      const recibosGastosVarios = movimientos.filter(
        (m) => m.tipo === "egreso" && m.tipo_factura === "recibo_gastos_varios",
      );
      const topeReciboGastosVarios = num(parametros.tope_recibo_gastos_varios);

      const alertasRecibos: Alerta[] = [];

      if (recibosGastosVarios.length > 25) {
        const ultimoRecibo = recibosGastosVarios[recibosGastosVarios.length - 1];
        const mesUltimoRecibo = Number(ultimoRecibo?.fecha.slice(5, 7)) || mesTope;

        alertasRecibos.push({
          mes: mesUltimoRecibo,
          texto: `Se registraron ${recibosGastosVarios.length} recibos de gastos varios en el ejercicio ${coop.ejercicio}; supera el máximo anual de 25.`,
        });
      }

      if (topeReciboGastosVarios > 0) {
        for (const recibo of recibosGastosVarios) {
          const monto = num(recibo.monto);
          if (monto <= topeReciboGastosVarios) continue;

          alertasRecibos.push({
            mes: Number(recibo.fecha.slice(5, 7)) || mesTope,
            texto: `Recibo de gastos varios del ${recibo.fecha}: ${money(monto)} supera el monto autorizado de ${money(topeReciboGastosVarios)}${recibo.comprobante ? ` (comprobante ${recibo.comprobante})` : ""}.`,
          });
        }
      }

      return {
        coop,
        saldoActual,
        ingresos: totales.ingresos,
        egresos: totales.egresos,
        mesesCerrados: resumen.filter((r) => r.periodo?.estado === "cerrado").length,
        alertas: [
          ...resumen.flatMap((r) =>
            r.alertas.map((a) => ({ mes: r.mes, texto: `${nombreMes(r.mes)}: ${a}` })),
          ),
          ...alertasCuenta,
          ...alertasRecibos.map((a) => ({
            ...a,
            texto: a.texto.startsWith("Se registraron")
              ? a.texto
              : `${nombreMes(a.mes)}: ${a.texto}`,
          })),
        ],
      };
    }),
  );
}

function HabilitarAuditor() {
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);

  async function habilitar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      await otorgarRolAuditor(email.trim());
      setEmail("");
      toast.success("Auditor habilitado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo habilitar el auditor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Card className="mb-6 max-w-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <ShieldCheck className="h-4 w-4 text-primary" /> Habilitar otro auditor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={habilitar} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            required
            placeholder="email de la persona ya registrada"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={cargando}>
            Habilitar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ParametrosAuditoria() {
  const qc = useQueryClient();
  const parametros = useQuery({ queryKey: ["parametros"], queryFn: cargarParametros, staleTime: 30_000 });
  const [saldoMinimo, setSaldoMinimo] = useState("");
  const [topeReciboGastosVarios, setTopeReciboGastosVarios] = useState("");

  useEffect(() => {
    if (parametros.data) {
      setSaldoMinimo(String(parametros.data.saldo_minimo_cuenta_bancaria ?? 0));
      setTopeReciboGastosVarios(String(parametros.data.tope_recibo_gastos_varios ?? 0));
    }
  }, [parametros.data]);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!parametros.data) throw new Error("No se pudieron cargar los parámetros de control.");
      const valor = num(saldoMinimo);
      const topeRecibo = num(topeReciboGastosVarios);
      if (!Number.isFinite(valor) || valor < 0) {
        throw new Error("El saldo mínimo debe ser un importe válido mayor o igual a cero.");
      }
      if (!Number.isFinite(topeRecibo) || topeRecibo < 0) {
        throw new Error("El monto autorizado por recibo debe ser un importe válido mayor o igual a cero.");
      }
      await guardarParametros({
        id: parametros.data.id,
        dia_limite_cierre: Number(parametros.data.dia_limite_cierre),
        tope_egreso: num(parametros.data.tope_egreso),
        saldo_minimo_cuenta_bancaria: valor,
        tope_recibo_gastos_varios: topeRecibo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parametros"] });
      toast.success("Parámetros de control actualizados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="mb-6 max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg">Parámetros de control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="saldo-minimo-cuenta" className="text-sm font-medium">
            Saldo mínimo que obliga a abrir una cuenta bancaria
          </label>
          <Input
            id="saldo-minimo-cuenta"
            inputMode="decimal"
            value={saldoMinimo}
            onChange={(e) => setSaldoMinimo(e.target.value)}
            placeholder="Importe"
          />
          <p className="text-xs text-muted-foreground">
            Cuando el saldo actual del Libro sea igual o superior a este monto y la escuela no tenga cuenta, se genera una alerta para Auditoría. Con 0, este criterio queda desactivado.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="tope-recibo-gastos-varios" className="text-sm font-medium">
            Monto autorizado por cada Recibo de Gastos Varios
          </label>
          <Input
            id="tope-recibo-gastos-varios"
            inputMode="decimal"
            value={topeReciboGastosVarios}
            onChange={(e) => setTopeReciboGastosVarios(e.target.value)}
            placeholder="Importe autorizado"
          />
          <p className="text-xs text-muted-foreground">
            En 0, este control queda desactivado. Auditoría recibe una alerta por cada recibo que supere el importe configurado.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          También se genera una alerta cuando una Cooperadora registra más de 25 Recibos de Gastos Varios durante el ejercicio anual.
        </p>

        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || parametros.isLoading}>
          {guardar.isPending ? "Guardando…" : "Guardar parámetros"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AuditoriaPage() {
  const { data: ctx } = useContexto();
  const filas = useQuery({
    queryKey: ["panel-auditor"],
    queryFn: cargarPanelAuditor,
    enabled: !!ctx?.esAuditor,
  });

  async function reclamar() {
    try {
      await reclamarRolAuditor();
      toast.success("Rol de auditor asignado. Volvé a cargar la página.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar el rol de auditor.");
    }
  }

  if (ctx && !ctx.esAuditor) {
    return (
      <AppShell titulo="Auditoría" descripcion="Acceso reservado a la auditoría.">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <ShieldCheck className="h-5 w-5 text-primary" /> Tu cuenta no tiene permisos de auditoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Si sos la persona a cargo del control de las cooperadoras, podés tomar el rol de
              auditoría con el botón de abajo (disponible solo mientras no haya otro auditor
              asignado).
            </p>
            <Button onClick={reclamar}>Soy el auditor</Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const datos = filas.data ?? [];
  const totalAlertas = datos.reduce((s, f) => s + f.alertas.length, 0);

  return (
    <AppShell
      titulo="Auditoría de cooperadoras"
      descripcion={`${datos.length} cooperadoras registradas · ${totalAlertas} observaciones`}
      acciones={
        <Button
          variant="outline"
          size="sm"
          disabled={datos.length === 0}
          onClick={() =>
            exportarComparativoExcel(
              datos.map((f) => ({
                Cooperadora: f.coop.nombre,
                Localidad: f.coop.localidad ?? "",
                CUE: f.coop.cue ?? "",
                Ejercicio: f.coop.ejercicio,
                "Saldo actual": f.saldoActual,
                Ingresos: f.ingresos,
                Egresos: f.egresos,
                "Meses cerrados": f.mesesCerrados,
                Observaciones: f.alertas.map((a) => a.texto).join(" / "),
              })),
            )
          }
        >
          <FileSpreadsheet className="mr-1 h-4 w-4" /> Comparativo Excel
        </Button>
      }
    >
      <HabilitarAuditor />
      <ParametrosAuditoria />
      {filas.isLoading && <p className="text-sm text-muted-foreground">Cargando cooperadoras…</p>}

      {!filas.isLoading && datos.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay cooperadoras registradas.</p>
      )}

      {datos.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cooperadora</TableHead>
                  <TableHead>Localidad</TableHead>
                  <TableHead className="text-right">Saldo actual</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                  <TableHead className="text-center">Meses cerrados</TableHead>
                  <TableHead className="text-center">Alertas</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.map((f) => (
                  <TableRow key={f.coop.id}>
                    <TableCell className="font-medium">{f.coop.nombre}</TableCell>
                    <TableCell>{f.coop.localidad ?? "—"}</TableCell>
                    <TableCell
                      className={`text-right ${f.saldoActual < 0 ? "text-destructive font-medium" : ""}`}
                    >
                      {money(f.saldoActual)}
                    </TableCell>
                    <TableCell className="text-right">{money(f.ingresos)}</TableCell>
                    <TableCell className="text-right">{money(f.egresos)}</TableCell>
                    <TableCell className="text-center">{f.mesesCerrados}/12</TableCell>
                    <TableCell className="text-center">
                      {f.alertas.length === 0 ? (
                        <Badge variant="secondary">Sin observaciones</Badge>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 hover:bg-transparent"
                            >
                              <Badge variant="destructive" className="cursor-pointer gap-1">
                                <AlertTriangle className="h-3 w-3" /> {f.alertas.length}
                                <ChevronDown className="h-3 w-3" />
                              </Badge>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="center" className="w-80 p-2">
                            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
                              Observaciones de {f.coop.nombre}
                            </p>
                            <div className="max-h-72 space-y-1 overflow-y-auto">
                              {f.alertas.map((a, i) => (
                                <Link
                                  key={`${a.mes}-${i}`}
                                  to="/auditoria/$id"
                                  params={{ id: f.coop.id }}
                                  search={{ mes: a.mes }}
                                  className="flex items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                                >
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                                  <span>{a.texto}</span>
                                </Link>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/auditoria/$id" params={{ id: f.coop.id }} search={{ mes: undefined }}>
                          Ver libro
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
