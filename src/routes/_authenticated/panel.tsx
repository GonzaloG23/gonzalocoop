import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Building2, ClipboardList, FileBarChart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { authData } from "@/lib/data/auth";
import { AppShell, useContexto } from "@/components/AppShell";
import { calcularEjercicio, cargarEjercicio, cargarParametros, totalesAnuales } from "@/lib/libro";
import { money, nombreMes, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/panel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Panel de la cooperadora | Libro de Cooperadoras" },
      { name: "description", content: "Saldo actual, resumen del ejercicio y alertas de rendición de la cooperadora escolar." },
      { property: "og:title", content: "Panel de la cooperadora" },
      { property: "og:description", content: "Saldo actual, resumen del ejercicio y alertas." },
    ],
  }),
  component: Panel,
});

function Panel() {
  const { data: ctx, isLoading } = useContexto();
  if (isLoading) return <AppShell titulo="Panel"><p className="text-sm text-muted-foreground">Cargando…</p></AppShell>;
  if (ctx && !ctx.cooperadora) return ctx.esAuditor ? <PanelAuditorVacio /> : <AltaCooperadora />;
  return <PanelCooperadora />;
}

function PanelAuditorVacio() {
  return (
    <AppShell titulo="Panel del auditor" descripcion="Tu cuenta tiene permisos de auditoría.">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Todo el control en un lugar</CardTitle>
          <CardDescription>Accedé al listado de cooperadoras, sus saldos y sus alertas de rendición.</CardDescription>
        </CardHeader>
        <CardContent><Button asChild><Link to="/auditoria">Ver cooperadoras <ArrowRight className="ml-1 h-4 w-4" /></Link></Button></CardContent>
      </Card>
    </AppShell>
  );
}

