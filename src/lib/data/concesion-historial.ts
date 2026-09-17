import { ministerioRequest, usingMinisterioApi } from "./index";
import type { ConcesionKiosco } from "./concesion";

export type ActorConcesion = {
  id: string;
  nombre: string;
  email: string | null;
};

export type ModificacionConcesionKiosco = {
  id: string;
  datos: ConcesionKiosco;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string | null;
  modificado_en: string;
};

const DEMO_HISTORIAL_KEY_PREFIX = "demo-historial-concesion-kiosco-";

function claveHistorial(cooperadoraId: string) {
  return `${DEMO_HISTORIAL_KEY_PREFIX}${cooperadoraId}`;
}

export async function cargarHistorialConcesionKiosco(
  cooperadoraId: string,
): Promise<ModificacionConcesionKiosco[]> {
  if (usingMinisterioApi()) {
    return ministerioRequest<ModificacionConcesionKiosco[]>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/historial`,
    );
  }

  try {
    const raw = localStorage.getItem(claveHistorial(cooperadoraId));
    if (!raw) return [];
    const historial = JSON.parse(raw) as ModificacionConcesionKiosco[];
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
}

export async function registrarModificacionConcesionKiosco(
  cooperadoraId: string,
  datos: ConcesionKiosco,
  actor: ActorConcesion,
) {
  const registro: ModificacionConcesionKiosco = {
    id: `demo-concesion-${Date.now()}`,
    datos,
    usuario_id: actor.id,
    usuario_nombre: actor.nombre,
    usuario_email: actor.email,
    modificado_en: new Date().toISOString(),
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<ModificacionConcesionKiosco>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/historial`,
      {
        method: "POST",
        body: JSON.stringify({ datos, modificado_por: actor }),
      },
    );
  }

  let historial: ModificacionConcesionKiosco[] = [];
  try {
    const raw = localStorage.getItem(claveHistorial(cooperadoraId));
    const existente = raw ? (JSON.parse(raw) as ModificacionConcesionKiosco[]) : [];
    if (Array.isArray(existente)) historial = existente;
  } catch {
    historial = [];
  }

  historial = [registro, ...historial].slice(0, 50);
  localStorage.setItem(claveHistorial(cooperadoraId), JSON.stringify(historial));
  return registro;
}
