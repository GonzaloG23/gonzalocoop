import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Save, Store, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import {
  abrirDocumentoConcesion,
  limpiarDatosPruebaConcesion,
  cargarConcesionKiosco,
  cargarDocumentoConcesion,
  calcularVencimientoConcesion,
  calcularCanonConPorcentaje,
  concesionKioscoEstaVencida,
  fechaVencimientoVigenteConcesion,
  guardarConcesionKiosco,
  guardarDocumentoConcesion,
  type ConcesionKiosco,
  type TipoDocumentoConcesion,
} from "@/lib/data/concesion";
import {
  cargarSolicitudesReconsideracionCanon,
  crearSolicitudReconsideracionCanon,
  type TipoCanonReconsideracion,
} from "@/lib/data/concesion-solicitudes-canon";
import {
  cargarSolicitudesModificacionConcesion,
  crearSolicitudModificacionConcesion,
} from "@/lib/data/concesion-solicitudes-modificacion";
import {
  cargarHistorialConcesionKiosco,
  cargarHistorialDocumentosConcesion,
  registrarModificacionConcesionKiosco,
  registrarModificacionDocumentoConcesion,
} from "@/lib/data/concesion-historial";
import { money, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/concesion")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Concesión de kioscos y cantinas | Libro de Cooperadoras" },
      {
        name: "description",
        content: "Registro del concesionario, canon y documentación de la concesión de kioscos y cantinas.",
      },
      { property: "og:title", content: "Concesión de kioscos y cantinas" },
      { property: "og:description", content: "Registro del concesionario, canon y documentación respaldatoria." },
    ],
  }),
  component: ConcesionPage,
});

type DocumentoInfo = {
  tipo: TipoDocumentoConcesion;
  titulo: string;
  descripcion: string;
};

const DOCUMENTOS: DocumentoInfo[] = [
  {
    tipo: "contrato",
    titulo: "Contrato de concesión",
    descripcion: "Contrato firmado de concesión del kiosco o cantina.",
  },
  {
    tipo: "contrato_sellado",
    titulo: "Sellado de contrato",
    descripcion: "Constancia o ejemplar del contrato con el sellado correspondiente.",
  },
  {
    tipo: "buena_conducta",
    titulo: "Certificado de buena conducta",
    descripcion: "Certificado correspondiente al concesionario registrado.",
  },
];