function AltaCooperadora() {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [cue, setCue] = useState("");
  const [cuit, setCuit] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [ejercicio, setEjercicio] = useState(String(new Date().getFullYear()));
  const [saldo, setSaldo] = useState("0");

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await authData.createCooperadora({ nombre: nombre.trim(), cue: cue.trim(), cuit: cuit.trim(), localidad: localidad.trim(), ejercicio: Number(ejercicio), saldoInicial: num(saldo.replace(",", ".")) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cooperadora registrada. Ya podés cargar los movimientos."); qc.invalidateQueries({ queryKey: ["contexto"] }); },
    onError: (e: Error) => toast.error(`No se pudo registrar: ${e.message}`),
  });

  return (
    <AppShell titulo="Registrá tu cooperadora" descripcion="Estos datos encabezan todas las planillas y reportes.">
      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary text-primary"><Building2 className="h-5 w-5" /></span>
          <div><CardTitle className="font-serif">Datos de la institución</CardTitle><CardDescription>Se pueden completar los opcionales más adelante.</CardDescription></div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); crear.mutate(); }}>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="nombre">Nombre de la escuela</Label><Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="cue">CUE</Label><Input id="cue" value={cue} onChange={(e) => setCue(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="cuit">CUIT</Label><Input id="cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="localidad">Localidad</Label><Input id="localidad" value={localidad} onChange={(e) => setLocalidad(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="ejercicio">Año de ejercicio</Label><Input id="ejercicio" inputMode="numeric" required value={ejercicio} onChange={(e) => setEjercicio(e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="saldo">Saldo inicial del ejercicio (enero)</Label><Input id="saldo" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={crear.isPending}>Registrar cooperadora</Button></div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function PanelCooperadora() {
  const { data: ctx } = useContexto();
  const coop = ctx?.cooperadora ?? null;
  const anio = coop?.ejercicio ?? new Date().getFullYear();
  const ejercicio = useQuery({ queryKey: ["ejercicio", coop?.id, anio], queryFn: () => cargarEjercicio(coop!.id, anio), enabled: !!coop });
  const parametros = useQuery({ queryKey: ["parametros"], queryFn: cargarParametros, staleTime: 30_000 });
  const resumen = useMemo(() => {
    if (!coop || !ejercicio.data) return null;
    return calcularEjercicio(num(coop.saldo_inicial_ejercicio), ejercicio.data.periodos, ejercicio.data.movimientos, parametros.data);
  }, [coop, ejercicio.data, parametros.data]);
  const totales = resumen ? totalesAnuales(resumen) : null;
  const hoy = new Date();
  const mesActual = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
  const saldoActual = resumen?.find((r) => r.mes === mesActual)?.saldoFinal ?? 0;
  const pendientes = resumen?.filter((r) => r.mes <= mesActual && r.periodo?.estado !== "cerrado") ?? [];
  const alertas = resumen?.flatMap((r) => r.alertas.map((a) => ({ mes: r.mes, texto: a }))) ?? [];

  return (
    <AppShell
      titulo={coop?.nombre ?? "Panel"}
      descripcion={`Ejercicio ${anio}${coop?.localidad ? ` · ${coop.localidad}` : ""}`}
      acciones={<div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link to="/libro"><Wallet className="mr-1 h-4 w-4" /> Libro mensual</Link></Button><Button asChild size="sm" variant="outline"><Link to="/anual"><FileBarChart className="mr-1 h-4 w-4" /> Resumen anual</Link></Button></div>}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Saldo actual" valor={money(saldoActual)} destacado />
        <Tarjeta titulo="Ingresos del ejercicio" valor={money(totales?.ingresos ?? 0)} />
        <Tarjeta titulo="Egresos del ejercicio" valor={money(totales?.egresos ?? 0)} />
        <Tarjeta titulo="Saldo final proyectado" valor={money(totales?.saldoFinal ?? 0)} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Registrar movimiento</CardTitle>
          <CardDescription>Accesos directos para registrar ingresos y egresos en el libro mensual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link to="/libro" className="group flex min-h-24 items-center gap-4 rounded-sm border border-green-600/40 bg-green-50 p-4 transition-colors hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/35">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-white shadow-sm"><TrendingUp className="h-6 w-6" /></span>
            <div><p className="text-lg font-semibold text-green-700 dark:text-green-400">Registrar ingreso</p><p className="mt-1 text-sm text-green-800/70 dark:text-green-300/70">Cargar un nuevo ingreso de la cooperadora.</p></div>
          </Link>
          <Link to="/libro" className="group flex min-h-24 items-center gap-4 rounded-sm border border-red-600/40 bg-red-50 p-4 transition-colors hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/35">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm"><TrendingDown className="h-6 w-6" /></span>
            <div><p className="text-lg font-semibold text-red-700 dark:text-red-400">Registrar egreso</p><p className="mt-1 text-sm text-red-800/70 dark:text-red-300/70">Cargar un nuevo egreso de la cooperadora.</p></div>
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-serif text-lg">Consultas y control</CardTitle><CardDescription>Accesos para consultar la información registrada y controlar el ejercicio.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link to="/libro" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><Wallet className="h-5 w-5" /></span><div><p className="font-medium">Libro mensual</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consultar movimientos, comprobantes y cierres mensuales.</p></div></div></Link>
          <Link to="/anual" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><FileBarChart className="h-5 w-5" /></span><div><p className="font-medium">Resumen anual</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consultar el resumen del ejercicio y sus resultados.</p></div></div></Link>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="font-serif text-lg">Meses sin cerrar</CardTitle><CardDescription>Cerrar el mes congela sus movimientos.</CardDescription></CardHeader><CardContent className="space-y-2">
          {pendientes.length === 0 && <p className="text-sm text-muted-foreground">No queda ningún mes pendiente.</p>}
          {pendientes.map((p) => <div key={p.mes} className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-sm"><span>{nombreMes(p.mes)}</span><span className="flex items-center gap-2"><Badge variant="secondary">{p.cantidad} movimientos</Badge><span className="text-muted-foreground">{money(p.saldoFinal)}</span></span></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-lg"><AlertTriangle className="h-4 w-4 text-destructive" /> Alertas de control</CardTitle><CardDescription>Revisiones automáticas sobre tu libro.</CardDescription></CardHeader><CardContent className="space-y-2">
          {alertas.length === 0 && <p className="text-sm text-muted-foreground">Sin observaciones por el momento.</p>}
          {alertas.map((a, i) => <p key={i} className="rounded-sm border border-border bg-secondary px-3 py-2 text-sm"><span className="font-medium">{nombreMes(a.mes)}:</span> {a.texto}</p>)}
        </CardContent></Card>
      </div>

      <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-lg"><ClipboardList className="h-4 w-4" /> Próximamente</CardTitle><CardDescription>La siguiente etapa puede ampliar este panel sin cambiar la estructura de datos actual.</CardDescription></CardHeader><CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p>• Comprobantes y documentación respaldatoria</p><p>• Presupuesto y seguimiento de ejecución</p><p>• Proveedores</p><p>• Historial de modificaciones</p></CardContent></Card>
    </AppShell>
  );
}

function Tarjeta({ titulo, valor, destacado = false }: { titulo: string; valor: string; destacado?: boolean }) {
  return <div className={`rounded-sm border border-border px-4 py-3 ${destacado ? "bg-primary text-primary-foreground" : "bg-card"}`}><p className={`text-xs ${destacado ? "opacity-80" : "text-muted-foreground"}`}>{titulo}</p><p className="mt-1 font-serif text-xl font-semibold">{valor}</p></div>;
}
