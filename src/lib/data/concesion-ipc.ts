import { ministerioRequest, usingMinisterioApi } from "./index";
import {
  calcularProximaActualizacionCanon,
  canonNecesitaActualizacion,
  type ConcesionKiosco,
} from "./concesion";

export type ActualizacionCanonIpc = {
  id: string;
  tipo: "contrato_original" | "prorroga";
  fechaActualizacion: string;
  periodoIpcDesde: string;
  periodoIpcHasta: string;
  indiceIpcDesde: number;
  indiceIpcHasta: number;
  variacionIpc: number;
  canonAnterior: number;
  canonNuevo: number;
  origen: "automatico" | "manual";
  creadoEn: string;
};

export type EstadoActualizacionCanon = {
  canonInicial: number;
  canonVigente: number;
  ultimaActualizacion: string;
  proximaActualizacion: string;
  actualizacionPendiente: boolean;
};

export type EstadoCanonIpc = {
  contratoOriginal: EstadoActualizacionCanon;
  prorroga: EstadoActualizacionCanon | null;
  historial: ActualizacionCanonIpc[];
};

function crearEstado(
  fechaInicio: string,
  canonInicial: number,
  canonVigente: number,
  ultimaActualizacion = "",
): EstadoActualizacionCanon {
  const proximaActualizacion = calcularProximaActualizacionCanon(fechaInicio, ultimaActualizacion);
  return {
    canonInicial,
    canonVigente,
    ultimaActualizacion,
    proximaActualizacion,
    actualizacionPendiente: canonNecesitaActualizacion(proximaActualizacion),
  };
}

function estadoFallback(datos: ConcesionKiosco): EstadoCanonIpc {
  return {
    contratoOriginal: crearEstado(
      datos.fechaFirmaContrato,
      Number(datos.canon),
      Number(datos.canonVigente || datos.canon),
    ),
    prorroga: datos.tieneProrroga
      ? crearEstado(
          datos.fechaInicioProrroga,
          Number(datos.canonProrroga),
          Number(datos.canonProrrogaVigente || datos.canonProrroga),
        )
      : null,
    historial: [],
  };
}

export async function cargarEstadoCanonIpc(
  cooperadoraId: string,
  datos: ConcesionKiosco,
): Promise<EstadoCanonIpc> {
  if (usingMinisterioApi()) {
    try {
      return await ministerioRequest<EstadoCanonIpc>(
        "/api/cooperadoras/" + cooperadoraId + "/concesion-kiosco/canon-ipc",
      );
    } catch {
      // Hasta que el backend del Ministerio publique este endpoint,
      // la interfaz conserva un cálculo local basado en las fechas contractuales.
      return estadoFallback(datos);
    }
  }

  return estadoFallback(datos);
}
