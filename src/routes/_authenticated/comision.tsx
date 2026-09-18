import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCcw, Save, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import {
  abrirActaConstitucion,
  cargarActaConstitucion,
  cargarComisionDirectiva,
  guardarActaConstitucion,
  guardarComisionDirectiva,
  calcularFinMandato,
  diasParaVencimientoMandato,
  type CargoComision,
  type DatosComisionDirectiva,
  type MiembroComision,
} from "@/lib/data/comision";
import {
  cargarHistorialComisionDirectiva,
  registrarModificacionComisionDirectiva,
} from "@/lib/data/comision-historial";
import {
  cargarSolicitudesCambioMandato,
  crearSolicitudCambioMandato,
} from "@/lib/data/comision-mandatos-solicitudes";
import { cargarDatosInstitucionales } from "@/lib/data/datos-institucionales";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/comision")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Comisión directiva | Libro de Cooperadoras" },
      {
        name: "description",
        content: "Datos de los miembros de la comisión directiva y acta de constitución de la cooperadora.",
      },
      { property: "og:title", content: "Comisión directiva de la cooperadora" },
      { property: "og:description", content: "Registro de autoridades y acta de constitución." },
    ],
  }),
  component: ComisionPage,
});

type CampoCargo = {
  cargo: CargoComision;
  etiqueta: string;
};

const CARGOS: CampoCargo[] = [
  { cargo: "presidente", etiqueta: "Presidente" },
  { cargo: "secretario", etiqueta: "Secretario" },
  { cargo: "tesorero", etiqueta: "Tesorero" },
  { cargo: "vocal_1", etiqueta: "Vocal" },
  { cargo: "vocal_2", etiqueta: "Vocal" },
  { cargo: "revisor_cuentas", etiqueta: "Revisor de Cuentas" },
  { cargo: "asesor_director", etiqueta: "Asesor/Director" },
];

