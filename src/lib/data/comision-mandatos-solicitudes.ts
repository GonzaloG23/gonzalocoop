import { ministerioRequest, usingMinisterioApi } from "./index";
import {
  calcularFinMandato,
  cargarComisionDirectiva,
  guardarComisionDirectiva,
  type DatosComisionDirectiva,
} from "./comision";
import {
  registrarModificacionComisionDirectiva,
  type ActorModificacionComision,
} from "./comision-historial";

export type EstadoSolicitudMandato = "pendiente" | "aprobada" | "rechazada";

export type SolicitudCambioMandato = {
  id: string;
  cooperadora_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string | null;
  solicitada_en: string;
  numero_periodo_actual: number;
  numero_periodo_solicitado: number;
  fecha_inicio_actual: string | null;
  fecha_inicio_solicitada: string;
  fecha_fin_actual: string | null;
  fecha_fin_solicitada: string;
  motivo: string;
  estado: EstadoSolicitudMandato;
  resuelta_en: string | null;
  resuelta_por_id: string | null;
  resuelta_por_nombre: string | null;
  comentario_resolucion: string | null;
};

const DEMO_KEY_PREFIX = "demo-solicitudes-mandato-";

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
}

function generarId() {
  return `demo-solicitud-mandato-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function cargarSolicitudesCambioMandato(
  cooperadoraId: string,
): Promise<SolicitudCambioMandato[]> {
  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudCambioMandato[]>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva/solicitudes-mandato`,
    );
  }

  try {
    const raw = localStorage.getItem(clave(cooperadoraId));
    const solicitudes = raw ? (JSON.parse(raw) as SolicitudCambioMandato[]) : [];
    return Array.isArray(solicitudes) ? solicitudes : [];
  } catch {
    return [];
  }
}

export async function crearSolicitudCambioMandato(
  cooperadoraId: string,
  actor: ActorModificacionComision,
  input: {
    numeroPeriodoSolicitado: number;
    fechaInicioSolicitada: string;
    motivo: string;
  },
): Promise<SolicitudCambioMandato> {
  if (!Number.isInteger(input.numeroPeriodoSolicitado) || input.numeroPeriodoSolicitado < 1 || input.numeroPeriodoSolicitado > 2) {
    throw new Error("El período solicitado debe ser 1 o 2.");
  }
  if (!input.fechaInicioSolicitada) {
    throw new Error("Debés indicar la fecha de constitución / inicio solicitada.");
  }
  if (!input.motivo.trim()) {
    throw new Error("Debés indicar el motivo de la solicitud.");
  }

  const actual = await cargarComisionDirectiva(cooperadoraId);
  if (!actual) throw new Error("No hay una Comisión Directiva registrada.");

  const pendientes = (await cargarSolicitudesCambioMandato(cooperadoraId)).filter(
    (solicitud) => solicitud.estado === "pendiente",
  );
  if (pendientes.length > 0) {
    throw new Error("Ya existe una solicitud de modificación de mandato pendiente de autorización.");
  }

  const fechaFinSolicitada = calcularFinMandato(input.fechaInicioSolicitada);
  const solicitud: SolicitudCambioMandato = {
    id: generarId(),
    cooperadora_id: cooperadoraId,
    usuario_id: actor.id,
    usuario_nombre: actor.nombre,
    usuario_email: actor.email,
    solicitada_en: new Date().toISOString(),
    numero_periodo_actual: actual.numeroPeriodo,
    numero_periodo_solicitado: input.numeroPeriodoSolicitado,
    fecha_inicio_actual: actual.fechaInicioMandato,
    fecha_inicio_solicitada: input.fechaInicioSolicitada,
    fecha_fin_actual: actual.fechaFinMandato,
    fecha_fin_solicitada: fechaFinSolicitada,
    motivo: input.motivo.trim(),
    estado: "pendiente",
    resuelta_en: null,
    resuelta_por_id: null,
    resuelta_por_nombre: null,
    comentario_resolucion: null,
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudCambioMandato>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva/solicitudes-mandato`,
      {
        method: "POST",
        body: JSON.stringify(solicitud),
      },
    );
  }

  const solicitudes = await cargarSolicitudesCambioMandato(cooperadoraId);
  solicitudes.unshift(solicitud);
  localStorage.setItem(clave(cooperadoraId), JSON.stringify(solicitudes.slice(0, 50)));
  return solicitud;
}

export async function resolverSolicitudCambioMandato(
  solicitud: SolicitudCambioMandato,
  decision: "aprobar" | "rechazar",
  auditor: ActorModificacionComision,
  comentario = "",
): Promise<SolicitudCambioMandato> {
  if (solicitud.estado !== "pendiente") {
    throw new Error("Esta solicitud ya fue resuelta.");
  }

  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudCambioMandato>(
      `/api/cooperadoras/${solicitud.cooperadora_id}/comision-directiva/solicitudes-mandato/${solicitud.id}/resolver`,
      {
        method: "POST",
        body: JSON.stringify({
          decision,
          comentario: comentario.trim(),
          auditor,
        }),
      },
    );
  }

  if (decision === "aprobar") {
    const actual = await cargarComisionDirectiva(solicitud.cooperadora_id);
    if (!actual) throw new Error("No hay una Comisión Directiva registrada.");

    const guardados = (await guardarComisionDirectiva(
      solicitud.cooperadora_id,
      actual.miembros,
      {
        fechaInicioMandato: solicitud.fecha_inicio_solicitada,
        fechaFinMandato: solicitud.fecha_fin_solicitada,
        numeroPeriodo: solicitud.numero_periodo_solicitado,
      },
    )) as DatosComisionDirectiva;

    await registrarModificacionComisionDirectiva(
      solicitud.cooperadora_id,
      guardados.miembros,
      auditor,
      {
        tipo: "modificacion",
        fechaInicioMandato: guardados.fechaInicioMandato,
        fechaFinMandato: guardados.fechaFinMandato,
        numeroPeriodo: guardados.numeroPeriodo,
      },
    );
  }

  const solicitudes = await cargarSolicitudesCambioMandato(solicitud.cooperadora_id);
  const resuelta: SolicitudCambioMandato = {
    ...solicitud,
    estado: decision === "aprobar" ? "aprobada" : "rechazada",
    resuelta_en: new Date().toISOString(),
    resuelta_por_id: auditor.id,
    resuelta_por_nombre: auditor.nombre,
    comentario_resolucion: comentario.trim() || null,
  };
  const nuevas = solicitudes.map((item) => (item.id === solicitud.id ? resuelta : item));
  localStorage.setItem(clave(solicitud.cooperadora_id), JSON.stringify(nuevas));
  return resuelta;
}