function ConcesionPage() {
  const { data: ctx, isLoading } = useContexto();
  const qc = useQueryClient();
  const cooperadora = ctx?.cooperadora;
  const [editando, setEditando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState<"alta" | "rectificacion" | "ipc">("alta");
  const [motivoModificacion, setMotivoModificacion] = useState("");
  const [fechaInicioProrrogaFicha, setFechaInicioProrrogaFicha] = useState("");
  const [datos, setDatos] = useState<ConcesionKiosco>({
    apellido: "",
    nombre: "",
    canon: "",
    canonVigente: "",
    canonProrroga: "",
    canonProrrogaVigente: "",
    fechaFirmaContrato: "",
    fechaVencimientoContrato: "",
    tieneProrroga: false,
    fechaInicioProrroga: "",
    fechaVencimientoProrroga: "",
  });
  const [porcentajeIpcContrato, setPorcentajeIpcContrato] = useState("");
  const [porcentajeIpcProrroga, setPorcentajeIpcProrroga] = useState("");
  const [tipoCanonReconsideracion, setTipoCanonReconsideracion] = useState<TipoCanonReconsideracion>("contrato");
  const [canonSolicitadoReconsideracion, setCanonSolicitadoReconsideracion] = useState("");
  const [motivoReconsideracion, setMotivoReconsideracion] = useState("");
  useEffect(() => {
    if (!cooperadora || ctx?.esAuditor) return;

    const claveReset = `demo-concesion-reset-20260921-2-${cooperadora.id}`;
    if (localStorage.getItem(claveReset)) return;

    void limpiarDatosPruebaConcesion(cooperadora.id).then(() => {
      localStorage.setItem(claveReset, "1");
      setDatos({
        apellido: "",
        nombre: "",
        canon: "",
        canonVigente: "",
        canonProrroga: "",
        canonProrrogaVigente: "",
        fechaFirmaContrato: "",
        fechaVencimientoContrato: "",
        tieneProrroga: false,
        fechaInicioProrroga: "",
        fechaVencimientoProrroga: "",
      });
      setEditando(true);
      void qc.invalidateQueries({ queryKey: ["concesion-kiosco", cooperadora.id] });
      void qc.invalidateQueries({ queryKey: ["historial-concesion-kiosco", cooperadora.id] });
      void qc.invalidateQueries({ queryKey: ["historial-documentos-concesion", cooperadora.id] });
      void qc.invalidateQueries({ queryKey: ["solicitudes-reconsideracion-canon", cooperadora.id] });
      void qc.invalidateQueries({ queryKey: ["solicitudes-modificacion-concesion", cooperadora.id] });
      void qc.invalidateQueries({ queryKey: ["documento-concesion", cooperadora.id] });
    });
  }, [cooperadora, ctx?.esAuditor, qc]);

  const [archivos, setArchivos] = useState<Record<TipoDocumentoConcesion, File | null>>({
    contrato: null,
    contrato_sellado: null,
    buena_conducta: null,
  });

  const concesion = useQuery({
    queryKey: ["concesion-kiosco", cooperadora?.id],
    queryFn: () => cargarConcesionKiosco(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const historial = useQuery({
    queryKey: ["historial-concesion-kiosco", cooperadora?.id],
    queryFn: () => cargarHistorialConcesionKiosco(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const historialDocumentos = useQuery({
    queryKey: ["historial-documentos-concesion", cooperadora?.id],
    queryFn: () => cargarHistorialDocumentosConcesion(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const solicitudesCanon = useQuery({
    queryKey: ["solicitudes-reconsideracion-canon", cooperadora?.id],
    queryFn: () => cargarSolicitudesReconsideracionCanon(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const solicitudesModificacion = useQuery({
    queryKey: ["solicitudes-modificacion-concesion", cooperadora?.id],
    queryFn: () => cargarSolicitudesModificacionConcesion(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const contrato = useQuery({
    queryKey: ["documento-concesion", cooperadora?.id, "contrato"],
    queryFn: () => cargarDocumentoConcesion(cooperadora!.id, "contrato"),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const contratoSellado = useQuery({
    queryKey: ["documento-concesion", cooperadora?.id, "contrato_sellado"],
    queryFn: () => cargarDocumentoConcesion(cooperadora!.id, "contrato_sellado"),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const buenaConducta = useQuery({
    queryKey: ["documento-concesion", cooperadora?.id, "buena_conducta"],
    queryFn: () => cargarDocumentoConcesion(cooperadora!.id, "buena_conducta"),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  useEffect(() => {
    if (concesion.data) {
      setDatos({
        apellido: concesion.data.apellido ?? "",
        nombre: concesion.data.nombre ?? "",
        canon: String(concesion.data.canon ?? ""),
        canonVigente: String(concesion.data.canonVigente ?? concesion.data.canon ?? ""),
        canonProrroga: String(concesion.data.canonProrroga ?? ""),
        canonProrrogaVigente: String(concesion.data.canonProrrogaVigente ?? concesion.data.canonProrroga ?? ""),
        fechaFirmaContrato: concesion.data.fechaFirmaContrato ?? "",
        fechaVencimientoContrato:
          concesion.data.fechaVencimientoContrato ||
          calcularVencimientoConcesion(concesion.data.fechaFirmaContrato ?? "", 2),
        tieneProrroga: Boolean(concesion.data.tieneProrroga),
        fechaInicioProrroga: concesion.data.fechaInicioProrroga ?? "",
        fechaVencimientoProrroga:
          concesion.data.fechaVencimientoProrroga ||
          (concesion.data.tieneProrroga
            ? calcularVencimientoConcesion(concesion.data.fechaInicioProrroga ?? "", 1)
            : ""),
      });
      setFechaInicioProrrogaFicha(concesion.data.tieneProrroga ? concesion.data.fechaInicioProrroga ?? "" : "");
    }
    if (!historial.data?.length) {
      setEditando(true);
      setModoEdicion("alta");
    }
  }, [concesion.data, historial.data]);

  const solicitarReconsideracion = useMutation({
    mutationFn: async () => {
      if (!cooperadora || !ctx) throw new Error("No se pudo identificar la cooperadora o el usuario.");
      const canonSolicitado = Number(String(canonSolicitadoReconsideracion).replace(",", "."));
      return crearSolicitudReconsideracionCanon(
        cooperadora.id,
        {
          id: ctx.userId,
          nombre: ctx.nombre || "Usuario",
          email: ctx.email,
        },
        {
          tipoCanon: tipoCanonReconsideracion,
          canonSolicitado,
          motivo: motivoReconsideracion,
        },
      );
    },
    onSuccess: () => {
      setCanonSolicitadoReconsideracion("");
      setMotivoReconsideracion("");
      qc.invalidateQueries({ queryKey: ["solicitudes-reconsideracion-canon", cooperadora?.id] });
      toast.success("El pedido de reconsideración quedó pendiente de autorización de Auditoría.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const solicitarModificacion = useMutation({
    mutationFn: async () => {
      if (!cooperadora || !ctx) throw new Error("No se pudo identificar la cooperadora o el usuario.");

      const fechaVencimientoContrato = calcularVencimientoConcesion(datos.fechaFirmaContrato, 2);
      const fechaVencimientoProrroga = datos.tieneProrroga
        ? calcularVencimientoConcesion(datos.fechaInicioProrroga, 1)
        : "";

      const datosSolicitados: ConcesionKiosco = {
        ...datos,
        canon: Number(String(datos.canon).replace(",", ".")),
        canonVigente: Number(String(datos.canonVigente).replace(",", ".")),
        canonProrroga: datos.tieneProrroga
          ? Number(String(datos.canonProrroga).replace(",", "."))
          : "",
        canonProrrogaVigente: datos.tieneProrroga
          ? Number(String(datos.canonProrrogaVigente).replace(",", "."))
          : "",
        fechaVencimientoContrato,
        fechaVencimientoProrroga,
      };

      return crearSolicitudModificacionConcesion(
        cooperadora.id,
        {
          id: ctx.userId,
          nombre: ctx.nombre || "Usuario",
          email: ctx.email,
        },
        datosSolicitados,
        motivoModificacion,
      );
    },
    onSuccess: () => {
      setMotivoModificacion("");
      if (concesion.data) {
        setDatos({
          apellido: concesion.data.apellido ?? "",
          nombre: concesion.data.nombre ?? "",
          canon: String(concesion.data.canon ?? ""),
          canonVigente: String(concesion.data.canonVigente ?? concesion.data.canon ?? ""),
          canonProrroga: String(concesion.data.canonProrroga ?? ""),
          canonProrrogaVigente: String(
            concesion.data.canonProrrogaVigente ?? concesion.data.canonProrroga ?? "",
          ),
          fechaFirmaContrato: concesion.data.fechaFirmaContrato ?? "",
          fechaVencimientoContrato:
            concesion.data.fechaVencimientoContrato ||
            calcularVencimientoConcesion(concesion.data.fechaFirmaContrato ?? "", 2),
          tieneProrroga: Boolean(concesion.data.tieneProrroga),
          fechaInicioProrroga: concesion.data.fechaInicioProrroga ?? "",
          fechaVencimientoProrroga:
            concesion.data.fechaVencimientoProrroga ||
            (concesion.data.tieneProrroga
              ? calcularVencimientoConcesion(concesion.data.fechaInicioProrroga ?? "", 1)
              : ""),
        });
      }
      setEditando(false);
      setModoEdicion("rectificacion");
      qc.invalidateQueries({ queryKey: ["solicitudes-modificacion-concesion", cooperadora?.id] });
      qc.invalidateQueries({ queryKey: ["panel-auditor"] });
      toast.success("La modificación quedó pendiente de autorización de Auditoría.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      if (!ctx) throw new Error("No se pudo identificar al usuario que realiza la modificación.");
      const guardados = await guardarConcesionKiosco(cooperadora.id, datos);
      await registrarModificacionConcesionKiosco(cooperadora.id, guardados, {
        id: ctx.userId,
        nombre: ctx.nombre || "Usuario",
        email: ctx.email,
      });
      return guardados;
    },
    onSuccess: (guardados) => {
      setDatos({
        ...guardados,
        canon: String(guardados.canon),
        canonVigente: String(guardados.canonVigente ?? guardados.canon),
        canonProrroga: String(guardados.canonProrroga ?? ""),
        canonProrrogaVigente: String(guardados.canonProrrogaVigente ?? guardados.canonProrroga ?? ""),
      });
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["concesion-kiosco", cooperadora?.id] });
      qc.invalidateQueries({ queryKey: ["historial-concesion-kiosco", cooperadora?.id] });

      toast.success("Datos de la concesión guardados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activarProrroga = useMutation({
    mutationFn: async () => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      if (!ctx) throw new Error("No se pudo identificar al usuario que realiza la activación.");
      if (!concesion.data) throw new Error("Primero debe estar registrada la concesión.");
      if (concesion.data.tieneProrroga) throw new Error("La concesión ya tiene una prórroga activa.");
      if (!fechaInicioProrrogaFicha) throw new Error("Debés completar la fecha de inicio de la prórroga.");

      const prorroga = await guardarConcesionKiosco(cooperadora.id, {
        ...concesion.data,
        tieneProrroga: true,
        fechaInicioProrroga: fechaInicioProrrogaFicha,
        fechaVencimientoProrroga: calcularVencimientoConcesion(fechaInicioProrrogaFicha, 1),
        canonProrroga: concesion.data.canonVigente || concesion.data.canon,
        canonProrrogaVigente: concesion.data.canonVigente || concesion.data.canon,
      });

      await registrarModificacionConcesionKiosco(cooperadora.id, prorroga, {
        id: ctx.userId,
        nombre: ctx.nombre || "Usuario",
        email: ctx.email,
      });

      return prorroga;
    },
    onSuccess: (prorroga) => {
      setDatos({
        ...prorroga,
        canon: String(prorroga.canon),
        canonVigente: String(prorroga.canonVigente ?? prorroga.canon),
        canonProrroga: String(prorroga.canonProrroga ?? ""),
        canonProrrogaVigente: String(prorroga.canonProrrogaVigente ?? prorroga.canonProrroga ?? ""),
      });
      setFechaInicioProrrogaFicha(prorroga.fechaInicioProrroga);
      qc.invalidateQueries({ queryKey: ["concesion-kiosco", cooperadora?.id] });
      qc.invalidateQueries({ queryKey: ["historial-concesion-kiosco", cooperadora?.id] });
      toast.success("La prórroga fue activada y quedó registrada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const subirDocumento = useMutation({
    mutationFn: async ({ tipo }: { tipo: TipoDocumentoConcesion }) => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      if (!ctx) throw new Error("No se pudo identificar al usuario que realiza la modificación.");
      const archivo = archivos[tipo];
      if (!archivo) throw new Error("Seleccioná un archivo PDF.");

      const documentoExistente =
        tipo === "contrato"
          ? contrato.data
          : tipo === "contrato_sellado"
            ? contratoSellado.data
            : buenaConducta.data;

      const documento = await guardarDocumentoConcesion(cooperadora.id, tipo, archivo);
      await registrarModificacionDocumentoConcesion(cooperadora.id, {
        tipo,
        nombreArchivo: documento.nombreArchivo,
        accion: documentoExistente ? "reemplazo" : "carga",
        usuario_id: ctx.userId,
        usuario_nombre: ctx.nombre || "Usuario",
        usuario_email: ctx.email,
      });

      return { documento, reemplazo: Boolean(documentoExistente) };
    },
    onSuccess: (resultado, variables) => {
      setArchivos((actual) => ({ ...actual, [variables.tipo]: null }));
      qc.invalidateQueries({ queryKey: ["documento-concesion", cooperadora?.id, variables.tipo] });
      qc.invalidateQueries({ queryKey: ["historial-documentos-concesion", cooperadora?.id] });
      const titulo = DOCUMENTOS.find((documento) => documento.tipo === variables.tipo)?.titulo ?? "Documento";
      toast.success(`${titulo} ${resultado.reemplazo ? "modificado" : "cargado"}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell titulo="Concesión de kioscos y cantinas">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (ctx?.esAuditor) {
    return (
      <AppShell titulo="Concesión de kioscos y cantinas" descripcion="Acceso reservado al área de Cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Esta sección está destinada a la cooperadora para completar los datos del concesionario y la documentación respaldatoria.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!cooperadora) {
    return (
      <AppShell titulo="Concesión de kioscos y cantinas" descripcion="Primero registrá la cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Todavía no registraste tu cooperadora. Volvé al panel para completar los datos institucionales.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const ultimaModificacion = historial.data?.[0];
  const cambiosCanon = construirHistorialCanon(historial.data ?? []);
  const actualizacionesCanon = construirActualizacionesCanon(historial.data ?? [], "contrato");
  const vencimientoContrato = calcularVencimientoConcesion(datos.fechaFirmaContrato, 2);
  const vencimientoProrroga = datos.tieneProrroga
    ? calcularVencimientoConcesion(datos.fechaInicioProrroga, 1)
    : "";
  const aniversarioContrato = calcularProximaActualizacionCanonSimple(datos.fechaFirmaContrato);
  const contratoAniversarioVencido = canonNecesitaActualizacionSimple(aniversarioContrato);
  const contratoActualizado = canonVigenteFueActualizadoDesde(
    historial.data ?? [],
    "contrato",
    aniversarioContrato,
  );
  const contratoPendienteIPC = contratoAniversarioVencido && !contratoActualizado;
  const proximaActualizacionContrato =
    contratoAniversarioVencido && contratoActualizado
      ? calcularSiguienteAniversarioCanon(datos.fechaFirmaContrato)
      : aniversarioContrato;

  const aniversarioProrroga = datos.tieneProrroga
    ? calcularProximaActualizacionCanonSimple(datos.fechaInicioProrroga)
    : "";
  const prorrogaAniversarioVencido =
    datos.tieneProrroga && canonNecesitaActualizacionSimple(aniversarioProrroga);
  const prorrogaActualizada = datos.tieneProrroga
    ? canonVigenteFueActualizadoDesde(historial.data ?? [], "prorroga", aniversarioProrroga)
    : false;
  const prorrogaPendienteIPC = prorrogaAniversarioVencido && !prorrogaActualizada;
  const proximaActualizacionProrroga =
    datos.tieneProrroga && prorrogaAniversarioVencido && prorrogaActualizada
      ? calcularSiguienteAniversarioCanon(datos.fechaInicioProrroga)
      : aniversarioProrroga;
  const actualizacionIPCpendiente = contratoPendienteIPC || prorrogaPendienteIPC;
  const segundaActualizacionContratoDisponible = actualizacionesCanon.length === 1;
  const contratoVencido = concesionKioscoEstaVencida(datos);
  const fechaVencimientoVigente = fechaVencimientoVigenteConcesion(datos);
  const solicitudModificacionPendiente = [...(solicitudesModificacion.data ?? [])]
    .filter((solicitud) => solicitud.estado === "pendiente")
    .sort((a, b) => new Date(b.solicitada_en).getTime() - new Date(a.solicitada_en).getTime())[0];
  const solicitudModificacionRechazada = [...(solicitudesModificacion.data ?? [])]
    .filter((solicitud) => solicitud.estado === "rechazada")
    .sort(
      (a, b) =>
        new Date(b.resuelta_en ?? b.solicitada_en).getTime() -
        new Date(a.resuelta_en ?? a.solicitada_en).getTime(),
    )[0];

  return (
    <AppShell
      titulo="Concesión de kioscos y cantinas"
      descripcion={`${cooperadora.nombre}${cooperadora.localidad ? ` · ${cooperadora.localidad}` : ""}`}
    >
      {contratoVencido ? (
        <Card className="mb-6 border-2 border-red-500 bg-red-50 text-red-900 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Contrato de concesión vencido
            </CardTitle>
            <CardDescription className="text-red-800/80">
              La concesión ya no tiene un contrato o prórroga vigente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              La vigencia finalizó el{" "}
              <span className="font-semibold">{formatearFechaContrato(fechaVencimientoVigente)}</span>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <details open={editando} className="self-start rounded-sm border border-border bg-card">
          <summary className={`cursor-pointer list-none hover:bg-secondary/50 ${editando ? "px-4 py-4" : "px-3 py-2"}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Store className={`${editando ? "h-5 w-5" : "h-4 w-4"} shrink-0 text-primary`} />
                <span className={`${editando ? "font-serif text-lg" : "text-sm font-medium"} truncate`}>
                  Datos del concesionario
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{editando ? "Edición" : "Ver información"}</span>
            </span>
            {editando && (
              <span className="mt-1 block text-sm text-muted-foreground">
                Completá o actualizá los datos del concesionario y el canon.
              </span>
            )}
          </summary>

          <div className="border-t border-border p-6">
            {editando ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {modoEdicion === "rectificacion" ? (
                  <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-4 text-amber-900 sm:col-span-2">
                    <p className="font-semibold">Rectificación de datos de concesión</p>
                    <p className="mt-1 text-sm">
                      Esta corrección no se aplicará directamente. Se enviará a Auditoría para su autorización porque los datos de la concesión ya fueron registrados.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="concesion-apellido">Apellido *</Label>
                  <Input
                    id="concesion-apellido"
                    value={datos.apellido}
                    onChange={(e) => setDatos((actual) => ({ ...actual, apellido: e.target.value }))}
                    placeholder="Apellido"
                    disabled={modoEdicion === "ipc"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concesion-nombre">Nombre *</Label>
                  <Input
                    id="concesion-nombre"
                    value={datos.nombre}
                    onChange={(e) => setDatos((actual) => ({ ...actual, nombre: e.target.value }))}
                    placeholder="Nombre"
                    disabled={modoEdicion === "ipc"}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="concesion-fecha-firma">Fecha de firma del contrato *</Label>
                  <Input
                    id="concesion-fecha-firma"
                    type="date"
                    value={datos.fechaFirmaContrato}
                    disabled={modoEdicion === "ipc"}
                    onChange={(e) =>
                      setDatos((actual) => ({ ...actual, fechaFirmaContrato: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="rounded-sm border border-border bg-secondary/40 p-4 sm:col-span-2">
                  <p className="text-sm font-medium">Vigencia del contrato inicial</p>
                  <p className="mt-1 text-xs text-muted-foreground">La vigencia se calcula automáticamente por 2 años desde la fecha de firma.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <DatoConcesion titulo="Duración" valor="2 años" />
                    <DatoConcesion
                      titulo="Vigente hasta"
                      valor={formatearFechaContrato(vencimientoContrato)}
                    />
                  </div>
                </div>
                {!datos.tieneProrroga ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="concesion-canon">Canon inicial *</Label>
                      <Input
                        id="concesion-canon"
                        inputMode="decimal"
                        value={datos.canon}
                        disabled={modoEdicion === "ipc"}
                        onChange={(e) => setDatos((actual) => ({ ...actual, canon: e.target.value, canonVigente: actual.canonVigente || e.target.value }))}
                        placeholder="Importe inicial del canon"
                        required
                      />
                      <p className="text-xs text-muted-foreground">Este es el importe que surge del contrato y se conserva como antecedente.</p>
                    </div>
                    {modoEdicion === "rectificacion" ? (
                      <div className="space-y-2">
                        <Label htmlFor="concesion-canon-vigente">Canon vigente</Label>
                        <Input
                          id="concesion-canon-vigente"
                          inputMode="decimal"
                          value={datos.canonVigente}
                          readOnly
                          onChange={(e) => setDatos((actual) => ({ ...actual, canonVigente: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Este valor puede corregirse mediante una solicitud de rectificación que debe autorizar Auditoría.
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="concesion-canon-original">Canon inicial del contrato *</Label>
                      <Input
                        id="concesion-canon-original"
                        inputMode="decimal"
                        value={datos.canon}
                        disabled={modoEdicion === "ipc"}
                        readOnly={modoEdicion === "ipc"}
                        onChange={(e) => setDatos((actual) => ({ ...actual, canon: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Este valor queda asentado y no se reemplaza por las actualizaciones IPC.</p>
                    </div>
                    {modoEdicion === "rectificacion" ? (
                      <div className="space-y-2">
                        <Label htmlFor="concesion-canon-vigente-principal">Canon vigente del contrato</Label>
                        <Input
                          id="concesion-canon-vigente-principal"
                          inputMode="decimal"
                          value={datos.canonVigente}
                          onChange={(e) => setDatos((actual) => ({ ...actual, canonVigente: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Este valor puede corregirse mediante una solicitud de rectificación que debe autorizar Auditoría.
                        </p>
                      </div>
                    ) : null}
                  </>
                )}
                {modoEdicion === "ipc" && (contratoPendienteIPC || prorrogaPendienteIPC || segundaActualizacionContratoDisponible) && (
                  <div className="rounded-sm border border-primary/20 bg-primary/5 p-4 sm:col-span-2">
                    <p className="text-sm font-medium">Actualización anual por IPC</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ingresá el porcentaje de aumento informado por INDEC. El sistema calculará el nuevo canon vigente.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {(contratoPendienteIPC || segundaActualizacionContratoDisponible) ? (
                        <div className="space-y-2">
                          <Label htmlFor="concesion-porcentaje-ipc">
                            {segundaActualizacionContratoDisponible && !contratoPendienteIPC
                              ? "Aumento IPC 2.º año del contrato (%)"
                              : "Aumento IPC ANUAL del contrato (%)"}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="concesion-porcentaje-ipc"
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={porcentajeIpcContrato}
                              onChange={(e) => setPorcentajeIpcContrato(e.target.value)}
                              placeholder="Ej. 25,50"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const porcentaje = Number(String(porcentajeIpcContrato).replace(",", "."));
                                if (!Number.isFinite(porcentaje) || porcentaje < 0) {
                                  toast.error("Ingresá un porcentaje de aumento válido.");
                                  return;
                                }
                                try {
                                  const nuevoCanon = calcularCanonConPorcentaje(Number(datos.canonVigente || datos.canon), porcentaje);
                                  setDatos((actual) => ({ ...actual, canonVigente: String(nuevoCanon) }));
                                  toast.success("Canon vigente calculado.");
                                } catch (error) {
                                  toast.error((error as Error).message);
                                }
                              }}
                            >
                              Calcular
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Canon vigente actual: {money(num(datos.canonVigente || datos.canon))}
                          </p>
                        </div>
                      ) : null}
                      {prorrogaPendienteIPC ? (
                        <div className="space-y-2">
                          <Label htmlFor="concesion-porcentaje-ipc-prorroga">Aumento IPC de la prórroga (%)</Label>
                          <div className="flex gap-2">
                            <Input
                              id="concesion-porcentaje-ipc-prorroga"
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={porcentajeIpcProrroga}
                              onChange={(e) => setPorcentajeIpcProrroga(e.target.value)}
                              placeholder="Ej. 25,50"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const porcentaje = Number(String(porcentajeIpcProrroga).replace(",", "."));
                                if (!Number.isFinite(porcentaje) || porcentaje < 0) {
                                  toast.error("Ingresá un porcentaje de aumento válido.");
                                  return;
                                }
                                try {
                                  const nuevoCanon = calcularCanonConPorcentaje(Number(datos.canonProrrogaVigente || datos.canonProrroga), porcentaje);
                                  setDatos((actual) => ({ ...actual, canonProrrogaVigente: String(nuevoCanon) }));
                                  toast.success("Canon vigente de la prórroga calculado.");
                                } catch (error) {
                                  toast.error((error as Error).message);
                                }
                              }}
                            >
                              Calcular
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Canon vigente actual: {money(num(datos.canonProrrogaVigente || datos.canonProrroga))}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {modoEdicion === "rectificacion" ? (
                  <div className="space-y-3 sm:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="motivo-modificacion-concesion">Motivo de la corrección *</Label>
                      <Input
                        id="motivo-modificacion-concesion"
                        value={motivoModificacion}
                        onChange={(e) => setMotivoModificacion(e.target.value)}
                        placeholder="Ej.: se ingresó incorrectamente la fecha de firma y el canon inicial."
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Auditoría deberá autorizar la corrección antes de que los datos vigentes sean reemplazados.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-2 sm:col-span-2">
                  <Button
                    onClick={() => modoEdicion === "rectificacion" ? solicitarModificacion.mutate() : guardar.mutate()}
                    disabled={guardar.isPending || solicitarModificacion.isPending}
                  >
                    {modoEdicion === "rectificacion" ? (
                      solicitarModificacion.isPending ? "Enviando…" : "Enviar modificación a Auditoría"
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {guardar.isPending ? "Guardando…" : "Guardar concesión"}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (concesion.data) {
                        setDatos({
                          apellido: concesion.data.apellido ?? "",
                          nombre: concesion.data.nombre ?? "",
                          canon: String(concesion.data.canon ?? ""),
                          canonVigente: String(concesion.data.canonVigente ?? concesion.data.canon ?? ""),
                          canonProrroga: String(concesion.data.canonProrroga ?? ""),
                          canonProrrogaVigente: String(
                            concesion.data.canonProrrogaVigente ?? concesion.data.canonProrroga ?? "",
                          ),
                          fechaFirmaContrato: concesion.data.fechaFirmaContrato ?? "",
                          fechaVencimientoContrato:
                            concesion.data.fechaVencimientoContrato ||
                            calcularVencimientoConcesion(concesion.data.fechaFirmaContrato ?? "", 2),
                          tieneProrroga: Boolean(concesion.data.tieneProrroga),
                          fechaInicioProrroga: concesion.data.fechaInicioProrroga ?? "",
                          fechaVencimientoProrroga:
                            concesion.data.fechaVencimientoProrroga ||
                            (concesion.data.tieneProrroga
                              ? calcularVencimientoConcesion(concesion.data.fechaInicioProrroga ?? "", 1)
                              : ""),
                        });
                      }
                      setEditando(false);
                    }}
                    disabled={guardar.isPending || solicitarModificacion.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {actualizacionIPCpendiente ? (
                    <div className="rounded-sm border-2 border-red-500/40 bg-red-500/5 p-4 sm:col-span-2">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">Actualización anual del canon por IPC pendiente</p>
                          <p className="mt-1 text-xs text-red-700/80">
                            La actualización corresponde al cumplirse el aniversario indicado. El canon vigente se actualiza con el IPC oficial.
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-red-700/80">
                            <div className="flex flex-wrap gap-x-5 gap-y-1">
                              {contratoPendienteIPC ? <span>Contrato: desde {formatearFechaContrato(proximaActualizacionContrato)}</span> : null}
                              {prorrogaPendienteIPC ? <span>Prórroga: desde {formatearFechaContrato(proximaActualizacionProrroga)}</span> : null}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setModoEdicion("ipc");
                                setEditando(true);
                              }}
                              className="border-red-500/40 bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              Actualizar canon
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {solicitudModificacionPendiente ? (
                    <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm sm:col-span-2">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                        <div>
                          <p className="font-semibold">Modificación de datos pendiente de aprobación</p>
                          <p className="mt-1 text-sm">
                            La corrección fue enviada a Auditoría y los datos actuales continúan vigentes hasta su resolución.
                          </p>
                          <p className="mt-2 text-xs text-red-700">
                            Solicitado por {solicitudModificacionPendiente.usuario_nombre} · {new Date(solicitudModificacionPendiente.solicitada_en).toLocaleString("es-AR")}
                          </p>
                          <p className="mt-1 text-xs text-red-700">
                            Motivo: {solicitudModificacionPendiente.motivo}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {solicitudModificacionRechazada ? (
                    <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm sm:col-span-2">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                        <div className="min-w-0">
                          <p className="font-semibold">Solicitud de modificación de concesión rechazada</p>
                          <p className="mt-1 text-sm">Auditoría rechazó la corrección solicitada. Los datos vigentes no fueron modificados.</p>
                          {solicitudModificacionRechazada.comentario_resolucion ? (
                            <p className="mt-2 text-sm">
                              <span className="font-medium">Observación de Auditoría:</span>{" "}
                              {solicitudModificacionRechazada.comentario_resolucion}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-red-700">
                            Resuelto por {solicitudModificacionRechazada.resuelta_por_nombre || "Auditoría"} ·{" "}
                            {new Date(solicitudModificacionRechazada.resuelta_en ?? solicitudModificacionRechazada.solicitada_en).toLocaleString("es-AR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <DatoConcesion titulo="Apellido" valor={datos.apellido} />
                  <DatoConcesion titulo="Nombre" valor={datos.nombre} />
                  <DatoConcesion
                    titulo="Fecha de firma del contrato"
                    valor={formatearFechaContrato(datos.fechaFirmaContrato)}
                  />
                  <DatoConcesion
                    titulo="Contrato vigente hasta"
                    valor={formatearFechaContrato(datos.fechaVencimientoContrato || vencimientoContrato)}
                  />
                  {datos.tieneProrroga ? (
                    <>
                      <DatoConcesion
                        titulo="Inicio de la prórroga"
                        valor={formatearFechaContrato(datos.fechaInicioProrroga)}
                      />
                      <DatoConcesion
                        titulo="Prórroga vigente hasta"
                        valor={formatearFechaContrato(datos.fechaVencimientoProrroga || vencimientoProrroga)}
                      />
                    </>
                  ) : null}
                  <DatoConcesion
                    titulo={datos.tieneProrroga ? "Canon inicial del contrato" : "Canon inicial"}
                    valor={money(num(datos.canon))}
                  />
                  <DatoConcesion
                    titulo="1.º canon actualizado"
                    valor={actualizacionesCanon[0] ? money(actualizacionesCanon[0].valor) : "No actualizado todavía"}
                  />
                  <div className="rounded-sm border border-border bg-card px-3 py-3">
                    <p className="text-xs text-muted-foreground">2.º canon actualizado</p>
                    <p className="mt-1 text-sm font-medium">
                      {actualizacionesCanon[1] ? money(actualizacionesCanon[1].valor) : "No actualizado todavía"}
                    </p>
                    {segundaActualizacionContratoDisponible ? (
                      <div className="mt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setModoEdicion("ipc");
                            setEditando(true);
                          }}
                          className="border-red-500/40 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          Realizar actualización de 2.º año
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Ingresá el porcentaje de IPC correspondiente al segundo aniversario del contrato.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <DatoConcesion
                    titulo="Canon vigente"
                    valor={money(num(datos.canonVigente))}
                  />
                  <DatoConcesion
                    titulo="Próxima actualización por IPC"
                    valor={formatearFechaContrato(proximaActualizacionContrato)}
                  />
                  {!datos.tieneProrroga ? (
                    <div className="rounded-sm border-2 border-primary/30 bg-primary/5 p-4 sm:col-span-2">
                      <p className="text-sm font-semibold">Prórroga de la concesión</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        La prórroga no forma parte de la carga inicial. Podés activarla directamente desde esta ficha cuando corresponda.
                      </p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="space-y-2">
                          <Label htmlFor="concesion-fecha-inicio-prorroga-ficha">
                            Fecha de inicio de la prórroga *
                          </Label>
                          <Input
                            id="concesion-fecha-inicio-prorroga-ficha"
                            type="date"
                            value={fechaInicioProrrogaFicha}
                            onChange={(e) => setFechaInicioProrrogaFicha(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => activarProrroga.mutate()}
                          disabled={activarProrroga.isPending}
                        >
                          {activarProrroga.isPending ? "Activando…" : "Activar prórroga"}
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        El canon inicial de la prórroga se toma automáticamente del canon vigente del contrato.
                      </p>
                    </div>
                  ) : null}
                  {datos.tieneProrroga ? (
                    <>
                      <DatoConcesion titulo="Canon inicial de la prórroga" valor={money(num(datos.canonProrroga))} />
                      <DatoConcesion
                        titulo="Canon vigente de la prórroga"
                        valor={money(num(datos.canonProrrogaVigente))}
                      />
                      <DatoConcesion
                        titulo="Fecha de finalización de la prórroga"
                        valor={formatearFechaContrato(datos.fechaVencimientoProrroga || vencimientoProrroga)}
                      />
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    {ultimaModificacion
                      ? `Última modificación: ${ultimaModificacion.usuario_nombre}${ultimaModificacion.usuario_email ? ` · ${ultimaModificacion.usuario_email}` : ""} · ${new Date(ultimaModificacion.modificado_en).toLocaleString("es-AR")}`
                      : "Información registrada"}
                  </p>
                  {!solicitudModificacionPendiente ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMotivoModificacion("");
                        setModoEdicion("rectificacion");
                        setEditando(true);
                      }}
                    >
                      Modificar información
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </details>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Pedido de reconsideración del canon</CardTitle>
            <CardDescription>
              Podés solicitar a Auditoría que reconsidere el canon vigente. El canon actual no se modifica hasta que el pedido sea autorizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const rechazada = [...(solicitudesCanon.data ?? [])]
                .filter((solicitud) => solicitud.estado === "rechazada")
                .sort(
                  (a, b) =>
                    new Date(b.resuelta_en ?? b.solicitada_en).getTime() -
                    new Date(a.resuelta_en ?? a.solicitada_en).getTime(),
                )[0];

              return rechazada ? (
                <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm">
                  <p className="font-semibold">Pedido de reconsideración rechazado</p>
                  <p className="mt-1 text-sm">Auditoría rechazó el pedido de reconsideración del canon.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <DatoConcesion titulo="Canon solicitado" valor={money(rechazada.canon_solicitado)} />
                    <DatoConcesion titulo="Canon vigente" valor={money(rechazada.canon_actual)} />
                    <DatoConcesion titulo="Tipo" valor={rechazada.tipo_canon === "prorroga" ? "Prórroga" : "Contrato"} />
                  </div>
                  {rechazada.comentario_resolucion ? (
                    <p className="mt-3 text-sm">
                      <span className="font-medium">Observación de Auditoría:</span> {rechazada.comentario_resolucion}
                    </p>
                  ) : null}
                </div>
              ) : null;
            })()}

            {(solicitudesCanon.data ?? []).filter((solicitud) => solicitud.estado === "pendiente").map((solicitud) => (
              <div key={solicitud.id} className="rounded-md border border-slate-300 bg-slate-100 p-4 text-slate-700">
                <p className="font-medium">Pedido de reconsideración pendiente de aprobación</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <DatoConcesion titulo="Canon actual" valor={money(solicitud.canon_actual)} />
                  <DatoConcesion titulo="Canon solicitado" valor={money(solicitud.canon_solicitado)} />
                  <DatoConcesion titulo="Tipo" valor={solicitud.tipo_canon === "prorroga" ? "Prórroga" : "Contrato"} />
                </div>
                <p className="mt-3 text-sm">Motivo: {solicitud.motivo}</p>
                <p className="mt-2 text-xs">
                  Pendiente de autorización de Auditoría · {new Date(solicitud.solicitada_en).toLocaleString("es-AR")}
                </p>
              </div>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo-reconsideracion-canon">Canon a reconsiderar</Label>
                <select
                  id="tipo-reconsideracion-canon"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={tipoCanonReconsideracion}
                  onChange={(e) => setTipoCanonReconsideracion(e.target.value as TipoCanonReconsideracion)}
                  disabled={solicitudesCanon.data?.some((solicitud) => solicitud.estado === "pendiente")}
                >
                  <option value="contrato">Canon del contrato</option>
                  {datos.tieneProrroga ? <option value="prorroga">Canon de la prórroga</option> : null}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="canon-solicitado-reconsideracion">Nuevo canon solicitado</Label>
                <Input
                  id="canon-solicitado-reconsideracion"
                  inputMode="decimal"
                  value={canonSolicitadoReconsideracion}
                  onChange={(e) => setCanonSolicitadoReconsideracion(e.target.value)}
                  placeholder="Importe que se solicita autorizar"
                  disabled={solicitudesCanon.data?.some((solicitud) => solicitud.estado === "pendiente")}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="motivo-reconsideracion-canon">Motivo del pedido</Label>
                <Input
                  id="motivo-reconsideracion-canon"
                  value={motivoReconsideracion}
                  onChange={(e) => setMotivoReconsideracion(e.target.value)}
                  placeholder="Explicá brevemente por qué se solicita la reconsideración."
                  disabled={solicitudesCanon.data?.some((solicitud) => solicitud.estado === "pendiente")}
                />
              </div>
            </div>
            <Button
              onClick={() => solicitarReconsideracion.mutate()}
              disabled={solicitarReconsideracion.isPending || solicitudesCanon.data?.some((solicitud) => solicitud.estado === "pendiente")}
            >
              {solicitarReconsideracion.isPending ? "Enviando…" : "Enviar pedido a Auditoría"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-primary" /> Documentación de la concesión
            </CardTitle>
            <CardDescription>
              Subí el contrato, el sellado del contrato y el certificado de buena conducta en formato PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DOCUMENTOS.map((documento) => {
              const metadata =
                documento.tipo === "contrato"
                  ? contrato.data
                  : documento.tipo === "contrato_sellado"
                    ? contratoSellado.data
                    : buenaConducta.data;
              const archivo = archivos[documento.tipo];
              const cargando = subirDocumento.isPending && subirDocumento.variables?.tipo === documento.tipo;
              return (
                <div
                  key={documento.tipo}
                  className="overflow-hidden rounded-md border-2 border-primary/20 bg-card shadow-sm ring-1 ring-border/50"
                >
                  <div className="flex items-center gap-3 border-b-2 border-primary/10 bg-secondary/70 px-4 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-tight text-foreground">{documento.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{documento.descripcion}</p>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                  <Label htmlFor={`concesion-${documento.tipo}`} className="mt-3 block">Archivo PDF</Label>
                  <Input
                    id={`concesion-${documento.tipo}`}
                    className="sr-only"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) =>
                      setArchivos((actual) => ({ ...actual, [documento.tipo]: e.target.files?.[0] ?? null }))
                    }
                  />
                  <Label
                    htmlFor={`concesion-${documento.tipo}`}
                    className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-md border border-primary/20 bg-secondary px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary/80"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {metadata ? "Modificar archivo" : "Seleccionar archivo"}
                  </Label>
                  <p className="mt-2 text-xs text-muted-foreground">Tamaño máximo: 3 MB.</p>

                  {archivo && (
                    <p className="mt-2 text-sm">
                      Archivo seleccionado: <span className="font-medium">{archivo.name}</span>
                    </p>
                  )}

                  {metadata && (
                    <div className="mt-3 rounded-sm border border-border bg-secondary/40 p-3 text-sm">
                      <p className="font-medium">Documento cargado</p>
                      <p className="mt-1 break-all text-muted-foreground">{metadata.nombreArchivo}</p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDocumentoConcesion(cooperadora.id, documento.tipo).catch((error: Error) => toast.error(error.message))}
                      >
                        <FileText className="mr-2 h-4 w-4" /> Ver PDF
                      </Button>
                    </div>
                  )}

                  <Button
                    className="mt-4 w-full border border-primary/20 shadow-sm"
                    onClick={() => subirDocumento.mutate({ tipo: documento.tipo })}
                    disabled={!archivo || cargando}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {cargando ? "Subiendo…" : `Subir ${documento.titulo.toLowerCase()}`}
                  </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {historial.data?.length ? (
        <details className="mt-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de concesionarios</span>
              <span className="text-xs font-normal text-muted-foreground">
                {construirHistorialConcesionarios(historial.data).length} registro{construirHistorialConcesionarios(historial.data).length === 1 ? "" : "s"}
              </span>
            </span>
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {construirHistorialConcesionarios(historial.data).map((registro) => (
              <details key={registro.id} className="group">
                <summary className="cursor-pointer list-none px-4 py-3 hover:bg-secondary/40">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">
                      {registro.apellido}, {registro.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Contrato firmado: {formatearFechaContrato(registro.fechaFirmaContrato)}
                    </span>
                  </span>
                </summary>
                <div className="grid gap-2 border-t border-border bg-secondary/20 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DatoConcesion titulo="Concesionario" valor={registro.apellido + ", " + registro.nombre} />
                  <DatoConcesion
                    titulo="Contrato vigente hasta"
                    valor={formatearFechaContrato(registro.fechaVencimientoContrato)}
                  />
                  <DatoConcesion titulo="Canon registrado" valor={money(num(registro.canon))} />
                  <DatoConcesion
                    titulo="Estado del registro"
                    valor={registro.esActual ? "Concesionario actual" : "Antecedente"}
                  />
                  {registro.tieneProrroga ? (
                    <>
                      <DatoConcesion
                        titulo="Inicio de la prórroga"
                        valor={formatearFechaContrato(registro.fechaInicioProrroga)}
                      />
                      <DatoConcesion
                        titulo="Prórroga vigente hasta"
                        valor={formatearFechaContrato(registro.fechaVencimientoProrroga)}
                      />
                    </>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </details>
      ) : null}

      {(historial.data?.length || historialDocumentos.data?.length) ? (
        <details className="mt-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones</span>
              <span className="text-xs font-normal text-muted-foreground">
                {(historial.data?.length ?? 0) + (historialDocumentos.data?.length ?? 0)} registro{(historial.data?.length ?? 0) + (historialDocumentos.data?.length ?? 0) === 1 ? "" : "s"}
              </span>
            </span>
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            <div className="rounded-sm border border-border bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">
              Las actualizaciones manuales del canon quedan reflejadas en el historial de modificaciones de la concesión.
            </div>            {cambiosCanon.length > 0 && (
              <div className="rounded-sm border border-border">
                <div className="border-b border-border bg-secondary/40 px-3 py-3">
                  <p className="text-sm font-medium">Historial de cambios del canon</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se muestran el valor inicial y cada modificación posterior del canon.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Fecha</th>
                        <th className="px-3 py-2 font-medium">Movimiento</th>
                        <th className="px-3 py-2 font-medium">Valor anterior</th>
                        <th className="px-3 py-2 font-medium">Nuevo valor</th>
                        <th className="px-3 py-2 font-medium">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cambiosCanon.map((cambio) => (
                        <tr key={cambio.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                            {new Date(cambio.modificadoEn).toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2 align-top font-medium">{cambio.etiqueta}</td>
                          <td className="px-3 py-2 align-top">
                            {cambio.valorAnterior === null ? "—" : money(cambio.valorAnterior)}
                          </td>
                          <td className="px-3 py-2 align-top font-medium">{money(cambio.nuevoValor)}</td>
                          <td className="px-3 py-2 align-top text-xs">
                            <span>{cambio.usuarioNombre}</span>
                            {cambio.usuarioEmail ? (
                              <span className="block text-muted-foreground">{cambio.usuarioEmail}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {historialDocumentos.data && historialDocumentos.data.length > 0 && (
              <div className="rounded-sm border border-border">
                <div className="border-b border-border bg-secondary/40 px-3 py-3">
                  <p className="text-sm font-medium">Historial de documentación</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Registra cada carga y reemplazo de los archivos respaldatorios.
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {historialDocumentos.data.map((registro) => (
                    <div key={registro.id} className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{tituloTipoDocumentoConcesion(registro.tipo)}</p>
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
              {historial.data.map((registro) => (
                <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                  <summary className="cursor-pointer list-none text-sm">
                    <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">{registro.datos.apellido}, {registro.datos.nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}</span>
                      <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DatoConcesion titulo="Apellido" valor={registro.datos.apellido} />
                    <DatoConcesion titulo="Nombre" valor={registro.datos.nombre} />
                    <DatoConcesion
                      titulo="Fecha de firma del contrato"
                      valor={formatearFechaContrato(registro.datos.fechaFirmaContrato)}
                    />
                    <DatoConcesion
                      titulo="Contrato vigente hasta"
                      valor={formatearFechaContrato(
                        registro.datos.fechaVencimientoContrato ||
                          calcularVencimientoConcesion(registro.datos.fechaFirmaContrato, 2),
                      )}
                    />
                    {registro.datos.tieneProrroga ? (
                      <>
                        <DatoConcesion
                          titulo="Inicio de la prórroga"
                          valor={formatearFechaContrato(registro.datos.fechaInicioProrroga)}
                        />
                        <DatoConcesion
                          titulo="Prórroga vigente hasta"
                          valor={formatearFechaContrato(
                            registro.datos.fechaVencimientoProrroga ||
                              calcularVencimientoConcesion(registro.datos.fechaInicioProrroga, 1),
                          )}
                        />
                      </>
                    ) : null}
                    <DatoConcesion titulo="Canon inicial del contrato" valor={money(num(registro.datos.canon))} />
                    <DatoConcesion titulo="Canon vigente del contrato" valor={money(num(registro.datos.canonVigente ?? registro.datos.canon))} />
                    {registro.datos.tieneProrroga ? (
                      <>
                        <DatoConcesion titulo="Canon inicial de la prórroga" valor={money(num(registro.datos.canonProrroga))} />
                        <DatoConcesion titulo="Canon vigente de la prórroga" valor={money(num(registro.datos.canonProrrogaVigente ?? registro.datos.canonProrroga))} />
                      </>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}

function construirHistorialConcesionarios(
  historial: Array<{
    id: string;
    datos: ConcesionKiosco;
    usuario_nombre: string;
    usuario_email: string | null;
    modificado_en: string;
  }>,
) {
  const vistos = new Set<string>();
  const registros = [];

  for (const registro of historial) {
    const datos = registro.datos;
    const clave = [
      datos.apellido.trim().toLocaleLowerCase(),
      datos.nombre.trim().toLocaleLowerCase(),
      datos.fechaFirmaContrato,
      datos.fechaVencimientoContrato ||
        calcularVencimientoConcesion(datos.fechaFirmaContrato, 2),
      datos.fechaInicioProrroga || "",
      datos.fechaVencimientoProrroga || "",
    ].join("|");

    if (vistos.has(clave)) continue;
    vistos.add(clave);

    registros.push({
      id: registro.id,
      apellido: datos.apellido,
      nombre: datos.nombre,
      canon: datos.canon,
      canonProrroga: datos.canonProrroga ?? "",
      canonVigente: datos.canonVigente ?? datos.canon,
      canonProrrogaVigente: datos.canonProrrogaVigente ?? datos.canonProrroga ?? "",
      fechaFirmaContrato: datos.fechaFirmaContrato,
      fechaVencimientoContrato:
        datos.fechaVencimientoContrato ||
        calcularVencimientoConcesion(datos.fechaFirmaContrato, 2),
      tieneProrroga: Boolean(datos.tieneProrroga),
      fechaInicioProrroga: datos.fechaInicioProrroga || "",
      fechaVencimientoProrroga:
        datos.fechaVencimientoProrroga ||
        (datos.tieneProrroga
          ? calcularVencimientoConcesion(datos.fechaInicioProrroga || "", 1)
          : ""),
      esActual: registro === historial[0],
    });
  }

  return registros;
}

function tituloTipoDocumentoConcesion(tipo: TipoDocumentoConcesion) {
  if (tipo === "contrato") return "Contrato de concesión";
  if (tipo === "contrato_sellado") return "Sellado de contrato";
  return "Certificado de buena conducta";
}

function construirActualizacionesCanon(
  historial: Array<{
    datos: ConcesionKiosco;
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

function construirHistorialCanon(
  historial: Array<{
    id: string;
    datos: ConcesionKiosco;
    usuario_nombre: string;
    usuario_email: string | null;
    modificado_en: string;
  }>,
) {
  const ordenCronologico = [...historial].reverse();
  const cambios: Array<{
    id: string;
    etiqueta: string;
    valorAnterior: number | null;
    nuevoValor: number;
    usuarioNombre: string;
    usuarioEmail: string | null;
    modificadoEn: string;
  }> = [];

  ordenCronologico.forEach((registro, index) => {
    const nuevoValor = num(registro.datos.canon);
    const registroAnterior = ordenCronologico[index - 1];
    const valorAnterior = registroAnterior ? num(registroAnterior.datos.canon) : null;

    if (valorAnterior !== null && valorAnterior === nuevoValor) return;

    cambios.push({
      id: registro.id,
      etiqueta: valorAnterior === null ? "Valor inicial" : "Cambio de canon",
      valorAnterior,
      nuevoValor,
      usuarioNombre: registro.usuario_nombre,
      usuarioEmail: registro.usuario_email,
      modificadoEn: registro.modificado_en,
    });
  });

  return cambios.reverse();
}

function calcularProximaActualizacionCanonSimple(fechaInicio: string) {
  if (!fechaInicio) return "";
  const [anio, mes, dia] = fechaInicio.split("-").map(Number);
  if (!anio || !mes || !dia) return "";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Si el contrato comenzó este mismo año y todavía no cumplió un año,
  // la primera actualización será en el aniversario del año siguiente.
  const anioObjetivo = hoy.getFullYear() <= anio ? anio + 1 : hoy.getFullYear();
  const aniversario = new Date(anioObjetivo, mes - 1, dia);

  return [
    aniversario.getFullYear(),
    String(aniversario.getMonth() + 1).padStart(2, "0"),
    String(aniversario.getDate()).padStart(2, "0"),
  ].join("-");
}

function calcularSiguienteAniversarioCanon(fechaInicio: string) {
  if (!fechaInicio) return "";
  const [anio, mes, dia] = fechaInicio.split("-").map(Number);
  if (!anio || !mes || !dia) return "";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const anioBase = hoy.getFullYear() <= anio ? anio + 1 : hoy.getFullYear() + 1;
  const aniversario = new Date(anioBase, mes - 1, dia);

  return [
    aniversario.getFullYear(),
    String(aniversario.getMonth() + 1).padStart(2, "0"),
    String(aniversario.getDate()).padStart(2, "0"),
  ].join("-");
}

function canonNecesitaActualizacionSimple(fechaObjetivo: string) {
  if (!fechaObjetivo) return false;
  const [anio, mes, dia] = fechaObjetivo.split("-").map(Number);
  if (!anio || !mes || !dia) return false;

  const objetivo = new Date(anio, mes - 1, dia);
  objetivo.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return hoy >= objetivo;
}

function canonVigenteFueActualizadoDesde(
  historial: Array<{
    datos: ConcesionKiosco;
    modificado_en: string;
  }>,
  tipo: "contrato" | "prorroga",
  fechaObjetivo: string,
) {
  if (!fechaObjetivo || historial.length < 2) return false;

  const objetivo = new Date(fechaObjetivo + "T00:00:00");
  objetivo.setHours(0, 0, 0, 0);

  const cronologico = [...historial].reverse();

  for (let i = 1; i < cronologico.length; i += 1) {
    const anterior = cronologico[i - 1]?.datos;
    const actual = cronologico[i]?.datos;
    const fechaModificacion = new Date(cronologico[i]?.modificado_en ?? "");

    if (!anterior || !actual || Number.isNaN(fechaModificacion.getTime())) continue;

    const valorAnterior =
      tipo === "prorroga"
        ? Number(anterior.canonProrrogaVigente ?? anterior.canonProrroga)
        : Number(anterior.canonVigente ?? anterior.canon);
    const valorActual =
      tipo === "prorroga"
        ? Number(actual.canonProrrogaVigente ?? actual.canonProrroga)
        : Number(actual.canonVigente ?? actual.canon);

    if (!Number.isFinite(valorAnterior) || !Number.isFinite(valorActual)) continue;

    fechaModificacion.setHours(0, 0, 0, 0);
    if (fechaModificacion >= objetivo && valorAnterior !== valorActual) {
      return true;
    }
  }

  return false;
}

function formatearFechaContrato(valor: string | undefined) {
  if (!valor) return "No informado";
  const [anio, mes, dia] = valor.split("-");
  if (!anio || !mes || !dia) return valor;
  return [dia, mes, anio].join("/");
}

function DatoConcesion({ titulo, valor, className = "" }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-border bg-card px-3 py-3 ${className}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor || "No informado"}</p>
    </div>
  );
}
