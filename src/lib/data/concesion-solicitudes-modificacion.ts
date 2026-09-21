import { ministerioRequest, usingMinisterioApi } from "./index";
import {
  cargarConcesionKiosco,
  guardarConcesionKiosco,
  type ConcesionKiosco,
} from "./concesion";
import {
  registrarModificacionConcesionKiosco,
  type ActorConcesion,
} from "./concesion-historial";

export type EstadoSolicitudModificacionConcesion = "pendiente" | "aprobada" | "rechazada";

export type SolicitudModificacionConcesion = {
  id: string;
  cooperadora_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string | null;
  solicitada_en: string;
  datos_actuales: ConcesionKiosco;
  datos_solicitados: ConcesionKiosco;
  motivo: string;
  estado: EstadoSolicitudModificacionConcesion;
  resuelta_en: string | null;
  resuelta_por_id: string | null;
  resuelta_por_nombre: string | null;
  comentario_resolucion: string | null;
};

const DEMO_KEY_PREFIX = "demo-solicitudes-modificacion-concesion-";

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
}

function generarId() {
  return `demo-solicitud-modificacion-concesion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validarPropuesta(datos: ConcesionKiosco) {
  if (!datos.apellido.trim()) throw new Error("Debés completar el apellido del concesionario.");
  if (!datos.nombre.trim()) throw new Error("Debés completar el nombre del concesionario.");
  if (!datos.fechaFirmaContrato) throw new Error("Debés completar la fecha de firma del contrato.");

  const canon = Number(datos.canon);
  const canonVigente = Number(datos.canonVigente);

  if (!Number.isFinite(canon) || canon < 0) {
    throw new Error("El canon inicial del contrato debe ser un importe válido mayor o igual a cero.");
  }
  if (!Number.isFinite(canonVigente) || canonVigente < 0) {
    throw new Error("El canon vigente del contrato debe ser un importe válido mayor o igual a cero.");
  }

  if (datos.tieneProrroga) {
    if (!datos.fechaInicioProrroga) {
      throw new Error("Debés completar la fecha de inicio de la prórroga.");
    }

    const canonProrroga = Number(datos.canonProrroga);
    const canonProrrogaVigente = Number(datos.canonProrrogaVigente);

    if (!Number.isFinite(canonProrroga) || canonProrroga < 0) {
      throw new Error("El canon inicial de la prórroga debe ser un importe válido mayor o igual a cero.");
    }
    if (!Number.isFinite(canonProrrogaVigente) || canonProrrogaVigente < 0) {
      throw new Error("El canon vigente de la prórroga debe ser un importe válido mayor o igual a cero.");
    }
  }
}

function hayCambios(a: ConcesionKiosco, b: ConcesionKiosco) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export async function cargarSolicitudesModificacionConcesion(
  cooperadoraId: string,
): Promise<SolicitudModificacionConcesion[]> {
  if (usingMinisterioApi()) {
    const respuesta = await ministerioRequest<SolicitudModificacionConcesion[] | null>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/solicitudes-modificacion`,
    );
    return Array.isArray(respuesta) ? respuesta : [];
  }

  try {
    const raw = localStorage.getItem(clave(cooperadoraId));
    const solicitudes = raw ? (JSON.parse(raw) as SolicitudModificacionConcesion[]) : [];
    return Array.isArray(solicitudes) ? solicitudes : [];
  } catch {
    return [];
  }
}

export async function crearSolicitudModificacionConcesion(
  cooperadoraId: string,
  actor: ActorConcesion,
  datosSolicitados: ConcesionKiosco,
  motivo: string,
): Promise<SolicitudModificacionConcesion> {
  const actual = await cargarConcesionKiosco(cooperadoraId);
  if (!actual) throw new Error("No hay datos de concesión registrados.");

  validarPropuesta(datosSolicitados);

  if (!hayCambios(actual, datosSolicitados)) {
    throw new Error("No se detectaron cambios en los datos de la concesión.");
  }

  if (!motivo.trim()) {
    throw new Error("Debés indicar el motivo de la corrección.");
  }

  const pendientes = (await cargarSolicitudesModificacionConcesion(cooperadoraId)).filter(
    (solicitud) => solicitud.estado === "pendiente",
  );
  if (pendientes.length > 0) {
    throw new Error("Ya existe un pedido de modificación de la concesión pendiente de autorización.");
  }

  const solicitud: SolicitudModificacionConcesion = {
    id: generarId(),
    cooperadora_id: cooperadoraId,
    usuario_id: actor.id,
    usuario_nombre: actor.nombre,
    usuario_email: actor.email,
    solicitada_en: new Date().toISOString(),
    datos_actuales: actual,
    datos_solicitados: datosSolicitados,
    motivo: motivo.trim(),
    estado: "pendiente",
    resuelta_en: null,
    resuelta_por_id: null,
    resuelta_por_nombre: null,
    comentario_resolucion: null,
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudModificacionConcesion>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/solicitudes-modificacion`,
      {
        method: "POST",
        body: JSON.stringify(solicitud),
      },
    );
  }

  const solicitudes = await cargarSolicitudesModificacionConcesion(cooperadoraId);
  solicitudes.unshift(solicitud);
  localStorage.setItem(clave(cooperadoraId), JSON.stringify(solicitudes.slice(0, 50)));
  return solicitud;
}

export async function resolverSolicitudModificacionConcesion(
  solicitud: SolicitudModificacionConcesion,
  decision: "aprobar" | "rechazar",
  auditor: ActorConcesion,
  comentario = "",
): Promise<SolicitudModificacionConcesion> {
  if (solicitud.estado !== "pendiente") {
    throw new Error("Esta solicitud ya fue resuelta.");
  }

  if (usingMinisterioApi()) {
    return ministerioRequest<SolicitudModificacionConcesion>(
      `/api/cooperadoras/${solicitud.cooperadora_id}/concesion-kiosco/solicitudes-modificacion/${solicitud.id}/resolver`,
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

    if (JSON.stringify(actual) !== JSON.stringify(solicitud.datos_actuales)) {
      throw new Error("Los datos de la concesión cambiaron desde que se presentó el pedido. Debe realizarse una nueva solicitud.");
    }

    const guardados = await guardarConcesionKiosco(
      solicitud.cooperadora_id,
      solicitud.datos_solicitados,
    );

    await registrarModificacionConcesionKiosco(
      solicitud.cooperadora_id,
      guardados,
      auditor,
    );
  }

  const solicitudes = await cargarSolicitudesModificacionConcesion(
    solicitud.cooperadora_id,
  );
  const resuelta: SolicitudModificacionConcesion = {
    ...solicitud,
    estado: decision === "aprobar" ? "aprobada" : "rechazada",
    resuelta_en: new Date().toISOString(),
    resuelta_por_id: auditor.id,
    resuelta_por_nombre: auditor.nombre,
    comentario_resolucion: comentario.trim() || null,
  };

  const nuevas = solicitudes.map((item) =>
    item.id === solicitud.id ? resuelta : item,
  );
  localStorage.setItem(clave(solicitud.cooperadora_id), JSON.stringify(nuevas));
  return resuelta;
}