function ComisionPage() {
  const { data: ctx, isLoading } = useContexto();
  const qc = useQueryClient();
  const cooperadora = ctx?.cooperadora;
  const [editando, setEditando] = useState(false);
  const [miembros, setMiembros] = useState<Record<CargoComision, { nombre: string; dni: string }>>(() =>
    Object.fromEntries(CARGOS.map(({ cargo }) => [cargo, { nombre: "", dni: "" }])) as Record<
      CargoComision,
      { nombre: string; dni: string }
    >,
  );
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fechaInicioMandato, setFechaInicioMandato] = useState("");
  const [modoNuevaConformacion, setModoNuevaConformacion] = useState(false);
  const [editandoMandato, setEditandoMandato] = useState(false);
  const [periodoSolicitado, setPeriodoSolicitado] = useState("1");
  const [fechaInicioSolicitada, setFechaInicioSolicitada] = useState("");
  const [motivoSolicitud, setMotivoSolicitud] = useState("");

  const comision = useQuery({
    queryKey: ["comision-directiva", cooperadora?.id],
    queryFn: () => cargarComisionDirectiva(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const historialComision = useQuery({
    queryKey: ["historial-comision-directiva", cooperadora?.id],
    queryFn: () => cargarHistorialComisionDirectiva(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const solicitudesMandato = useQuery({
    queryKey: ["solicitudes-mandato", cooperadora?.id],
    queryFn: () => cargarSolicitudesCambioMandato(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const datosInstitucionales = useQuery({
    queryKey: ["datos-institucionales", cooperadora?.id],
    queryFn: () => cargarDatosInstitucionales(cooperadora!),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const acta = useQuery({
    queryKey: ["acta-constitucion", cooperadora?.id],
    queryFn: () => cargarActaConstitucion(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const directorNombre = datosInstitucionales.data?.director_nombre?.trim() ?? "";
  const directorDni = datosInstitucionales.data?.director_dni?.trim() ?? "";

  useEffect(() => {
    setMiembros((actual) => {
      const siguiente = { ...actual };
      for (const miembro of comision.data?.miembros ?? []) {
        siguiente[miembro.cargo] = {
          nombre: miembro.nombre ?? "",
          dni: miembro.dni ?? "",
        };
      }
      if (directorNombre || directorDni) {
        siguiente.asesor_director = {
          ...siguiente.asesor_director,
          nombre: directorNombre,
          dni: directorDni,
        };
      }
      return siguiente;
    });
  }, [comision.data, directorNombre, directorDni]);

  useEffect(() => {
    if (!historialComision.data) return;
    setEditando(historialComision.data.length === 0 || !comision.data?.fechaInicioMandato);
    if (comision.data?.fechaInicioMandato) setFechaInicioMandato(comision.data.fechaInicioMandato);
  }, [historialComision.data, comision.data?.fechaInicioMandato]);

  const solicitarCambioMandato = useMutation({
    mutationFn: async () => {
      if (!cooperadora || !ctx) throw new Error("No se pudo identificar la cooperadora o el usuario.");
      return crearSolicitudCambioMandato(cooperadora.id, {
        id: ctx.userId,
        nombre: ctx.nombre || "Usuario",
        email: ctx.email,
      }, {
        numeroPeriodoSolicitado: Number(periodoSolicitado),
        fechaInicioSolicitada,
        motivo: motivoSolicitud,
      });
    },
    onSuccess: () => {
      setEditandoMandato(false);
      setMotivoSolicitud("");
      qc.invalidateQueries({ queryKey: ["solicitudes-mandato", cooperadora?.id] });
      toast.success("La modificación quedó pendiente de autorización de Auditoría.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      if (!ctx) throw new Error("No se pudo identificar al usuario que realiza la modificación.");

      const datos: MiembroComision[] = CARGOS.map(({ cargo }) => ({
        cargo,
        nombre: cargo === "asesor_director" && directorNombre
          ? directorNombre
          : miembros[cargo].nombre.trim(),
        dni: cargo === "asesor_director"
          ? directorDni
          : miembros[cargo].dni.trim(),
      }));

      const esPrimerMandato =
        !comision.data?.fechaInicioMandato ||
        !comision.data?.fechaFinMandato ||
        !comision.data?.numeroPeriodo;

      if ((esPrimerMandato || modoNuevaConformacion) && !fechaInicioMandato) {
        throw new Error("Debés indicar la fecha de inicio del mandato.");
      }

      if (modoNuevaConformacion) {
        const historialMandatos = (historialComision.data ?? []).filter((registro) => registro.tipo === "mandato");
        const usadosPorDni = new Map<string, number>();
        for (const registro of historialMandatos) {
          for (const miembro of registro.miembros) {
            const dni = miembro.dni.trim();
            if (dni) usadosPorDni.set(dni, (usadosPorDni.get(dni) ?? 0) + 1);
          }
        }
        if (datos.some((miembro) => miembro.dni.trim() && (usadosPorDni.get(miembro.dni.trim()) ?? 0) >= 2)) {
          const bloqueados = datos
            .filter((miembro) => miembro.dni.trim() && (usadosPorDni.get(miembro.dni.trim()) ?? 0) >= 2)
            .map((miembro) => miembro.nombre)
            .join(", ");
          throw new Error(`No se puede registrar la nueva conformación porque ${bloqueados} ya cumplió dos períodos de mandato.`);
        }
        if (datos.some((miembro) => !miembro.dni.trim())) {
          throw new Error("Para registrar una nueva conformación, todos los integrantes deben tener DNI informado.");
        }
      }

      const inicio = esPrimerMandato || modoNuevaConformacion
        ? fechaInicioMandato
        : comision.data!.fechaInicioMandato!;
      const fin = esPrimerMandato || modoNuevaConformacion
        ? calcularFinMandato(inicio)
        : comision.data!.fechaFinMandato!;
      const periodo = esPrimerMandato
        ? 1
        : modoNuevaConformacion
          ? comision.data!.numeroPeriodo + 1
          : comision.data!.numeroPeriodo;

      const guardados = (await guardarComisionDirectiva(cooperadora.id, datos, {
        fechaInicioMandato: inicio,
        fechaFinMandato: fin,
        numeroPeriodo: periodo,
      })) as DatosComisionDirectiva;

      await registrarModificacionComisionDirectiva(
        cooperadora.id,
        guardados.miembros,
        {
          id: ctx.userId,
          nombre: ctx.nombre || "Usuario",
          email: ctx.email,
        },
        {
          tipo: esPrimerMandato || modoNuevaConformacion ? "mandato" : "modificacion",
          fechaInicioMandato: inicio,
          fechaFinMandato: fin,
          numeroPeriodo: periodo,
        },
      );
      return guardados;
    },
    onSuccess: (guardados) => {
      setMiembros((actual) => {
        const siguiente = { ...actual };
        for (const miembro of guardados.miembros) {
          siguiente[miembro.cargo] = {
            nombre: miembro.nombre ?? "",
            dni: miembro.dni ?? "",
          };
        }
        siguiente.asesor_director = {
          ...siguiente.asesor_director,
          nombre: directorNombre,
          dni: directorDni,
        };
        return siguiente;
      });
      setFechaInicioMandato(guardados.fechaInicioMandato ?? fechaInicioMandato);
      setEditando(false);
      setModoNuevaConformacion(false);
      qc.invalidateQueries({ queryKey: ["comision-directiva", cooperadora?.id] });
      qc.invalidateQueries({ queryKey: ["historial-comision-directiva", cooperadora?.id] });
      toast.success("Datos de la comisión directiva guardados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const registrarReeleccion = useMutation({
    mutationFn: async () => {
      if (!cooperadora || !ctx) throw new Error("No se pudo identificar la cooperadora o el usuario.");
      if (!comision.data?.fechaInicioMandato || !comision.data.fechaFinMandato || !comision.data.numeroPeriodo) {
        throw new Error("Primero registrá el mandato actual.");
      }
      if (comision.data.numeroPeriodo >= 2) {
        throw new Error("No se permite una nueva reelección después de cumplir dos períodos.");
      }
      const historialMandatos = (historialComision.data ?? []).filter((registro) => registro.tipo === "mandato");
      const usadosPorDni = new Map<string, number>();
      for (const registro of historialMandatos) {
        for (const miembro of registro.miembros) {
          const dni = miembro.dni.trim();
          if (dni) usadosPorDni.set(dni, (usadosPorDni.get(dni) ?? 0) + 1);
        }
      }

      const bloqueados = comision.data.miembros.filter((miembro) => {
        const dni = miembro.dni.trim();
        return dni && (usadosPorDni.get(dni) ?? 0) >= 2;
      });

      if (bloqueados.length > 0) {
        throw new Error(`No se puede registrar la reelección porque ${bloqueados.map((m) => m.nombre).join(", ")} ya cumplió dos períodos de mandato.`);
      }

      if (comision.data.miembros.some((miembro) => !miembro.dni.trim())) {
        throw new Error("Para registrar una reelección, todos los integrantes deben tener DNI informado.");
      }

      const inicio = comision.data.fechaFinMandato;
      const fin = calcularFinMandato(inicio);
      const periodo = comision.data.numeroPeriodo + 1;
      const guardados = (await guardarComisionDirectiva(cooperadora.id, comision.data.miembros, {
        fechaInicioMandato: inicio,
        fechaFinMandato: fin,
        numeroPeriodo: periodo,
      })) as DatosComisionDirectiva;

      await registrarModificacionComisionDirectiva(
        cooperadora.id,
        guardados.miembros,
        {
          id: ctx.userId,
          nombre: ctx.nombre || "Usuario",
          email: ctx.email,
        },
        {
          tipo: "mandato",
          fechaInicioMandato: inicio,
          fechaFinMandato: fin,
          numeroPeriodo: periodo,
        },
      );
      return guardados;
    },
    onSuccess: (guardados) => {
      setFechaInicioMandato(guardados.fechaInicioMandato ?? "");
      qc.invalidateQueries({ queryKey: ["comision-directiva", cooperadora?.id] });
      qc.invalidateQueries({ queryKey: ["historial-comision-directiva", cooperadora?.id] });
      toast.success("Reelección registrada por un nuevo período de 2 años.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const subirActa = useMutation({
    mutationFn: async () => {
      if (!cooperadora || !archivo) throw new Error("Seleccioná un archivo PDF.");
      if (archivo.size > 3 * 1024 * 1024) throw new Error("El PDF no puede superar los 3 MB.");
      return guardarActaConstitucion(cooperadora.id, archivo);
    },
    onSuccess: () => {
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["acta-constitucion", cooperadora?.id] });
      toast.success("Acta de constitución cargada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell titulo="Comisión directiva">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (ctx?.esAuditor) {
    return (
      <AppShell titulo="Comisión directiva" descripcion="Acceso reservado al área de Cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Esta sección está destinada a la cooperadora para completar sus autoridades y documentación institucional.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!cooperadora) {
    return (
      <AppShell titulo="Comisión directiva" descripcion="Primero registrá la cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Todavía no registraste tu cooperadora. Volvé al panel para completar los datos institucionales.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const diasMandato = diasParaVencimientoMandato(comision.data?.fechaFinMandato ?? null);
  const ultimaModificacion = historialComision.data?.[0];
  const solicitudMandatoPendiente = solicitudesMandato.data?.find((solicitud) => solicitud.estado === "pendiente") ?? null;
  const nombreFicha = (cargo: CargoComision) => miembros[cargo]?.nombre || "No informado";
  const dniFicha = (cargo: CargoComision) => miembros[cargo]?.dni || "";

  return (
    <AppShell
      titulo="Comisión directiva"
      descripcion={`${cooperadora.nombre}${cooperadora.localidad ? ` · ${cooperadora.localidad}` : ""}`}
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <details open={editando} className="self-start rounded-sm border border-border bg-card">
          <summary className={`cursor-pointer list-none hover:bg-secondary/50 ${editando ? "px-4 py-4" : "px-3 py-2"}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Users className={`${editando ? "h-5 w-5" : "h-4 w-4"} shrink-0 text-primary`} />
                <span className={`${editando ? "font-serif text-lg" : "text-sm font-medium"} truncate`}>
                  Comisión Directiva
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {editando ? "Edición" : "Ver información"}
              </span>
            </span>
            {editando && (
              <span className="mt-1 block text-sm text-muted-foreground">
                Completá o actualizá las autoridades de la cooperadora.
              </span>
            )}
          </summary>

          <div className="border-t border-border p-6">
            {editando ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-4 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Mandato de la Comisión Directiva</p>
                      <p className="mt-1 text-xs text-muted-foreground">Los datos vigentes se muestran arriba. Toda modificación requiere autorización de Auditoría.</p>
                    </div>
                    {!modoNuevaConformacion && comision.data?.fechaInicioMandato && !solicitudMandatoPendiente && !editandoMandato && (
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setPeriodoSolicitado(String(comision.data?.numeroPeriodo ?? 1));
                        setFechaInicioSolicitada(comision.data?.fechaInicioMandato ?? "");
                        setMotivoSolicitud("");
                        setEditandoMandato(true);
                      }}>Modificar período y fecha</Button>
                    )}
                  </div>

                  {!comision.data?.fechaInicioMandato || !comision.data?.numeroPeriodo || modoNuevaConformacion ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="fecha-inicio-mandato">Fecha de constitución / inicio</Label>
                        <Input id="fecha-inicio-mandato" type="date" value={fechaInicioMandato} onChange={(e) => setFechaInicioMandato(e.target.value)} required />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <DatoMandato titulo="Período vigente" valor={String(comision.data.numeroPeriodo)} />
                      <DatoMandato titulo="Inicio vigente" valor={formatearFecha(comision.data.fechaInicioMandato)} />
                      <DatoMandato titulo="Vencimiento vigente" valor={formatearFecha(comision.data.fechaFinMandato)} />
                    </div>
                  )}

                  {editandoMandato && !modoNuevaConformacion && comision.data?.fechaInicioMandato && (
                    <div className="rounded-md border border-slate-300 bg-slate-50 p-4 text-slate-700">
                      <p className="font-medium">Propuesta de modificación</p>
                      <div className="mt-3 grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="periodo-solicitado">Período</Label>
                          <Input id="periodo-solicitado" type="number" min={1} max={2} value={periodoSolicitado} onChange={(e) => setPeriodoSolicitado(e.target.value)} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="fecha-inicio-solicitada">Fecha de constitución / inicio</Label>
                          <Input id="fecha-inicio-solicitada" type="date" value={fechaInicioSolicitada} onChange={(e) => setFechaInicioSolicitada(e.target.value)} />
                        </div>
                        <div className="space-y-2 sm:col-span-3">
                          <Label htmlFor="motivo-solicitud">Motivo</Label>
                          <Input id="motivo-solicitud" value={motivoSolicitud} onChange={(e) => setMotivoSolicitud(e.target.value)} placeholder="Ej.: corrección según acta" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs">La modificación quedará en estado pendiente y no reemplazará el mandato vigente hasta su aprobación.</p>
                      <div className="mt-4 flex gap-2">
                        <Button type="button" onClick={() => solicitarCambioMandato.mutate()} disabled={solicitarCambioMandato.isPending}>
                          {solicitarCambioMandato.isPending ? "Enviando…" : "Enviar a Auditoría"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditandoMandato(false)} disabled={solicitarCambioMandato.isPending}>Cancelar</Button>
                      </div>
                    </div>
                  )}

                  {solicitudMandatoPendiente && !editandoMandato && (
                    <div className="rounded-md border border-slate-300 bg-slate-100 p-4 text-slate-600">
                      <p className="font-medium">Modificación pendiente de aprobación</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <DatoMandato titulo="Período solicitado" valor={String(solicitudMandatoPendiente.numero_periodo_solicitado)} />
                        <DatoMandato titulo="Inicio solicitado" valor={formatearFecha(solicitudMandatoPendiente.fecha_inicio_solicitada)} />
                        <DatoMandato titulo="Vencimiento solicitado" valor={formatearFecha(solicitudMandatoPendiente.fecha_fin_solicitada)} />
                      </div>
                      <p className="mt-2 text-xs">Solicitado por ${solicitudMandatoPendiente.usuario_nombre}</p>
                      <p className="mt-1 text-xs">Motivo: ${solicitudMandatoPendiente.motivo}</p>
                    </div>
                  )}
                </div>

                {CARGOS.map(({ cargo, etiqueta }, index) => {
                  const asesor = cargo === "asesor_director";
                  const nombreCampo = asesor ? directorNombre : miembros[cargo].nombre;
                  const dniCampo = asesor ? directorDni : miembros[cargo].dni;
                  return (
                    <div key={cargo} className="space-y-3 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">
                        {etiqueta}{index === 3 || index === 4 ? ` ${index - 2}` : ""}
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor={`cargo-${cargo}-nombre`}>Nombre y apellido</Label>
                        <Input
                          id={`cargo-${cargo}-nombre`}
                          value={nombreCampo}
                          readOnly={asesor}
                          placeholder="Nombre y apellido"
                          onChange={(e) => {
                            if (asesor) return;
                            setMiembros((actual) => ({
                              ...actual,
                              [cargo]: { ...actual[cargo], nombre: e.target.value },
                            }));
                          }}
                        />
                        {asesor && (
                          <p className="text-xs text-muted-foreground">
                            Se completa automáticamente con el Director/a registrado en Datos institucionales.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`cargo-${cargo}-dni`}>DNI</Label>
                        <Input
                          id={`cargo-${cargo}-dni`}
                          value={dniCampo}
                          inputMode="numeric"
                          maxLength={8}
                          readOnly={asesor}
                          placeholder="Número de DNI"
                          onChange={(e) => {
                            if (asesor) return;
                            setMiembros((actual) => ({
                              ...actual,
                              [cargo]: { ...actual[cargo], dni: e.target.value.replace(/\D/g, "").slice(0, 8) },
                            }));
                          }}
                        />
                        {asesor && (
                          <p className="text-xs text-muted-foreground">Se completa automáticamente con el DNI del Director/a.</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-2 sm:col-span-2 pt-2">
                  <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {guardar.isPending ? "Guardando…" : "Guardar comisión directiva"}
                  </Button>
                  {historialComision.data?.length ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setModoNuevaConformacion(false);
                        const actuales = Object.fromEntries(
                          CARGOS.map(({ cargo }) => {
                            const miembro = comision.data?.miembros.find((item) => item.cargo === cargo);
                            return [
                              cargo,
                              cargo === "asesor_director"
                                ? { nombre: directorNombre, dni: directorDni }
                                : { nombre: miembro?.nombre ?? "", dni: miembro?.dni ?? "" },
                            ];
                          }),
                        ) as Record<CargoComision, { nombre: string; dni: string }>;
                        setMiembros(actuales);
                        setFechaInicioMandato(comision.data?.fechaInicioMandato ?? "");
                        setEditando(false);
                      }}
                      disabled={guardar.isPending}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                  <p className="font-medium">Vigencia del mandato</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <DatoMandato titulo="Período" valor={comision.data?.numeroPeriodo ? String(comision.data.numeroPeriodo) : "No informado"} />
                    <DatoMandato titulo="Constitución / inicio" valor={formatearFecha(comision.data?.fechaInicioMandato ?? null)} />
                    <DatoMandato titulo="Vencimiento" valor={formatearFecha(comision.data?.fechaFinMandato ?? null)} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CARGOS.map(({ cargo, etiqueta }, index) => (
                    <FichaComision
                      key={cargo}
                      titulo={`${etiqueta}${index === 3 || index === 4 ? ` ${index - 2}` : ""}`}
                      nombre={nombreFicha(cargo)}
                      dni={dniFicha(cargo)}
                    />
                  ))}
                </div>
                {solicitudMandatoPendiente && (
                  <div className="rounded-md border border-slate-300 bg-slate-100 p-4 text-slate-600">
                    <p className="font-medium">Modificación de mandato pendiente de aprobación</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <DatoMandato titulo="Período solicitado" valor={String(solicitudMandatoPendiente.numero_periodo_solicitado)} />
                      <DatoMandato titulo="Inicio solicitado" valor={formatearFecha(solicitudMandatoPendiente.fecha_inicio_solicitada)} />
                      <DatoMandato titulo="Vencimiento solicitado" valor={formatearFecha(solicitudMandatoPendiente.fecha_fin_solicitada)} />
                    </div>
                    <p className="mt-2 text-xs">Pendiente de autorización de Auditoría.</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    {ultimaModificacion
                      ? `Última modificación: ${ultimaModificacion.usuario_nombre}${ultimaModificacion.usuario_email ? ` · ${ultimaModificacion.usuario_email}` : ""} · ${new Date(ultimaModificacion.modificado_en).toLocaleString("es-AR")}`
                      : "Información registrada"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setEditando(true)}>Modificar información</Button>
                    {comision.data?.numeroPeriodo === 1 && (
                      <Button
                        variant="outline"
                        onClick={() => registrarReeleccion.mutate()}
                        disabled={registrarReeleccion.isPending}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {registrarReeleccion.isPending ? "Registrando…" : "Registrar reelección"}
                      </Button>
                    )}
                    {comision.data?.numeroPeriodo === 2 && diasMandato !== null && diasMandato <= 10 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const iniciales = Object.fromEntries(
                            CARGOS.map(({ cargo }) => [
                              cargo,
                              cargo === "asesor_director"
                                ? { nombre: directorNombre, dni: directorDni }
                                : { nombre: "", dni: "" },
                            ]),
                          ) as Record<CargoComision, { nombre: string; dni: string }>;
                          setMiembros(iniciales);
                          setFechaInicioMandato(comision.data?.fechaFinMandato ?? "");
                          setModoNuevaConformacion(true);
                          setEditando(true);
                        }}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Nueva conformación
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </details>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-primary" /> Acta de constitución
            </CardTitle>
            <CardDescription>
              Subí el acta de constitución de la cooperadora en formato PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-sm border border-dashed border-border p-4">
              <Label htmlFor="acta-pdf">Archivo PDF</Label>
              <Input
                id="acta-pdf"
                className="mt-2"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              <p className="mt-2 text-xs text-muted-foreground">Tamaño máximo: 3 MB.</p>
            </div>

            {archivo && (
              <p className="text-sm">
                Archivo seleccionado: <span className="font-medium">{archivo.name}</span>
              </p>
            )}

            {acta.data && (
              <div className="rounded-sm border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-medium">Acta cargada</p>
                <p className="mt-1 break-all text-muted-foreground">{acta.data.nombreArchivo}</p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => abrirActaConstitucion(cooperadora.id).catch((error: Error) => toast.error(error.message))}
                >
                  <FileText className="mr-2 h-4 w-4" /> Ver PDF
                </Button>
              </div>
            )}

            <Button
              onClick={() => subirActa.mutate()}
              disabled={!archivo || subirActa.isPending}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {subirActa.isPending ? "Subiendo…" : "Subir acta de constitución"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {historialComision.data && historialComision.data.length > 0 && (
        <details className="mt-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones</span>
              <span className="text-xs font-normal text-muted-foreground">
                {historialComision.data.length} registro{historialComision.data.length === 1 ? "" : "s"}
              </span>
            </span>
          </summary>
          <div className="space-y-2 border-t border-border p-4">
            {historialComision.data.map((registro) => (
              <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                <summary className="cursor-pointer list-none text-sm">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">
                      {registro.tipo === "mandato"
                        ? `Período ${registro.numero_periodo} · `
                        : ""}
                      {registro.usuario_nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                  </span>
                </summary>
                {registro.tipo === "mandato" && (
                  <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                    <DatoMandato titulo="Inicio del período" valor={formatearFecha(registro.fecha_inicio_mandato)} />
                    <DatoMandato titulo="Fin del período" valor={formatearFecha(registro.fecha_fin_mandato)} />
                    <DatoMandato titulo="Tipo" valor={registro.numero_periodo === 2 ? "Reelección" : "Primer período"} />
                  </div>
                )}
                <div className="mt-3 grid gap-1 border-t border-border pt-3 text-xs sm:grid-cols-2">
                  {registro.miembros.map((miembro) => (
                    <div key={miembro.cargo} className="rounded-sm bg-secondary/40 px-2 py-1.5">
                      <span className="font-medium">{CARGOS.find((item) => item.cargo === miembro.cargo)?.etiqueta ?? miembro.cargo}:</span>{" "}
                      {miembro.nombre}{miembro.dni ? ` · DNI ${miembro.dni}` : ""}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
    </AppShell>
  );
}

function formatearFecha(fecha: string | null) {
  if (!fecha) return "No informada";
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR");
}

function DatoMandato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor}</p>
    </div>
  );
}

function FichaComision({ titulo, nombre, dni }: { titulo: string; nombre: string; dni: string }) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{nombre || "No informado"}</p>
      {dni && <p className="mt-1 text-xs text-muted-foreground">DNI {dni}</p>}
    </div>
  );
}
