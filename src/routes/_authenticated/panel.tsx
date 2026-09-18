import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, ClipboardList, FileBarChart, FileText, Store, TrendingDown, TrendingUp, Upload, Users, Wallet } from "lucide-react";
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
import { cargarCuentaBancaria, guardarCuentaBancaria, type CuentaBancariaCooperadora } from "@/lib/data/cuenta-bancaria";
import { cargarConcesionKiosco } from "@/lib/data/concesion";
import {
  asegurarPlazoAperturaCuenta,
  cargarAperturaCuentaBancaria,
  aperturaCuentaVencida,
} from "@/lib/data/apertura-cuenta-bancaria";
import {
  abrirResumenBancario,
  calcularProximaActualizacionResumenBancario,
  cargarResumenBancario,
  guardarResumenBancario,
} from "@/lib/data/resumen-bancario";
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
  const cuentaBancaria = useQuery({
    queryKey: ["cuenta-bancaria", coop?.id],
    queryFn: () => cargarCuentaBancaria(coop!.id),
    enabled: !!coop,
  });
  const resumenBancario = useQuery({
    queryKey: ["resumen-bancario", coop?.id],
    queryFn: () => cargarResumenBancario(coop!.id),
    enabled: !!coop && datosInstitucionales.data?.posee_cuenta_bancaria === true,
  });
  const concesion = useQuery({
    queryKey: ["concesion-kiosco", coop?.id],
    queryFn: () => cargarConcesionKiosco(coop!.id),
    enabled: !!coop,
  });
  const aperturaCuenta = useQuery({
    queryKey: ["apertura-cuenta-bancaria", coop?.id],
    queryFn: () => cargarAperturaCuentaBancaria(coop!.id),
    enabled: !!coop && datosInstitucionales.data?.posee_cuenta_bancaria === false,
  });
  const [datos, setDatos] = useState<DatosInstitucionales | null>(null);
  const [editando, setEditando] = useState(false);
  const [datosBancarios, setDatosBancarios] = useState<CuentaBancariaCooperadora | null>(null);
  const [editandoBancaria, setEditandoBancaria] = useState(false);
  const [archivoResumenBancario, setArchivoResumenBancario] = useState<File | null>(null);
  const resumen = useMemo(() => {
    if (!coop || !ejercicio.data) return null;
    return calcularEjercicio(num(coop.saldo_inicial_ejercicio), ejercicio.data.periodos, ejercicio.data.movimientos, parametros.data);
  }, [coop, ejercicio.data, parametros.data]);
  const totales = resumen ? totalesAnuales(resumen) : null;
  const hoy = new Date();
  const mesActual = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
  const saldoActual = resumen?.find((r) => r.mes === mesActual)?.saldoFinal ?? 0;
  const efectivoEnMano =
    datosBancarios && datosBancarios.saldoBancario !== ""
      ? saldoActual - num(datosBancarios.saldoBancario)
      : null;
  const hayEfectivoEnMano =
    efectivoEnMano !== null && Math.abs(efectivoEnMano) > 0.009;
  const poseeCuentaBancaria = Boolean(datos?.posee_cuenta_bancaria);
  const saldoMinimoCuenta = num(parametros.data?.saldo_minimo_cuenta_bancaria ?? 0);
  const aperturaRequerida =
    datos?.posee_cuenta_bancaria === false &&
    (Boolean(concesion.data) || (saldoMinimoCuenta > 0 && saldoActual >= saldoMinimoCuenta));
  const pendientes = resumen?.filter((r) => r.mes <= mesActual && r.periodo?.estado !== "cerrado") ?? [];

  useEffect(() => {
    if (!datosInstitucionales.data) return;
    setDatos((actual) => actual ?? datosInstitucionales.data!);
    if (!(historialInstitucional.data?.length)) setEditando(true);
  }, [datosInstitucionales.data, historialInstitucional.data]);

  useEffect(() => {
    if (datosInstitucionales.data === undefined || cuentaBancaria.data === undefined) return;
    if (!datosInstitucionales.data.posee_cuenta_bancaria) {
      setDatosBancarios(null);
      setEditandoBancaria(false);
      return;
    }
    if (cuentaBancaria.data) {
      setDatosBancarios((actual) => actual ?? {
        ...cuentaBancaria.data!,
        saldoBancario: String(cuentaBancaria.data!.saldoBancario),
      });
      setEditandoBancaria(false);
    } else {
      setDatosBancarios((actual) => actual ?? {
        saldoBancario: "",
        asesorDirectorNombre: "",
        asesorDirectorDni: "",
        presidenteNombre: "",
        presidenteDni: "",
        tesoreroNombre: "",
        tesoreroDni: "",
      });
      setEditandoBancaria(true);
    }
  }, [datosInstitucionales.data, cuentaBancaria.data]);

  useEffect(() => {
    if (!coop || !aperturaRequerida) return;
    const motivos = [
      concesion.data ? "concesion_kiosco" : null,
      saldoMinimoCuenta > 0 && saldoActual >= saldoMinimoCuenta ? "saldo_minimo" : null,
    ].filter((valor): valor is "saldo_minimo" | "concesion_kiosco" => Boolean(valor));
    if (motivos.length === 0) return;
    asegurarPlazoAperturaCuenta(coop.id, motivos)
      .then(() => qc.invalidateQueries({ queryKey: ["apertura-cuenta-bancaria", coop.id] }))
      .catch((error: Error) => toast.error(error.message));
  }, [coop?.id, aperturaRequerida, concesion.data, saldoMinimoCuenta, saldoActual, qc]);

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

  const actualizarDato = (campo: keyof DatosInstitucionales, valor: string | boolean) => {
    setDatos((actual) => actual ? { ...actual, [campo]: valor } : actual);
  };

  const guardarBancarios = useMutation({
    mutationFn: async () => {
      if (!coop || !datosBancarios) throw new Error("No hay datos de cuenta bancaria para guardar.");
      return guardarCuentaBancaria(coop.id, datosBancarios);
    },
    onSuccess: (guardados) => {
      setDatosBancarios({ ...guardados, saldoBancario: String(guardados.saldoBancario) });
      setEditandoBancaria(false);
      qc.invalidateQueries({ queryKey: ["cuenta-bancaria", coop?.id] });
      toast.success("Datos de la cuenta bancaria guardados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actualizarDatoBancario = (campo: keyof CuentaBancariaCooperadora, valor: string) => {
    setDatosBancarios((actual) => actual ? { ...actual, [campo]: valor } : actual);
  };

  const guardarResumen = useMutation({
    mutationFn: async () => {
      if (!coop) throw new Error("No hay una cooperadora registrada.");
      if (!archivoResumenBancario) throw new Error("Seleccioná un resumen bancario en PDF.");
      return guardarResumenBancario(coop.id, archivoResumenBancario);
    },
    onSuccess: () => {
      setArchivoResumenBancario(null);
      qc.invalidateQueries({ queryKey: ["resumen-bancario", coop?.id] });
      toast.success("Resumen bancario actualizado correctamente.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
                Datos del Establecimiento Escolar
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
              <div className="space-y-2"><Label htmlFor="panel-cue">CUE *</Label><Input id="panel-cue" inputMode="numeric" value={datos.cue} readOnly required /><p className="text-xs text-muted-foreground">Solo modificable por auditoría.</p></div>
              <div className="space-y-2"><Label htmlFor="panel-nivel">Nivel de la escuela *</Label><Input id="panel-nivel" value={datos.nivel} onChange={(e) => actualizarDato("nivel", e.target.value)} placeholder="Nivel" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-turno">Turno *</Label><Input id="panel-turno" value={datos.turno} onChange={(e) => actualizarDato("turno", e.target.value)} placeholder="Turno" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-localidad">Localidad *</Label><Input id="panel-localidad" value={datos.localidad} onChange={(e) => actualizarDato("localidad", e.target.value)} placeholder="Localidad" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-director">Nombre y Apellido de Director/a *</Label><Input id="panel-director" value={datos.director_nombre} onChange={(e) => actualizarDato("director_nombre", e.target.value)} placeholder="Nombre y apellido" required /></div>
              <div className="space-y-2"><Label htmlFor="panel-director-dni">DNI de Director/a *</Label><Input id="panel-director-dni" inputMode="numeric" maxLength={8} value={datos.director_dni} onChange={(e) => actualizarDato("director_dni", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Número de DNI" required /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="panel-supervisor">Nombre y Apellido de Supervisor/a</Label><Input id="panel-supervisor" value={datos.supervisor_nombre} onChange={(e) => actualizarDato("supervisor_nombre", e.target.value)} placeholder="Nombre y apellido" /></div>
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label>¿La Cooperadora posee cuenta bancaria? *</Label>
                <div className="flex flex-wrap gap-6 rounded-md border border-border bg-secondary/20 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="posee-cuenta-bancaria" checked={datos.posee_cuenta_bancaria === true} onChange={() => actualizarDato("posee_cuenta_bancaria", true)} />
                    Sí
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="posee-cuenta-bancaria" checked={datos.posee_cuenta_bancaria === false} onChange={() => actualizarDato("posee_cuenta_bancaria", false)} />
                    No
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Si seleccionás “No”, el módulo bancario se oculta del panel. Al volver a seleccionar “Sí” y guardar, se muestra nuevamente la información bancaria registrada, incluido el saldo resguardado y el resumen bancario.</p>
              </div>
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
                <DatoInstitucional titulo="Cuenta bancaria" valor={datos.posee_cuenta_bancaria ? "Sí posee" : "No posee"} className="sm:col-span-2" />
                <DatoInstitucional titulo="Email Oficial de Cooperadora" valor={datos.email_oficial} className="sm:col-span-2 lg:col-span-2" />
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

      {!poseeCuentaBancaria && aperturaCuenta.data && (
        <Card className="mt-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
              <span>⚠</span> Apertura de cuenta bancaria requerida
            </CardTitle>
            <CardDescription>La Cooperadora debe realizar la apertura de una cuenta bancaria dentro de 05 días hábiles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Fecha de notificación: <span className="font-medium">{new Date(aperturaCuenta.data.fechaNotificacion + "T00:00:00").toLocaleDateString("es-AR")}</span></p>
            <p className={aperturaCuentaVencida(aperturaCuenta.data) ? "font-semibold text-destructive" : ""}>
              {aperturaCuentaVencida(aperturaCuenta.data)
                ? "El plazo de 05 días hábiles se encuentra vencido."
                : "Plazo para realizar la apertura: hasta el " + new Date(aperturaCuenta.data.fechaVencimiento + "T00:00:00").toLocaleDateString("es-AR") + "."}
            </p>
            <p className="text-xs text-muted-foreground">Motivo: {aperturaCuenta.data.motivos.includes("concesion_kiosco") ? "concesión de kiosco/cantina" : "saldo del Libro alcanzó el monto establecido por Auditoría"}.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>Informar que ya posee cuenta bancaria</Button>
          </CardContent>
        </Card>
      )}

      {poseeCuentaBancaria && (
      <Card className="mt-6">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <Wallet className="h-5 w-5 text-primary" />
                Fondos resguardados en cuenta bancaria
              </CardTitle>
              <CardDescription>
                Dinero de la Cooperadora depositado como medida de resguardo. Este importe no constituye un ingreso ni un egreso adicional del Libro.
              </CardDescription>
            </div>
            {!editandoBancaria && datosBancarios ? (
              <Button variant="outline" size="sm" onClick={() => setEditandoBancaria(true)}>
                Modificar datos
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {!datosBancarios && (
            <p className="text-sm text-muted-foreground">Cargando datos de la cuenta bancaria…</p>
          )}
          {editandoBancaria && datosBancarios && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label htmlFor="panel-saldo-bancario">Fondos resguardados en cuenta bancaria *</Label>
                <Input
                  id="panel-saldo-bancario"
                  inputMode="decimal"
                  value={datosBancarios.saldoBancario}
                  onChange={(e) => actualizarDatoBancario("saldoBancario", e.target.value)}
                  placeholder="Importe depositado"
                  required
                />
              </div>

              <div className="rounded-md border border-primary/20 bg-secondary/30 p-4 md:col-span-2 lg:col-span-4">
                <p className="font-medium">Titulares registrados en la cuenta</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Asesor/Director, Presidente y Tesorero, con sus respectivos DNI.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="panel-banco-asesor-nombre">Asesor/Director *</Label>
                <Input
                  id="panel-banco-asesor-nombre"
                  value={datosBancarios.asesorDirectorNombre}
                  onChange={(e) => actualizarDatoBancario("asesorDirectorNombre", e.target.value)}
                  placeholder="Nombre y apellido"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panel-banco-asesor-dni">DNI Asesor/Director *</Label>
                <Input
                  id="panel-banco-asesor-dni"
                  inputMode="numeric"
                  maxLength={8}
                  value={datosBancarios.asesorDirectorDni}
                  onChange={(e) => actualizarDatoBancario("asesorDirectorDni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="DNI"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="panel-banco-presidente-nombre">Presidente *</Label>
                <Input
                  id="panel-banco-presidente-nombre"
                  value={datosBancarios.presidenteNombre}
                  onChange={(e) => actualizarDatoBancario("presidenteNombre", e.target.value)}
                  placeholder="Nombre y apellido"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panel-banco-presidente-dni">DNI Presidente *</Label>
                <Input
                  id="panel-banco-presidente-dni"
                  inputMode="numeric"
                  maxLength={8}
                  value={datosBancarios.presidenteDni}
                  onChange={(e) => actualizarDatoBancario("presidenteDni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="DNI"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="panel-banco-tesorero-nombre">Tesorero *</Label>
                <Input
                  id="panel-banco-tesorero-nombre"
                  value={datosBancarios.tesoreroNombre}
                  onChange={(e) => actualizarDatoBancario("tesoreroNombre", e.target.value)}
                  placeholder="Nombre y apellido"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panel-banco-tesorero-dni">DNI Tesorero *</Label>
                <Input
                  id="panel-banco-tesorero-dni"
                  inputMode="numeric"
                  maxLength={8}
                  value={datosBancarios.tesoreroDni}
                  onChange={(e) => actualizarDatoBancario("tesoreroDni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="DNI"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 md:col-span-2 lg:col-span-4">
                <Button onClick={() => guardarBancarios.mutate()} disabled={guardarBancarios.isPending}>
                  {guardarBancarios.isPending ? "Guardando…" : "Guardar datos bancarios"}
                </Button>
                {cuentaBancaria.data && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const guardados = cuentaBancaria.data;
                      if (guardados) {
                        setDatosBancarios({ ...guardados, saldoBancario: String(guardados.saldoBancario) });
                      }
                      setEditandoBancaria(false);
                    }}
                    disabled={guardarBancarios.isPending}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
          {!editandoBancaria && datosBancarios && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tarjeta
                  titulo="Fondos resguardados"
                  valor={money(num(datosBancarios.saldoBancario))}
                  destacado
                />
                <TitularBancario
                  cargo="Asesor/Director"
                  nombre={datosBancarios.asesorDirectorNombre}
                  dni={datosBancarios.asesorDirectorDni}
                />
                <TitularBancario
                  cargo="Presidente"
                  nombre={datosBancarios.presidenteNombre}
                  dni={datosBancarios.presidenteDni}
                />
                <TitularBancario
                  cargo="Tesorero"
                  nombre={datosBancarios.tesoreroNombre}
                  dni={datosBancarios.tesoreroDni}
                />
              </div>

              {hayEfectivoEnMano ? (
                <div className="overflow-hidden rounded-md border border-primary/30 bg-primary/5">
                  <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Efectivo en mano</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Diferencia entre el saldo del Libro y los fondos resguardados.
                      </p>
                    </div>
                    <p className="font-serif text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                      {money(efectivoEnMano ?? 0)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

        <div className="mt-4 border-t border-border pt-4">
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <FileText className="h-5 w-5 text-primary" />
            Resumen bancario
          </CardTitle>
          <CardDescription>
            Adjuntá el resumen bancario de la cuenta. Debe actualizarse cada 6 meses.
          </CardDescription>

          <Input
            id="panel-resumen-bancario"
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setArchivoResumenBancario(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="panel-resumen-bancario"
              className="inline-flex cursor-pointer items-center justify-center rounded-md border border-primary/20 bg-secondary px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-secondary/80"
            >
              <Upload className="mr-2 h-4 w-4" />
              {resumenBancario.data ? "Modificar resumen bancario" : "Seleccionar resumen bancario"}
            </label>

            {archivoResumenBancario ? (
              <span className="text-sm text-muted-foreground">
                Archivo seleccionado: <span className="font-medium text-foreground">{archivoResumenBancario.name}</span>
              </span>
            ) : null}
          </div>

          {resumenBancario.data && (
            <div className="rounded-sm border border-border bg-secondary/30 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium break-all">{resumenBancario.data.nombreArchivo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última actualización: {new Date(resumenBancario.data.actualizadoEn).toLocaleString("es-AR")}
                  </p>
                  {(() => {
                    const proxima = calcularProximaActualizacionResumenBancario(resumenBancario.data.actualizadoEn);
                    return proxima ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Próxima actualización: {proxima.toLocaleDateString("es-AR")}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirResumenBancario(coop!.id).catch((error: Error) => toast.error(error.message))}
                  >
                    <FileText className="mr-2 h-4 w-4" /> Ver PDF
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => guardarResumen.mutate()}
                    disabled={!archivoResumenBancario || guardarResumen.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {guardarResumen.isPending ? "Subiendo…" : "Actualizar resumen"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!resumenBancario.data && (
            <p className="text-xs text-muted-foreground">
              Todavía no hay un resumen bancario cargado. El documento debe renovarse cada 6 meses.
            </p>
          )}

          {!resumenBancario.data && archivoResumenBancario && (
            <Button
              onClick={() => guardarResumen.mutate()}
              disabled={guardarResumen.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {guardarResumen.isPending ? "Subiendo…" : "Subir resumen bancario"}
            </Button>
          )}
        </div>

        </CardContent>
      </Card>
      )}

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
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/libro" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><Wallet className="h-5 w-5" /></span><div><p className="font-medium">Libro mensual</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consultar movimientos, comprobantes y cierres mensuales.</p></div></div></Link>
          <Link to="/anual" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><FileBarChart className="h-5 w-5" /></span><div><p className="font-medium">Resumen anual</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Consultar el resumen del ejercicio y sus resultados.</p></div></div></Link>
          <Link to="/comision" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><Users className="h-5 w-5" /></span><div><p className="font-medium">Comisión Directiva</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Completar autoridades y adjuntar el acta de constitución.</p></div></div></Link>
          <Link to="/concesion" className="group rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary"><Store className="h-5 w-5" /></span><div><p className="font-medium">Concesión de Kiosco/Cantina</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Registrar concesionario, canon y documentación respaldatoria.</p></div></div></Link>
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

function TitularBancario({
  cargo,
  nombre,
  dni,
}: {
  cargo: string;
  nombre: string;
  dni: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-3">
      <p className="text-xs text-muted-foreground">{cargo}</p>
      <p className="mt-1 text-sm font-medium">{nombre || "No informado"}</p>
      <p className="mt-1 text-xs text-muted-foreground">DNI {dni || "No informado"}</p>
    </div>
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
