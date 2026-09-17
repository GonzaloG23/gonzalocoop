import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, ClipboardList, FileBarChart, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { authData } from "@/lib/data/auth";
import { AppShell, useContexto } from "@/components/AppShell";
import { calcularEjercicio, cargarEjercicio, cargarParametros, totalesAnuales } from "@/lib/libro";
import {
  cargarDatosInstitucionales,
  cargarHistorialDatosInstitucionales,
  guardarDatosInstitucionales,
  type DatosInstitucionales,
} from "@/lib/data/datos-institucionales";
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
      { name: "description", content: "Saldo actual, resumen del ejercicio y estado de los meses de la cooperadora escolar." },
      { property: "og:title", content: "Panel de la cooperadora" },
      { property: "og:description", content: "Saldo actual, resumen del ejercicio y estado de los meses." },
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
            <div className="space-y-2"><Label htmlFor="cue">CUE</Label><Input id="cue" inputMode="numeric" value={cue} onChange={(e) => setCue(e.target.value.replace(/\D/g, ""))} /></div>
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
  const qc = useQueryClient();
  const coop = ctx?.cooperadora ?? null;
  const anio = coop?.ejercicio ?? new Date().getFullYear();
  const ejercicio = useQuery({ queryKey: ["ejercicio", coop?.id, anio], queryFn: () => cargarEjercicio(coop!.id, anio), enabled: !!coop });
  const parametros = useQuery({ queryKey: ["parametros"], queryFn: cargarParametros, staleTime: 30_000 });
  const datosInstitucionales = useQuery({
    queryKey: ["datos-institucionales", coop?.id],
    queryFn: () => cargarDatosInstitucionales(coop!),
    enabled: !!coop,
  });
  const historialInstitucional = useQuery({
    queryKey: ["historial-datos-institucionales", coop?.id],
    queryFn: () => cargarHistorialDatosInstitucionales(coop!.id),
    enabled: !!coop,
  });
  const [datos, setDatos] = useState<DatosInstitucionales | null>(null);
  const [editando, setEditando] = useState(false);
  const resumen = useMemo(() => {
    if (!coop || !ejercicio.data) return null;
    return calcularEjercicio(num(coop.saldo_inicial_ejercicio), ejercicio.data.periodos, ejercicio.data.movimientos, parametros.data);
  }, [coop, ejercicio.data, parametros.data]);
  const totales = resumen ? totalesAnuales(resumen) : null;
  const hoy = new Date();
  const mesActual = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
  const saldoActual = resumen?.find((r) => r.mes === mesActual)?.saldoFinal ?? 0;
  const pendientes = resumen?.filter((r) => r.mes <= mesActual && r.periodo?.estado !== "cerrado") ?? [];

  useEffect(() => {
    if (!datosInstitucionales.data) return;
    setDatos(datosInstitucionales.data);
    if (!(historialInstitucional.data?.length)) setEditando(true);
  }, [datosInstitucionales.data, historialInstitucional.data]);

  const guardarDatos = useMutation({
    mutationFn: async () => {
      if (!coop || !datos) throw new Error("No hay datos institucionales para guardar.");
      if (!ctx) throw new Error("No se pudo identificar al usuario que realiza la modificación.");
      return guardarDatosInstitucionales(coop.id, datos, {
        id: ctx.userId,
        nombre: ctx.nombre || "Usuario",
        email: ctx.email,
      }, coop.nombre);
    },
    onSuccess: (guardados) => {
      setDatos(guardados);
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["datos-institucionales", coop?.id] });
      qc.invalidateQueries({ queryKey: ["historial-datos-institucionales", coop?.id] });
      toast.success("Información institucional guardada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actualizarDato = (campo: keyof DatosInstitucionales, valor: string) => {
    setDatos((actual) => actual ? { ...actual, [campo]: valor } : actual);
  };

  return (
    <AppShell
      titulo={coop?.nombre ?? "Panel"}
      descripcion={`Ejercicio ${anio}${coop?.localidad ? ` · ${coop.localidad}` : ""}`}
      acciones={<div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link to="/libro"><Wallet className="mr-1 h-4 w-4" /> Libro mensual</Link></Button><Button asChild size="sm" variant="outline"><Link to="/anual"><FileBarChart className="mr-1 h-4 w-4" /> Resumen anual</Link></Button></div>}
    >
      <details open={editando} className="rounded-sm border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-4 hover:bg-secondary/50">
          <span className="flex items-center justify-between gap-3">
            <span>
              <span className="flex items-center gap-2 font-serif text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Datos institucionales de la escuela
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {editando
                  ? "Completá o actualizá la información oficial de la institución."
                  : "Información oficial registrada de la institución."}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{editando ? "Edición" : "Ver información"}</span>
          </span>
        </summary>
        <div className="border-t border-border p-6">
          {!datos ? (
            <p className="text-sm text-muted-foreground">Cargando datos institucionales…</p>
          ) : editando ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-3"><Label htmlFor="panel-nombre">Nombre de la escuela *</Label><Input id="panel-nombre" value={coop?.nombre ?? ""} readOnly required /></div>
              <div className="space-y-2"><Label htmlFor="panel-cue">CUE *</Label><Input id="panel-cue" inputMode="numeric" value={datos.cue} onChange={(e) => actualizarDato("cue", e.target.value.replace(/\D/g, ""))} placeholder="Número CUE" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-nivel">Nivel de la escuela *</Label><Input id="panel-nivel" value={datos.nivel} onChange={(e) => actualizarDato("nivel", e.target.value)} placeholder="Nivel" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-turno">Turno *</Label><Input id="panel-turno" value={datos.turno} onChange={(e) => actualizarDato("turno", e.target.value)} placeholder="Turno" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-localidad">Localidad *</Label><Input id="panel-localidad" value={datos.localidad} onChange={(e) => actualizarDato("localidad", e.target.value)} placeholder="Localidad" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-director">Nombre y Apellido de Director/a *</Label><Input id="panel-director" value={datos.director_nombre} onChange={(e) => actualizarDato("director_nombre", e.target.value)} placeholder="Nombre y apellido" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-director-dni">DNI de Director/a *</Label><Input id="panel-director-dni" inputMode="numeric" maxLength={8} value={datos.director_dni} onChange={(e) => actualizarDato("director_dni", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Número de DNI" required /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="panel-supervisor">Nombre y Apellido de Supervisor/a</Label><Input id="panel-supervisor" value={datos.supervisor_nombre} onChange={(e) => actualizarDato("supervisor_nombre", e.target.value)} placeholder="Nombre y apellido" /></div>
              <div className="space-y-2 md:col-span-2 lg:col-span-4"><Label htmlFor="panel-email">Email Oficial de Cooperadora *</Label><Input id="panel-email" type="email" value={datos.email_oficial} onChange={(e) => actualizarDato("email_oficial", e.target.value)} placeholder="cooperadora@..." required /></div>
              <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
                <Button onClick={() => guardarDatos.mutate()} disabled={guardarDatos.isPending}>{guardarDatos.isPending ? "Guardando…" : "Guardar información"}</Button>
                {historialInstitucional.data?.length ? <Button type="button" variant="outline" onClick={() => setEditando(false)} disabled={guardarDatos.isPending}>Cancelar</Button> : null}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DatoInstitucional titulo="Nombre de la escuela" valor={coop?.nombre ?? ""} className="lg:col-span-3" />
                <DatoInstitucional titulo="CUE" valor={datos.cue} />
                <DatoInstitucional titulo="Nivel de la escuela" valor={datos.nivel} />
                <DatoInstitucional titulo="Turno" valor={datos.turno} />
                <DatoInstitucional titulo="Localidad" valor={datos.localidad} />
                <DatoInstitucional titulo="Nombre y Apellido de Director/a" valor={datos.director_nombre} />
                <DatoInstitucional titulo="DNI de Director/a" valor={datos.director_dni} />
                <DatoInstitucional titulo="Nombre y Apellido de Supervisor/a" valor={datos.supervisor_nombre} className="sm:col-span-2" />
                <DatoInstitucional titulo="Email Oficial de Cooperadora" valor={datos.email_oficial} className="sm:col-span-2 lg:col-span-4" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  {historialInstitucional.data?.[0]
                    ? `Última modificación: ${historialInstitucional.data[0].usuario_nombre}${historialInstitucional.data[0].usuario_email ? ` · ${historialInstitucional.data[0].usuario_email}` : ""} · ${new Date(historialInstitucional.data[0].modificado_en).toLocaleString("es-AR")}`
                    : "Información registrada"}
                </p>
                <Button variant="outline" onClick={() => setEditando(true)}>Modificar información</Button>
              </div>
            </div>
          )}
        </div>
      </details>

      {historialInstitucional.data && historialInstitucional.data.length > 0 && (
        <details className="mt-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones</span>
              <span className="text-xs font-normal text-muted-foreground">{historialInstitucional.data.length} registro{historialInstitucional.data.length === 1 ? "" : "s"}</span>
            </span>
          </summary>
          <div className="border-t border-border p-4 space-y-2">
            {historialInstitucional.data.map((registro) => (
              <div key={registro.id} className="flex flex-col gap-1 rounded-sm border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{registro.usuario_nombre}</p>
                  {registro.usuario_email && <p className="text-xs text-muted-foreground">{registro.usuario_email}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Saldo actual" valor={money(saldoActual)} destacado />
        <Tarjeta titulo="Ingresos del ejercicio" valor={money(totales?.ingresos ?? 0)} />
        <Tarjeta titulo="Egresos del ejercicio" valor={money(totales?.egresos ?? 0)} />
        <Tarjeta titulo="Saldo final proyectado" valor={money(totales?.saldoFinal ?? 0)} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-serif text-lg">Registrar movimiento</CardTitle><CardDescription>Accesos directos para registrar ingresos y egresos en el libro mensual.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link to="/libro" search={{ tipo: "ingreso" }} className="group flex min-h-24 items-center gap-4 rounded-sm border border-green-600/40 bg-green-50 p-4 transition-colors hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/35">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-white shadow-sm"><TrendingUp className="h-6 w-6" /></span>
            <div><p className="text-lg font-semibold text-green-700 dark:text-green-400">Registrar ingreso</p><p className="mt-1 text-sm text-green-800/70 dark:text-green-300/70">Cargar un nuevo ingreso de la cooperadora.</p></div>
          </Link>
          <Link to="/libro" search={{ tipo: "egreso" }} className="group flex min-h-24 items-center gap-4 rounded-sm border border-red-600/40 bg-red-50 p-4 transition-colors hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/35">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm"><TrendingDown className="h-6 w-6" /></span>
            <div><p className="text-lg font-semibold text-red-700 dark:text-red-400">Registrar egreso</p><p className="mt-1 text-sm text-red-800/70 dark:text-red-300/70">Cargar un nuevo egreso de la cooperadora.</p></div>
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-serif text-lg">Consultas y control</CardTitle><CardDescription>Accesos para consultar la información registrada y controlar el ejercicio.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Link to="/libro" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><Wallet className="h-5 w-5" /></span><div><p className="font-medium">Libro mensual</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consultar movimientos, comprobantes y cierres mensuales.</p></div></div></Link>
          <Link to="/anual" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><FileBarChart className="h-5 w-5" /></span><div><p className="font-medium">Resumen anual</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consultar el resumen del ejercicio y sus resultados.</p></div></div></Link>
          <Link to="/comision" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><Users className="h-5 w-5" /></span><div><p className="font-medium">Comisión Directiva</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Completar autoridades y adjuntar el acta de constitución.</p></div></div></Link>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card><CardHeader><CardTitle className="font-serif text-lg">Meses sin cerrar</CardTitle><CardDescription>Cerrar el mes congela sus movimientos.</CardDescription></CardHeader><CardContent className="space-y-2">
          {pendientes.length === 0 && <p className="text-sm text-muted-foreground">No queda ningún mes pendiente.</p>}
          {pendientes.map((p) => <div key={p.mes} className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-sm"><span>{nombreMes(p.mes)}</span><span className="flex items-center gap-2"><Badge variant="secondary">{p.cantidad} movimientos</Badge><span className="text-muted-foreground">{money(p.saldoFinal)}</span></span></div>)}
        </CardContent></Card>
      </div>

      <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-lg"><ClipboardList className="h-4 w-4" /> Próximamente</CardTitle><CardDescription>La siguiente etapa puede ampliar este panel sin cambiar la estructura de datos actual.</CardDescription></CardHeader><CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p>• Comprobantes y documentación respaldatoria</p><p>• Presupuesto y seguimiento de ejecución</p><p>• Proveedores</p></CardContent></Card>
    </AppShell>
  );
}

function DatoInstitucional({ titulo, valor, className = "" }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-border bg-card px-3 py-2 ${className}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor || "No informado"}</p>
    </div>
  );
}

function Tarjeta({ titulo, valor, destacado = false }: { titulo: string; valor: string; destacado?: boolean }) {
  return <div className={`rounded-sm border border-border px-4 py-3 ${destacado ? "bg-primary text-primary-foreground" : "bg-card"}`}><p className={`text-xs ${destacado ? "opacity-80" : "text-muted-foreground"}`}>{titulo}</p><p className="mt-1 font-serif text-xl font-semibold">{valor}</p></div>;
}
