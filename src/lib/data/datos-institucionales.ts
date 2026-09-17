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

const DEMO_KEY_PREFIX = "demo-datos-institucionales-";

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
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

export async function guardarDatosInstitucionales(
  cooperadoraId: string,
  datos: DatosInstitucionales,
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
        body: JSON.stringify(normalizados),
      },
    );
  }

  localStorage.setItem(clave(cooperadoraId), JSON.stringify(normalizados));
  return normalizados;
}
