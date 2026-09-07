import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, useContexto } from "@/components/AppShell";
import {
  calcularEjercicio,
  cargarEjercicio,
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
  const { data, error } = await supabase.from("cooperadoras").select("*").order("nombre");
  if (error) throw error;
  const coops = (data ?? []) as Cooperadora[];
  const hoy = new Date();

  return Promise.all(
    coops.map(async (coop) => {
      const { periodos, movimientos } = await cargarEjercicio(coop.id, coop.ejercicio);
      const resumen = calcularEjercicio(num(coop.saldo_inicial_ejercicio), periodos, movimientos);
      const totales = totalesAnuales(resumen);
      const mesTope = coop.ejercicio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
      return {
        coop,
        saldoActual: resumen.find((r) => r.mes === mesTope)?.saldoFinal ?? totales.saldoFinal,
        ingresos: totales.ingresos,
        egresos: totales.egresos,
        mesesCerrados: resumen.filter((r) => r.periodo?.estado === "cerrado").length,
        alertas: resumen.flatMap((r) => r.alertas.map((a) => `${nombreMes(r.mes)}: ${a}`)),
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
    const { error } = await supabase.rpc("otorgar_rol_auditor", { _email: email.trim() });
    setCargando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail("");
    toast.success("Auditor habilitado.");
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

function AuditoriaPage() {
  const { data: ctx } = useContexto();
  const filas = useQuery({
    queryKey: ["panel-auditor"],
    queryFn: cargarPanelAuditor,
    enabled: !!ctx?.esAuditor,
  });

  async function reclamar() {
    const { error } = await supabase.rpc("reclamar_rol_auditor");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rol de auditor asignado. Volvé a cargar la página.");
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
                Observaciones: f.alertas.join(" / "),
              })),
            )
          }
        >
          <FileSpreadsheet className="mr-1 h-4 w-4" /> Comparativo Excel
        </Button>
      }
    >
      <HabilitarAuditor />
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
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {f.alertas.length}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/auditoria/$id" params={{ id: f.coop.id }}>
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
