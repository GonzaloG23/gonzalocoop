import { ministerioRequest, usingMinisterioApi } from "./index";
import type { Cooperadora } from "./libro";

export type DatosInstitucionales = {
  cue: string;
  nivel: string;
  turno: string;
  localidad: string;
  director_nombre: string;
  supervisor_nombre: string;
  email_oficial: string;
};

export type ActorModificacion = {
  id: string;
  nombre: string;
  email: string | null;
};

export type ModificacionDatosInstitucionales = {
  id: string;
  datos: DatosInstitucionales;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string | null;
  modificado_en: string;
};

const DEMO_KEY_PREFIX = "demo-datos-institucionales-";
const DEMO_HISTORIAL_KEY_PREFIX = "demo-historial-datos-institucionales-";

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
}

function claveHistorial(cooperadoraId: string) {
  return `${DEMO_HISTORIAL_KEY_PREFIX}${cooperadoraId}`;
}

export async function cargarDatosInstitucionales(cooperadora: Cooperadora): Promise<DatosInstitucionales> {
  const base: DatosInstitucionales = {
    cue: cooperadora.cue ?? "",
    nivel: "",
    turno: "",
    localidad: cooperadora.localidad ?? "",
    director_nombre: "",
    supervisor_nombre: "",
    email_oficial: "",
  };

  if (usingMinisterioApi()) {
    const datos = await ministerioRequest<Partial<DatosInstitucionales>>(
      `/api/cooperadoras/${cooperadora.id}/datos-institucionales`,
    );
    return { ...base, ...(datos ?? {}) };
  }

  try {
    const raw = localStorage.getItem(clave(cooperadora.id));
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<DatosInstitucionales>) };
  } catch {
    return base;
  }
}

export async function cargarHistorialDatosInstitucionales(
  cooperadoraId: string,
): Promise<ModificacionDatosInstitucionales[]> {
  if (usingMinisterioApi()) {
    return ministerioRequest<ModificacionDatosInstitucionales[]>(
      `/api/cooperadoras/${cooperadoraId}/datos-institucionales/historial`,
    );
  }

  try {
    const raw = localStorage.getItem(claveHistorial(cooperadoraId));
    if (!raw) return [];
    const historial = JSON.parse(raw) as ModificacionDatosInstitucionales[];
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
}

export async function guardarDatosInstitucionales(
  cooperadoraId: string,
  datos: DatosInstitucionales,
  actor: ActorModificacion,
) {
  const normalizados: DatosInstitucionales = {
    cue: datos.cue.replace(/\D/g, ""),
    nivel: datos.nivel.trim(),
    turno: datos.turno.trim(),
    localidad: datos.localidad.trim(),
    director_nombre: datos.director_nombre.trim(),
    supervisor_nombre: datos.supervisor_nombre.trim(),
    email_oficial: datos.email_oficial.trim(),
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<DatosInstitucionales>(
      `/api/cooperadoras/${cooperadoraId}/datos-institucionales`,
      {
        method: "PATCH",
        body: JSON.stringify({ datos: normalizados, modificado_por: actor }),
      },
    );
  }

  localStorage.setItem(clave(cooperadoraId), JSON.stringify(normalizados));

  const registro: ModificacionDatosInstitucionales = {
    id: `demo-datos-institucionales-${Date.now()}`,
    datos: normalizados,
    usuario_id: actor.id,
    usuario_nombre: actor.nombre,
    usuario_email: actor.email,
    modificado_en: new Date().toISOString(),
  };

  let historial: ModificacionDatosInstitucionales[] = [];
  try {
    const raw = localStorage.getItem(claveHistorial(cooperadoraId));
    const existente = raw ? (JSON.parse(raw) as ModificacionDatosInstitucionales[]) : [];
    if (Array.isArray(existente)) historial = existente;
  } catch {
    historial = [];
  }

  historial = [registro, ...historial].slice(0, 50);
  localStorage.setItem(claveHistorial(cooperadoraId), JSON.stringify(historial));
  return normalizados;
}
