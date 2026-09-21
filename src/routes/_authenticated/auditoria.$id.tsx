import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileText, Store, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import { LibroMensual } from "@/components/LibroMensual";
import {
  actualizarDatosIdentificatoriosCooperadora,
  cargarCooperadoraAuditoria,
} from "@/lib/data/auditoria";
import {
  abrirDocumentoConcesion,
  cargarConcesionKiosco,
  cargarDocumentoConcesion,
  concesionKioscoEstaVencida,
  fechaVencimientoVigenteConcesion,
} from "@/lib/data/concesion";
import { cargarCuentaBancaria } from "@/lib/data/cuenta-bancaria";
import { cargarAperturaCuentaBancaria, aperturaCuentaVencida } from "@/lib/data/apertura-cuenta-bancaria";
import { calcularEjercicio, cargarEjercicio, cargarParametros } from "@/lib/libro";
import {
  abrirResumenBancario,
  calcularProximaActualizacionResumenBancario,
  cargarResumenBancario,
  resumenBancarioVencido,
} from "@/lib/data/resumen-bancario";
import { cargarDatosInstitucionales, cargarHistorialDatosInstitucionales } from "@/lib/data/datos-institucionales";
import {
  calcularFinMandato,
  cargarComisionDirectiva,
  guardarComisionDirectiva,
  type CargoComision,
  type DatosComisionDirectiva,
} from "@/lib/data/comision";
import {
  cargarHistorialComisionDirectiva,
  registrarModificacionComisionDirectiva,
} from "@/lib/data/comision-historial";
import { cargarSolicitudesCambioMandato, resolverSolicitudCambioMandato } from "@/lib/data/comision-mandatos-solicitudes";
import {
  cargarHistorialConcesionKiosco,
  cargarHistorialDocumentosConcesion,
  registrarModificacionConcesionKiosco,
} from "@/lib/data/concesion-historial";
import {
  cargarSolicitudesReconsideracionCanon,
  resolverSolicitudReconsideracionCanon,
} from "@/lib/data/concesion-solicitudes-canon";
import { usingMinisterioApi } from "@/lib/data/index";
import { money, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/auditoria/$id")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    mes: search["mes"] ? Number(search["mes"]) : undefined,
  }),

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

const ETIQUETAS_CARGO: Record<CargoComision, string> = {
  presidente: "Presidente",
  secretario: "Secretario",
  tesorero: "Tesorero",
  vocal_1: "Vocal 1",
  vocal_2: "Vocal 2",
  revisor_cuentas: "Revisor de Cuentas",
  asesor_director: "Asesor/Director",
};

