import { ministerioRequest, usingMinisterioApi } from "./index";
import {
  cargarConcesionKiosco,
  guardarConcesionKiosco,
  type ConcesionKiosco,
} from "./concesion";

export type TipoCanonReconsideracion = "contrato" | "prorroga";
export type EstadoSolicitudCanon = "pendiente" | "aprobada" | "rechazada";

export type ActorSolicitudCanon = {
  id: string;
  nombre: string;
  email: string | null;
};

export type SolicitudReconsideracionCanon = {
  id: string;
  cooperadora_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string | null;
  solicitada_en: string;
  tipo_canon: TipoCanonReconsideracion;
  canon_actual: number;
  canon_solicitado: number;
  motivo: string;
  estado: EstadoSolicitudCanon;
  resuelta_en: string | null;
  resuelta_por_id: string | null;
  resuelta_por_nombre: string | null;
  comentario_resolucion: string | null;
};

const DEMO_KEY_PREFIX = "demo-solicitudes-reconsideracion-canon-";

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
}

function generarId() {
  return `demo-solicitud-canon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function cargarSolicitudesReconsideracionCanon(
  cooperadoraId: string,
): Promise<SolicitudReconsideracionCanon[]> {
  if (usingMinisterioApi()) {
    const respuesta = await ministerioRequest<SolicitudReconsideracionCanon[] | null>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/solicitudes-canon`,
    );
    return Array.isArray(respuesta) ? respuesta : [];
  }

  try {
    const raw = localStorage.getItem(clave(cooperadoraId));
    const solicitudes = raw ? (JSON.parse(raw) as SolicitudReconsideracionCanon[]) : [];
    return Array.isArray(solicitudes) ? solicitudes : [];
  } catch {
    return [];
  }
}

export async function crearSolicitudReconsideracionCanon(
  cooperadoraId: string,
  actor: ActorSolicitudCanon,
  input: {
    tipoCanon: TipoCanonReconsideracion;
    canonSolicitado: number;
    motivo: string;
  },
): Promise<SolicitudReconsideracionCanon> {
  if (!Number.isFinite(input.canonSolicitado) || input.canonSolicitado < 0) {
    throw new Error("El canon solicitado debe ser un importe válido mayor o igual a cero.");
  }
  if (!input.motivo.trim()) {
    throw new Error("Debés indicar el motivo del pedido de reconsideración.");
  }

  const concesion = await cargarConcesionKiosco(cooperadoraId);
  if (!concesion) throw new Error("No hay datos de concesión registrados.");

  if (input.tipoCanon === "prorroga" && !concesion.tieneProrroga) {
    throw new Error("No existe una prórroga registrada para solicitar su reconsideración.");
  }

  const canonActual = input.tipoCanon === "prorroga"
    ? Number(concesion.canonProrrogaVigente ?? concesion.canonProrroga)
    : Number(concesion.canonVigente ?? concesion.canon);

  if (!Number.isFinite(canonActual) || canonActual < 0) {
    throw new Error("No se pudo determinar el canon vigente actual.");
  }

  if (input.canonSolicitado === canonActual) {
    throw new Error("El canon solicitado debe ser diferente del canon vigente actual.");
  }

  const pendientes = (await cargarSolicitudesReconsideracionCanon(cooperadoraId)).filter(
    (solicitud) => solicitud.estado === "pendiente",
  );
  if (pendientes.length > 0) {
    throw new Error("Ya existe un pedido de reconsideración del canon pendiente de autorización.");
  }

  const solicitud: SolicitudReconsideracionCanon = {
    id: generarId(),
    cooperadora_id: cooperadoraId,
    usuario_id: actor.id,
    usuario_nombre: actor.nombre,
    usuario_email: actor.email,
    solicitada_en: new Date().toISOString(),
    tipo_canon: input.tipoCanon,
    canon_actual: canonActual,
    canon_solicitado: Math.round(input.canonSolicitado * 100) / 100,
    motivo: input.motivo.trim(),
    estado: "pendiente",
    resuelta_en: null,
    resuelta_por_id: null,
    resuelta_por_nombre: null,
    comentario_resolucion: null,
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudReconsideracionCanon>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/solicitudes-canon`,
      {
        method: "POST",
        body: JSON.stringify(solicitud),
      },
    );
  }

  const solicitudes = await cargarSolicitudesReconsideracionCanon(cooperadoraId);
  solicitudes.unshift(solicitud);
  localStorage.setItem(clave(cooperadoraId), JSON.stringify(solicitudes.slice(0, 50)));
  return solicitud;
}

export async function resolverSolicitudReconsideracionCanon(
  solicitud: SolicitudReconsideracionCanon,
  decision: "aprobar" | "rechazar",
  auditor: ActorSolicitudCanon,
  comentario = "",
): Promise<SolicitudReconsideracionCanon> {
  if (solicitud.estado !== "pendiente") {
    throw new Error("Este pedido ya fue resuelto.");
  }

  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudReconsideracionCanon>(
      `/api/cooperadoras/${solicitud.cooperadora_id}/concesion-kiosco/solicitudes-canon/${solicitud.id}/resolver`,
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
    const actual = await cargarConcesionKiosco(solicitud.cooperadora_id);
    if (!actual) throw new Error("No hay datos de concesión registrados.");

    const datosActualizados: ConcesionKiosco = {
      ...actual,
      ...(solicitud.tipo_canon === "prorroga"
        ? { canonProrrogaVigente: solicitud.canon_solicitado }
        : { canonVigente: solicitud.canon_solicitado }),
    };

    await guardarConcesionKiosco(solicitud.cooperadora_id, datosActualizados);
  }

  const solicitudes = await cargarSolicitudesReconsideracionCanon(solicitud.cooperadora_id);
  const resuelta: SolicitudReconsideracionCanon = {
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
