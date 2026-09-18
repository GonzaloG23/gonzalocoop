import { ministerioRequest, usingMinisterioApi } from "./index";
import type { MiembroComision } from "./comision";

export type ActorModificacionComision = {
  id: string;
  nombre: string;
  email: string | null;
};

export type ModificacionComision = {
  id: string;
  miembros: MiembroComision[];
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string | null;
  modificado_en: string;
  tipo: "modificacion" | "mandato";
  fecha_inicio_mandato: string | null;
  fecha_fin_mandato: string | null;
  numero_periodo: number;
};

const DEMO_KEY_PREFIX = "demo-historial-comision-directiva-";

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
}

export async function cargarHistorialComisionDirectiva(
  cooperadoraId: string,
): Promise<ModificacionComision[]> {
  if (usingMinisterioApi()) {
    return ministerioRequest<ModificacionComision[]>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva/historial`,
    );
  }

  try {
    const raw = localStorage.getItem(clave(cooperadoraId));
    if (!raw) return [];
    const historial = JSON.parse(raw) as ModificacionComision[];
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
}

export async function registrarModificacionComisionDirectiva(
  cooperadoraId: string,
  miembros: MiembroComision[],
  actor: ActorModificacionComision,
  mandato: {
    tipo: "modificacion" | "mandato";
    fechaInicioMandato: string | null;
    fechaFinMandato: string | null;
    numeroPeriodo: number;
  },
): Promise<ModificacionComision> {
  const registro: ModificacionComision = {
    id: `demo-comision-${Date.now()}`,
    miembros,
    usuario_id: actor.id,
    usuario_nombre: actor.nombre,
    usuario_email: actor.email,
    modificado_en: new Date().toISOString(),
    tipo: mandato.tipo,
    fecha_inicio_mandato: mandato.fechaInicioMandato,
    fecha_fin_mandato: mandato.fechaFinMandato,
    numero_periodo: mandato.numeroPeriodo,
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<ModificacionComision>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva/historial`,
      {
        method: "POST",
        body: JSON.stringify({
          miembros,
          modificado_por: actor,
          tipo: mandato.tipo,
          fecha_inicio_mandato: mandato.fechaInicioMandato,
          fecha_fin_mandato: mandato.fechaFinMandato,
          numero_periodo: mandato.numeroPeriodo,
        }),
      },
    );
  }

  let historial: ModificacionComision[] = [];
  try {
    const raw = localStorage.getItem(clave(cooperadoraId));
    const existente = raw ? (JSON.parse(raw) as ModificacionComision[]) : [];
    if (Array.isArray(existente)) historial = existente;
  } catch {
    historial = [];
  }

  historial = [registro, ...historial].slice(0, 50);
  localStorage.setItem(clave(cooperadoraId), JSON.stringify(historial));
  return registro;
}