function AuditoriaLibroPage() {
  const { id } = Route.useParams();
  const { mes } = Route.useSearch();
  const { data: ctx } = useContexto();
  const qc = useQueryClient();
  const [editandoIdentificacion, setEditandoIdentificacion] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cue, setCue] = useState("");
  const [editandoMandato, setEditandoMandato] = useState(false);
  const [fechaInicioMandato, setFechaInicioMandato] = useState("");
  const [numeroPeriodo, setNumeroPeriodo] = useState("1");

  const coop = useQuery({
    queryKey: ["cooperadora", id],
    queryFn: () => cargarCooperadoraAuditoria(id),
    enabled: !!ctx?.esAuditor,
  });

  const datosInstitucionales = useQuery({
    queryKey: ["datos-institucionales", id],
    queryFn: () => cargarDatosInstitucionales(coop.data!),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialInstitucional = useQuery({
    queryKey: ["historial-datos-institucionales", id],
    queryFn: () => cargarHistorialDatosInstitucionales(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const comision = useQuery({
    queryKey: ["comision-directiva", id],
    queryFn: () => cargarComisionDirectiva(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialComision = useQuery({
    queryKey: ["historial-comision-directiva", id],
    queryFn: () => cargarHistorialComisionDirectiva(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });
  const solicitudesMandato = useQuery({
    queryKey: ["solicitudes-mandato", id],
    queryFn: () => cargarSolicitudesCambioMandato(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const cuentaBancaria = useQuery({
    queryKey: ["cuenta-bancaria", id],
    queryFn: () => cargarCuentaBancaria(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const parametros = useQuery({
    queryKey: ["parametros"],
    queryFn: cargarParametros,
    staleTime: 30_000,
    enabled: !!ctx?.esAuditor,
  });

  const aperturaCuenta = useQuery({
    queryKey: ["apertura-cuenta-bancaria", id],
    queryFn: () => cargarAperturaCuentaBancaria(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const ejercicio = useQuery({
    queryKey: ["ejercicio-auditoria", id, coop.data?.ejercicio],
    queryFn: () => cargarEjercicio(id, coop.data!.ejercicio),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const resumenBancario = useQuery({
    queryKey: ["resumen-bancario", id],
    queryFn: () => cargarResumenBancario(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const concesion = useQuery({
    queryKey: ["concesion-kiosco", id],
    queryFn: () => cargarConcesionKiosco(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialConcesion = useQuery({
    queryKey: ["historial-concesion-kiosco", id],
    queryFn: () => cargarHistorialConcesionKiosco(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialDocumentosConcesion = useQuery({
    queryKey: ["historial-documentos-concesion", id],
    queryFn: () => cargarHistorialDocumentosConcesion(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const contrato = useQuery({
    queryKey: ["documento-concesion", id, "contrato"],
    queryFn: () => cargarDocumentoConcesion(id, "contrato"),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const contratoSellado = useQuery({
    queryKey: ["documento-concesion", id, "contrato_sellado"],
    queryFn: () => cargarDocumentoConcesion(id, "contrato_sellado"),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const buenaConducta = useQuery({
    queryKey: ["documento-concesion", id, "buena_conducta"],
    queryFn: () => cargarDocumentoConcesion(id, "buena_conducta"),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const solicitudesCanon = useQuery({
    queryKey: ["solicitudes-reconsideracion-canon", id],
    queryFn: () => cargarSolicitudesReconsideracionCanon(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const resolverSolicitudMandato = useMutation({
    mutationFn: async (input: { decision: "aprobar" | "rechazar"; solicitudId: string }) => {
      if (!ctx) throw new Error("No se pudo identificar al auditor.");
      const solicitud = (solicitudesMandato.data ?? []).find((item) => item.id === input.solicitudId);
      if (!solicitud) throw new Error("No se encontró la solicitud.");
      return resolverSolicitudCambioMandato(
        solicitud,
        input.decision,
        {
          id: ctx.userId,
          nombre: ctx.nombre || "Auditor",
          email: ctx.email,
        },
        input.decision === "rechazar" ? "Solicitud rechazada por Auditoría." : "Solicitud autorizada por Auditoría.",
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitudes-mandato", id] });
      qc.invalidateQueries({ queryKey: ["comision-directiva", id] });
      qc.invalidateQueries({ queryKey: ["historial-comision-directiva", id] });
      qc.invalidateQueries({ queryKey: ["panel-auditor"] });
      toast.success("Solicitud de mandato actualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const autorizarCambioMandato = useMutation({
    mutationFn: async () => {
      if (!ctx) throw new Error("No se pudo identificar al auditor.");
      if (!comision.data) throw new Error("No hay una Comisión Directiva registrada.");

      const periodo = Number(numeroPeriodo);
      if (!Number.isInteger(periodo) || periodo < 1 || periodo > 2) {
        throw new Error("El período debe ser 1 o 2.");
      }
      if (!fechaInicioMandato) {
        throw new Error("Debés indicar la fecha de constitución / inicio del mandato.");
      }

      const fechaFin = calcularFinMandato(fechaInicioMandato);
      const guardados = (await guardarComisionDirectiva(id, comision.data.miembros, {
        fechaInicioMandato,
        fechaFinMandato: fechaFin,
        numeroPeriodo: periodo,
      })) as DatosComisionDirectiva;

      await registrarModificacionComisionDirectiva(
        id,
        guardados.miembros,
        {
          id: ctx.userId,
          nombre: ctx.nombre || "Auditor",
          email: ctx.email,
        },
        {
          tipo: "modificacion",
          fechaInicioMandato,
          fechaFinMandato: fechaFin,
          numeroPeriodo: periodo,
        },
      );

      return guardados;
    },
    onSuccess: () => {
      setEditandoMandato(false);
      qc.invalidateQueries({ queryKey: ["comision-directiva", id] });
      qc.invalidateQueries({ queryKey: ["historial-comision-directiva", id] });
      qc.invalidateQueries({ queryKey: ["panel-auditor"] });
      toast.success("Mandato autorizado y actualizado por Auditoría.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resolverSolicitudCanon = useMutation({
    mutationFn: async (input: { decision: "aprobar" | "rechazar"; solicitudId: string }) => {
      if (!ctx) throw new Error("No se pudo identificar al auditor.");
      const solicitud = (solicitudesCanon.data ?? []).find((item) => item.id === input.solicitudId);
      if (!solicitud) throw new Error("No se encontró el pedido de reconsideración.");

      const auditor = {
        id: ctx.userId,
        nombre: ctx.nombre || "Auditor",
        email: ctx.email,
      };

      const resultado = await resolverSolicitudReconsideracionCanon(
        solicitud,
        input.decision,
        auditor,
        input.decision === "rechazar"
          ? "Pedido rechazado por Auditoría."
          : "Pedido autorizado por Auditoría.",
      );

      if (input.decision === "aprobar" && !usingMinisterioApi()) {
        const concesionActual = await cargarConcesionKiosco(id);
        if (concesionActual) {
          await registrarModificacionConcesionKiosco(id, concesionActual, auditor);
        }
      }

      return resultado;
    },
    onSuccess: (_resultado, input) => {
      qc.invalidateQueries({ queryKey: ["solicitudes-reconsideracion-canon", id] });
      qc.invalidateQueries({ queryKey: ["concesion-kiosco", id] });
      qc.invalidateQueries({ queryKey: ["historial-concesion-kiosco", id] });
      qc.invalidateQueries({ queryKey: ["panel-auditor"] });
      toast.success(input.decision === "aprobar" ? "Pedido de reconsideración autorizado." : "Pedido de reconsideración rechazado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actualizarIdentificacion = useMutation({
    mutationFn: () => actualizarDatosIdentificatoriosCooperadora(id, { nombre, cue }),
    onSuccess: () => {
      setEditandoIdentificacion(false);
      qc.invalidateQueries({ queryKey: ["cooperadora", id] });
      toast.success("Nombre de la escuela y CUE actualizados por auditoría.");
    },
    onError: (error: Error) => toast.error(error.message),
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
  const datos = datosInstitucionales.data;
  const historial = historialInstitucional.data ?? [];
  const autoridades = comision.data?.miembros ?? [];
  const historialAutoridades = historialComision.data ?? [];
  const datosBancarios = cuentaBancaria.data;
  const poseeCuentaBancaria = Boolean(datos?.posee_cuenta_bancaria);
  const resumenBancarioData = resumenBancario.data;
  const hoyAuditoria = new Date();
  const mesActualAuditoria =
    c.ejercicio === hoyAuditoria.getFullYear() ? hoyAuditoria.getMonth() + 1 : 12;
  const resumenAuditoria = ejercicio.data
    ? calcularEjercicio(num(c.saldo_inicial_ejercicio), ejercicio.data.periodos, ejercicio.data.movimientos, parametros.data)
    : [];
  const saldoActualAuditoria =
    resumenAuditoria.find((r) => r.mes === mesActualAuditoria)?.saldoFinal ??
    resumenAuditoria[resumenAuditoria.length - 1]?.saldoFinal ??
    num(c.saldo_inicial_ejercicio);
  const saldoMinimoCuenta = num(parametros.data?.saldo_minimo_cuenta_bancaria ?? 0);
  const resumenBancarioDesactualizado =
    !resumenBancario.isLoading && resumenBancarioVencido(resumenBancarioData);
  const proximaActualizacionResumen = resumenBancarioData
    ? calcularProximaActualizacionResumenBancario(resumenBancarioData.actualizadoEn)
    : null;
  const datosConcesion = concesion.data;
  const historialConcesionData = historialConcesion.data ?? [];
  const contratoConcesionVencido = Boolean(datosConcesion && concesionKioscoEstaVencida(datosConcesion));
  const fechaVencimientoConcesion = datosConcesion
    ? fechaVencimientoVigenteConcesion(datosConcesion)
    : "";
  const historialDocumentosConcesionData = historialDocumentosConcesion.data ?? [];
  const cambiosCanonAuditoria = construirHistorialCanonAuditoria(historialConcesionData);
  const actualizacionesCanonAuditoria = construirActualizacionesCanonAuditoria(historialConcesionData, "contrato");
  const actualizacionesCanonProrrogaAuditoria = datosConcesion?.tieneProrroga
    ? construirActualizacionesCanonAuditoria(historialConcesionData, "prorroga")
    : [];
  const hayReduccionCanon = cambiosCanonAuditoria.some((cambio) => cambio.esBaja);
  const faltanDocumentosConcesion = [
    !buenaConducta.data ? "Certificado de buena conducta" : null,
    !contratoSellado.data ? "Sellado del contrato" : null,
  ].filter((valor): valor is string => Boolean(valor));

  const presidenteComision = autoridades.find((miembro) => miembro.cargo === "presidente");
  const tesoreroComision = autoridades.find((miembro) => miembro.cargo === "tesorero");
  const dniCuentaPresidente = normalizarDni(datosBancarios?.presidenteDni);
  const dniComisionPresidente = normalizarDni(presidenteComision?.dni);
  const dniCuentaTesorero = normalizarDni(datosBancarios?.tesoreroDni);
  const dniComisionTesorero = normalizarDni(tesoreroComision?.dni);
  const alertasDniCuentaBancaria =
    !cuentaBancaria.isLoading && datosBancarios && poseeCuentaBancaria
      ? [
          dniCuentaPresidente !== dniComisionPresidente
            ? `Presidente: el DNI de la cuenta bancaria es ${datosBancarios.presidenteDni}, pero en la Comisión Directiva figura ${presidenteComision?.dni || "sin DNI registrado"}.`
            : null,
          dniCuentaTesorero !== dniComisionTesorero
            ? `Tesorero: el DNI de la cuenta bancaria es ${datosBancarios.tesoreroDni}, pero en la Comisión Directiva figura ${tesoreroComision?.dni || "sin DNI registrado"}.`
            : null,
        ].filter((valor): valor is string => Boolean(valor))
      : [];

  const alertasCuentaBancaria = [
    !poseeCuentaBancaria && datosConcesion
      ? "La escuela posee concesión de kiosco/cantina y no tiene cuenta bancaria declarada."
      : null,
    !poseeCuentaBancaria && saldoMinimoCuenta > 0 && saldoActualAuditoria >= saldoMinimoCuenta
      ? `El saldo actual de ${money(saldoActualAuditoria)} alcanza el monto de ${money(saldoMinimoCuenta)} que obliga a abrir una cuenta bancaria, y la escuela no tiene cuenta declarada.`
      : null,
  ].filter((valor): valor is string => Boolean(valor));

  const iniciarEdicionIdentificacion = () => {
    setNombre(c.nombre ?? "");
    setCue(c.cue ?? "");
    setEditandoIdentificacion(true);
  };

  return (
    <AppShell
      titulo={c.nombre}
      descripcion={[c.localidad, c.cue ? `CUE ${c.cue}` : null, `Ejercicio ${c.ejercicio}`]
        .filter(Boolean)
        .join(" · ")}
      acciones={volver}
    >
      <details className="mb-6 rounded-sm border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Datos institucionales
            </span>
            <span className="text-xs font-normal text-muted-foreground">Ver información</span>
          </span>
        </summary>
        <div className="border-t border-border p-4">
          {!datos ? (
            <p className="text-sm text-muted-foreground">Cargando datos institucionales…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {editandoIdentificacion ? (
                <>
                  <div className="space-y-2 lg:col-span-3"><Label htmlFor="auditoria-nombre">Nombre de la escuela</Label><Input id="auditoria-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="auditoria-cue">CUE</Label><Input id="auditoria-cue" inputMode="numeric" value={cue} onChange={(e) => setCue(e.target.value.replace(/\D/g, ""))} /></div>
                  <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                    <Button onClick={() => actualizarIdentificacion.mutate()} disabled={actualizarIdentificacion.isPending}>
                      {actualizarIdentificacion.isPending ? "Guardando…" : "Autorizar y guardar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditandoIdentificacion(false)} disabled={actualizarIdentificacion.isPending}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <DatoInstitucional titulo="Nombre de la escuela" valor={c.nombre} className="lg:col-span-3" />
                  <DatoInstitucional titulo="CUE" valor={c.cue ?? ""} />
                </>
              )}
              <DatoInstitucional titulo="Nivel" valor={datos.nivel} />
              <DatoInstitucional titulo="Turno" valor={datos.turno} />
              <DatoInstitucional titulo="Localidad" valor={datos.localidad} />
              <DatoInstitucional titulo="Director/a" valor={datos.director_nombre} className="sm:col-span-2" />
              <DatoInstitucional titulo="Supervisor/a" valor={datos.supervisor_nombre} className="sm:col-span-2" />
              <DatoInstitucional titulo="Email oficial de Cooperadora" valor={datos.email_oficial} className="sm:col-span-2 lg:col-span-4" />
              {!editandoIdentificacion && (
                <div className="flex items-center justify-between border-t border-border pt-3 sm:col-span-2 lg:col-span-4">
                  <p className="text-xs text-muted-foreground">Nombre y CUE: solo modificables por auditoría.</p>
                  <Button variant="outline" size="sm" onClick={iniciarEdicionIdentificacion}>Autorizar modificación</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {historial.length > 0 && (
        <details className="mb-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones de datos institucionales</span>
              <span className="text-xs font-normal text-muted-foreground">{historial.length} registro{historial.length === 1 ? "" : "s"}</span>
            </span>
          </summary>
          <div className="border-t border-border p-4 space-y-2">
            {historial.map((registro) => (
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Users className="h-5 w-5 text-primary" /> Comisión Directiva
          </CardTitle>
          <CardDescription>
            Autoridades actualmente registradas por la cooperadora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {comision.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando comisión directiva…</p>
          ) : autoridades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay integrantes registrados.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {autoridades.map((miembro) => (
                  <div key={miembro.cargo} className="rounded-sm border border-border px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">{ETIQUETAS_CARGO[miembro.cargo]}</p>
                    <p className="mt-1 font-medium">{miembro.nombre}</p>
                    {miembro.dni && <p className="text-xs text-muted-foreground">DNI {miembro.dni}</p>}
                  </div>
                ))}
              </div>

              {(solicitudesMandato.data ?? []).filter((solicitud) => solicitud.estado === "pendiente").map((solicitud) => (
                <div key={solicitud.id} className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm">
                  <p className="font-medium">Solicitud de modificación de mandato pendiente</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <DatoInstitucional titulo="Período actual" valor={String(solicitud.numero_periodo_actual)} />
                    <DatoInstitucional titulo="Período solicitado" valor={String(solicitud.numero_periodo_solicitado)} />
                    <DatoInstitucional titulo="Inicio solicitado" valor={formatearFechaAuditoria(solicitud.fecha_inicio_solicitada)} />
                    <DatoInstitucional titulo="Vencimiento solicitado" valor={formatearFechaAuditoria(solicitud.fecha_fin_solicitada)} />
                    <DatoInstitucional titulo="Solicitado por" valor={solicitud.usuario_nombre} />
                    <DatoInstitucional titulo="Fecha de solicitud" valor={new Date(solicitud.solicitada_en).toLocaleString("es-AR")} />
                  </div>
                  <p className="mt-3 text-sm">Motivo: {solicitud.motivo}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => resolverSolicitudMandato.mutate({ decision: "aprobar", solicitudId: solicitud.id })}
                      disabled={resolverSolicitudMandato.isPending}
                    >
                      Autorizar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => resolverSolicitudMandato.mutate({ decision: "rechazar", solicitudId: solicitud.id })}
                      disabled={resolverSolicitudMandato.isPending}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Vigencia del mandato</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Período {comision.data?.numeroPeriodo || "—"} · Inicio {formatearFechaAuditoria(comision.data?.fechaInicioMandato)} · Vencimiento {formatearFechaAuditoria(comision.data?.fechaFinMandato)}
                    </p>
                  </div>
                  {!editandoMandato && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFechaInicioMandato(comision.data?.fechaInicioMandato ?? "");
                        setNumeroPeriodo(String(comision.data?.numeroPeriodo || 1));
                        setEditandoMandato(true);
                      }}
                    >
                      Autorizar modificación
                    </Button>
                  )}
                </div>

                {editandoMandato && (
                  <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="auditoria-periodo-comision">Período</Label>
                      <Input
                        id="auditoria-periodo-comision"
                        type="number"
                        min={1}
                        max={2}
                        value={numeroPeriodo}
                        onChange={(e) => setNumeroPeriodo(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Solo se admiten los períodos 1 y 2.</p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="auditoria-inicio-mandato">Fecha de constitución / inicio</Label>
                      <Input
                        id="auditoria-inicio-mandato"
                        type="date"
                        value={fechaInicioMandato}
                        onChange={(e) => setFechaInicioMandato(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Al guardar, el vencimiento se calcula automáticamente a 2 años.
                      </p>
                    </div>
                    <div className="flex gap-2 sm:col-span-3">
                      <Button
                        onClick={() => autorizarCambioMandato.mutate()}
                        disabled={autorizarCambioMandato.isPending}
                      >
                        {autorizarCambioMandato.isPending ? "Guardando…" : "Autorizar y guardar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditandoMandato(false)}
                        disabled={autorizarCambioMandato.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {alertasCuentaBancaria.length > 0 && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
              <span>⚠</span> Alerta sobre la cuenta bancaria
            </CardTitle>
            <CardDescription>
              La situación requiere revisión de Auditoría según los criterios de cuenta bancaria establecidos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertasCuentaBancaria.map((alerta) => (
              <p key={alerta} className="text-sm text-destructive">• {alerta}</p>
            ))}
            {aperturaCuenta.data ? (
              <div className="rounded-sm border border-destructive/20 bg-background/60 p-3 text-sm">
                <p>
                  Fecha de notificación:{" "}
                  <span className="font-medium">
                    {new Date(aperturaCuenta.data.fechaNotificacion + "T00:00:00").toLocaleDateString("es-AR")}
                  </span>
                </p>
                <p className={aperturaCuentaVencida(aperturaCuenta.data) ? "mt-1 font-semibold text-destructive" : "mt-1"}>
                  {aperturaCuentaVencida(aperturaCuenta.data)
                    ? "El plazo de 05 días hábiles se encuentra vencido."
                    : "Plazo para realizar la apertura: hasta el " + new Date(aperturaCuenta.data.fechaVencimiento + "T00:00:00").toLocaleDateString("es-AR") + "."}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {poseeCuentaBancaria ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Wallet className="h-5 w-5 text-primary" /> Fondos resguardados en cuenta bancaria
            </CardTitle>
            <CardDescription>Fondos resguardados y titulares registrados en la cuenta de la cooperadora.</CardDescription>
          </CardHeader>
          <CardContent>
            {cuentaBancaria.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando datos de la cuenta bancaria…</p>
            ) : !datosBancarios ? (
              <p className="text-sm text-muted-foreground">No hay datos de cuenta bancaria registrados.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <DatoInstitucional titulo="Fondos resguardados" valor={money(num(datosBancarios.saldoBancario))} className="sm:col-span-2 lg:col-span-4" />
                <DatoInstitucional titulo="Asesor/Director" valor={datosBancarios.asesorDirectorNombre} />
                <DatoInstitucional titulo="DNI Asesor/Director" valor={datosBancarios.asesorDirectorDni} />
                <DatoInstitucional titulo="Presidente" valor={datosBancarios.presidenteNombre} />
                <DatoInstitucional titulo="DNI Presidente" valor={datosBancarios.presidenteDni} />
                <DatoInstitucional titulo="Tesorero" valor={datosBancarios.tesoreroNombre} />
                <DatoInstitucional titulo="DNI Tesorero" valor={datosBancarios.tesoreroDni} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {poseeCuentaBancaria && resumenBancarioDesactualizado && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
              <span>⚠</span> Alerta de resumen bancario desactualizado
            </CardTitle>
            <CardDescription>
              El resumen bancario debe actualizarse cada 6 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resumenBancarioData ? (
              <p className="text-sm text-destructive">
                No hay ningún resumen bancario cargado para esta cooperadora.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                <p>
                  Última actualización:{" "}
                  <span className="font-medium">
                    {new Date(resumenBancarioData.actualizadoEn).toLocaleString("es-AR")}
                  </span>
                </p>
                {proximaActualizacionResumen ? (
                  <p className="text-destructive">
                    Debía actualizarse antes del{" "}
                    <span className="font-medium">
                      {proximaActualizacionResumen.toLocaleDateString("es-AR")}
                    </span>.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <p className="break-all text-xs text-muted-foreground">
                    Archivo: {resumenBancarioData.nombreArchivo}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      abrirResumenBancario(id).catch((error: Error) => toast.error(error.message))
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" /> Ver PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {poseeCuentaBancaria && alertasDniCuentaBancaria.length > 0 && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
              <span>⚠</span> Alerta de titulares de la cuenta bancaria
            </CardTitle>
            <CardDescription>
              Se detectó una diferencia entre los DNI registrados en la cuenta bancaria y los DNI de la Comisión Directiva.
              La comparación se realiza por DNI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertasDniCuentaBancaria.map((alerta) => (
                <p key={alerta} className="text-sm text-destructive">• {alerta}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {historialAutoridades.length > 0 && (
        <details className="mb-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones de la Comisión Directiva</span>
              <span className="text-xs font-normal text-muted-foreground">
                {historialAutoridades.length} registro{historialAutoridades.length === 1 ? "" : "s"}
              </span>
            </span>
          </summary>
          <div className="space-y-2 border-t border-border p-4">
            {historialAutoridades.map((registro) => (
              <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                <summary className="cursor-pointer list-none text-sm">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{registro.usuario_nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}</span>
                    <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                  </span>
                </summary>
                <div className="mt-3 grid gap-1 border-t border-border pt-3 text-xs sm:grid-cols-2">
                  {registro.miembros.map((miembro) => (
                    <div key={miembro.cargo} className="rounded-sm bg-secondary/40 px-2 py-1.5">
                      <span className="font-medium">{ETIQUETAS_CARGO[miembro.cargo]}:</span>{" "}
                      {miembro.nombre}{miembro.dni ? ` · DNI ${miembro.dni}` : ""}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      {faltanDocumentosConcesion.length > 0 && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
              <span>⚠</span> Documentación de concesión incompleta
            </CardTitle>
            <CardDescription>
              La auditoría detectó que falta documentación obligatoria de la concesión.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">Documentación faltante:</p>
            <div className="mt-2 space-y-1">
              {faltanDocumentosConcesion.map((documento) => (
                <p key={documento} className="text-sm text-destructive">• {documento}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(solicitudesCanon.data ?? []).filter((solicitud) => solicitud.estado === "pendiente").map((solicitud) => (
        <Card key={solicitud.id} className="mb-6 border-2 border-red-500 bg-red-50 text-red-900 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <span className="text-red-600">⚠</span> Pedido de reconsideración del canon pendiente
            </CardTitle>
            <CardDescription className="text-red-800/80">
              La Cooperadora solicitó modificar el canon vigente. El cambio no se aplica hasta la resolución de Auditoría.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <DatoInstitucional titulo="Tipo de canon" valor={solicitud.tipo_canon === "prorroga" ? "Prórroga" : "Contrato"} />
              <DatoInstitucional titulo="Canon actual" valor={money(solicitud.canon_actual)} />
              <DatoInstitucional titulo="Canon solicitado" valor={money(solicitud.canon_solicitado)} />
              <DatoInstitucional titulo="Solicitado por" valor={solicitud.usuario_nombre} />
              <DatoInstitucional titulo="Fecha de solicitud" valor={new Date(solicitud.solicitada_en).toLocaleString("es-AR")} />
            </div>
            <div className="mt-4 rounded-sm border border-red-200 bg-white p-3">
              <p className="text-xs font-medium text-red-800">Motivo</p>
              <p className="mt-1 text-sm">{solicitud.motivo}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => resolverSolicitudCanon.mutate({ decision: "aprobar", solicitudId: solicitud.id })}
                disabled={resolverSolicitudCanon.isPending}
              >
                Autorizar
              </Button>
              <Button
                variant="outline"
                onClick={() => resolverSolicitudCanon.mutate({ decision: "rechazar", solicitudId: solicitud.id })}
                disabled={resolverSolicitudCanon.isPending}
              >
                Rechazar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {contratoConcesionVencido && (
        <Card className="mb-6 border-2 border-red-500 bg-red-50 text-red-900 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <span className="text-red-600">⚠</span> Contrato de concesión vencido
            </CardTitle>
            <CardDescription className="text-red-800/80">
              La concesión ya no tiene un contrato o prórroga vigente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              La vigencia finalizó el{" "}
              <span className="font-semibold">{formatearFechaContratoAuditoria(fechaVencimientoConcesion)}</span>.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Store className="h-5 w-5 text-primary" /> Concesión de Kioscos y Cantinas
          </CardTitle>
          <CardDescription>Datos del concesionario, canon y documentación respaldatoria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {concesion.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando datos de concesión…</p>
          ) : !datosConcesion ? (
            <p className="text-sm text-muted-foreground">No hay datos de concesión registrados.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <DatoInstitucional titulo="Apellido" valor={datosConcesion.apellido} />
              <DatoInstitucional titulo="Nombre" valor={datosConcesion.nombre} />
              <DatoInstitucional
                titulo="Fecha de firma del contrato"
                valor={formatearFechaContratoAuditoria(datosConcesion.fechaFirmaContrato)}
              />
              <DatoInstitucional titulo="Canon inicial" valor={money(num(datosConcesion.canon))} />
              <DatoInstitucional
                titulo="1.º canon actualizado"
                valor={actualizacionesCanonAuditoria[0] ? money(actualizacionesCanonAuditoria[0].valor) : "No actualizado todavía"}
              />
              <DatoInstitucional
                titulo="2.º canon actualizado"
                valor={actualizacionesCanonAuditoria[1] ? money(actualizacionesCanonAuditoria[1].valor) : "No actualizado todavía"}
              />
              <DatoInstitucional titulo="Canon vigente" valor={money(num(datosConcesion.canonVigente))} />
              {datosConcesion.tieneProrroga ? (
                <>
                  <DatoInstitucional
                    titulo="Canon inicial de la prórroga"
                    valor={money(num(datosConcesion.canonProrroga))}
                  />
                  <DatoInstitucional
                    titulo="1.º canon actualizado de la prórroga"
                    valor={actualizacionesCanonProrrogaAuditoria[0] ? money(actualizacionesCanonProrrogaAuditoria[0].valor) : "No actualizado todavía"}
                  />
                  <DatoInstitucional
                    titulo="2.º canon actualizado de la prórroga"
                    valor={actualizacionesCanonProrrogaAuditoria[1] ? money(actualizacionesCanonProrrogaAuditoria[1].valor) : "No actualizado todavía"}
                  />
                  <DatoInstitucional
                    titulo="Canon vigente de la prórroga"
                    valor={money(num(datosConcesion.canonProrrogaVigente))}
                  />
                </>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <DocumentoAuditoria
              titulo="Contrato de concesión"
              documento={contrato.data}
              onOpen={() => abrirDocumentoConcesion(id, "contrato").catch((error: Error) => toast.error(error.message))}
            />
            <DocumentoAuditoria
              titulo="Sellado de contrato"
              documento={contratoSellado.data}
              onOpen={() => abrirDocumentoConcesion(id, "contrato_sellado").catch((error: Error) => toast.error(error.message))}
            />
            <DocumentoAuditoria
              titulo="Certificado de buena conducta"
              documento={buenaConducta.data}
              onOpen={() => abrirDocumentoConcesion(id, "buena_conducta").catch((error: Error) => toast.error(error.message))}
            />
          </div>
        </CardContent>
      </Card>

      {hayReduccionCanon && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
              <span>⚠</span> Alerta de reducción del canon
            </CardTitle>
            <CardDescription>
              Se detectó una modificación en la que el nuevo canon es menor al valor registrado anteriormente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Valor anterior</th>
                    <th className="px-3 py-2 font-medium">Nuevo valor</th>
                    <th className="px-3 py-2 font-medium">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {cambiosCanonAuditoria.filter((cambio) => cambio.esBaja).map((cambio) => (
                    <tr key={cambio.id} className="border-b border-destructive/20 last:border-0">
                      <td className="px-3 py-2 text-xs">{new Date(cambio.modificadoEn).toLocaleString("es-AR")}</td>
                      <td className="px-3 py-2">{money(cambio.valorAnterior)}</td>
                      <td className="px-3 py-2 font-medium text-destructive">{money(cambio.nuevoValor)}</td>
                      <td className="px-3 py-2 text-xs">
                        <span>{cambio.usuarioNombre}</span>
                        {cambio.usuarioEmail ? <span className="block text-muted-foreground">{cambio.usuarioEmail}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(historialConcesionData.length > 0 || historialDocumentosConcesionData.length > 0) && (
        <details className="mb-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones de la concesión</span>
              <span className="text-xs font-normal text-muted-foreground">
                {historialConcesionData.length + historialDocumentosConcesionData.length} registro{historialConcesionData.length + historialDocumentosConcesionData.length === 1 ? "" : "s"}
              </span>
            </span>
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            {historialDocumentosConcesionData.length > 0 && (
              <div className="rounded-sm border border-border">
                <div className="border-b border-border bg-secondary/40 px-3 py-3">
                  <p className="text-sm font-medium">Historial de documentación</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cargas y reemplazos de los archivos respaldatorios.
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {historialDocumentosConcesionData.map((registro) => (
                    <div
                      key={registro.id}
                      className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{tituloTipoDocumentoAuditoria(registro.tipo)}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{registro.nombreArchivo}</p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm font-medium">
                          {registro.accion === "reemplazo" ? "Archivo modificado" : "Archivo cargado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {registro.usuario_nombre}
                          {registro.usuario_email ? ` · ${registro.usuario_email}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(registro.modificado_en).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {historialConcesionData.map((registro) => (
              <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                <summary className="cursor-pointer list-none text-sm">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{registro.datos.apellido}, {registro.datos.nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}</span>
                    <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                  </span>
                </summary>
                <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                  <DatoInstitucional titulo="Apellido" valor={registro.datos.apellido} />
                  <DatoInstitucional titulo="Nombre" valor={registro.datos.nombre} />
                  <DatoInstitucional titulo="Canon" valor={money(num(registro.datos.canon))} />
                </div>
              </details>
            ))}
            </div>
          </div>
        </details>
      )}

      <LibroMensual cooperadora={c} soloLectura mesInicial={mes} />
    </AppShell>
  );
}

function formatearFechaAuditoria(valor: string | null | undefined) {
  if (!valor) return "No informada";
  return new Date(`${valor}T00:00:00`).toLocaleDateString("es-AR");
}

function normalizarDni(valor: string | undefined) {
  return (valor ?? "").replace(/\D/g, "");
}

function tituloTipoDocumentoAuditoria(
  tipo: "contrato" | "contrato_sellado" | "buena_conducta",
) {
  if (tipo === "contrato") return "Contrato de concesión";
  if (tipo === "contrato_sellado") return "Sellado de contrato";
  return "Certificado de buena conducta";
}

function construirActualizacionesCanonAuditoria(
  historial: Array<{
    datos: {
      canon: number | string;
      canonVigente: number | string;
      canonProrroga: number | string;
      canonProrrogaVigente: number | string;
    };
    modificado_en: string;
  }>,
  tipo: "contrato" | "prorroga",
) {
  const cronologico = [...historial].reverse();
  const actualizaciones: Array<{ valor: number; fecha: string }> = [];

  for (let i = 1; i < cronologico.length; i += 1) {
    const anterior = cronologico[i - 1]?.datos;
    const actual = cronologico[i]?.datos;
    if (!anterior || !actual) continue;

    const valorAnterior =
      tipo === "prorroga"
        ? Number(anterior.canonProrrogaVigente ?? anterior.canonProrroga)
        : Number(anterior.canonVigente ?? anterior.canon);
    const valorActual =
      tipo === "prorroga"
        ? Number(actual.canonProrrogaVigente ?? actual.canonProrroga)
        : Number(actual.canonVigente ?? actual.canon);

    if (!Number.isFinite(valorAnterior) || !Number.isFinite(valorActual)) continue;
    if (valorAnterior === valorActual) continue;

    actualizaciones.push({
      valor: valorActual,
      fecha: cronologico[i]?.modificado_en ?? "",
    });
  }

  return actualizaciones.slice(0, 2);
}

function construirHistorialCanonAuditoria(
  historial: Array<{
    id: string;
    datos: { canon: number | string };
    usuario_nombre: string;
    usuario_email: string | null;
    modificado_en: string;
  }>,
) {
  const cronologico = [...historial].reverse();
  const cambios: Array<{
    id: string;
    valorAnterior: number;
    nuevoValor: number;
    esBaja: boolean;
    usuarioNombre: string;
    usuarioEmail: string | null;
    modificadoEn: string;
  }> = [];

  cronologico.forEach((registro, index) => {
    const nuevoValor = num(registro.datos.canon);
    const anterior = cronologico[index - 1];

    if (!anterior) return;
    const valorAnterior = num(anterior.datos.canon);
    if (valorAnterior === nuevoValor) return;

    cambios.push({
      id: registro.id,
      valorAnterior,
      nuevoValor,
      esBaja: nuevoValor < valorAnterior,
      usuarioNombre: registro.usuario_nombre,
      usuarioEmail: registro.usuario_email,
      modificadoEn: registro.modificado_en,
    });
  });

  return cambios.reverse();
}

function formatearFechaContratoAuditoria(valor: string | undefined) {
  if (!valor) return "No informado";
  const [anio, mes, dia] = valor.split("-");
  if (!anio || !mes || !dia) return valor;
  return [dia, mes, anio].join("/");
}

function DatoInstitucional({ titulo, valor, className = "" }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-border bg-card px-3 py-2 ${className}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor || "No informado"}</p>
    </div>
  );
}

function DocumentoAuditoria({
  titulo,
  documento,
  onOpen,
}: {
  titulo: string;
  documento: { nombreArchivo: string; tamano: number; actualizadoEn: string } | null | undefined;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-sm border border-border bg-secondary/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      {documento ? (
        <>
          <p className="mt-1 break-all text-sm font-medium">{documento.nombreArchivo}</p>
          <p className="mt-1 text-xs text-muted-foreground">Actualizado: {new Date(documento.actualizadoEn).toLocaleString("es-AR")}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={onOpen}>
            <FileText className="mr-2 h-4 w-4" /> Ver PDF
          </Button>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No cargado.</p>
      )}
    </div>
  );
}
