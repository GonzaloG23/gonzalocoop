import { ministerioRequest, usingMinisterioApi } from "./index";

export type MotivoAperturaCuenta = "saldo_minimo" | "concesion_kiosco";

export type AperturaCuentaBancaria = {
  fechaNotificacion: string;
  fechaVencimiento: string;
  motivos: MotivoAperturaCuenta[];
};

const DEMO_KEY_PREFIX = "demo-apertura-cuenta-bancaria-";

const DIAS_INHABILES_TUCUMAN_2026 = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-03-23",
  "2026-03-24",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-25",
  "2026-06-15",
  "2026-06-20",
  "2026-07-09",
  "2026-07-10",
  "2026-08-17",
  "2026-09-24",
  "2026-10-12",
  "2026-11-23",
  "2026-12-07",
  "2026-12-08",
  "2026-12-25",
]);

function clave(cooperadoraId: string) {
  return `${DEMO_KEY_PREFIX}${cooperadoraId}`;
}

function fechaIsoLocal(fecha: Date) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function esDiaHabil(fecha: Date) {
  const diaSemana = fecha.getDay();
  if (diaSemana === 0 || diaSemana === 6) return false;

  const iso = fechaIsoLocal(fecha);
  if (fecha.getFullYear() === 2026 && DIAS_INHABILES_TUCUMAN_2026.has(iso)) return false;

  return true;
}

export function sumarDiasHabiles(fechaInicio: Date, cantidad: number) {
  const fecha = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
  let acumulados = 0;

  while (acumulados < cantidad) {
    fecha.setDate(fecha.getDate() + 1);
    if (esDiaHabil(fecha)) acumulados += 1;
  }

  return fecha;
}

export function calcularVencimientoAperturaCuenta(fechaNotificacion: string | Date) {
  const inicio =
    typeof fechaNotificacion === "string"
      ? new Date(`${fechaNotificacion}T00:00:00`)
      : fechaNotificacion;

  return sumarDiasHabiles(inicio, 5);
}

export async function cargarAperturaCuentaBancaria(
  cooperadoraId: string,
): Promise<AperturaCuentaBancaria | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<AperturaCuentaBancaria | null>(
      `/api/cooperadoras/${cooperadoraId}/apertura-cuenta-bancaria`,
    );
  }

  try {
    const raw = localStorage.getItem(clave(cooperadoraId));
    return raw ? (JSON.parse(raw) as AperturaCuentaBancaria) : null;
  } catch {
    return null;
  }
}

export async function asegurarPlazoAperturaCuenta(
  cooperadoraId: string,
  motivos: MotivoAperturaCuenta[],
  hoy = new Date(),
): Promise<AperturaCuentaBancaria> {
  const motivosUnicos = Array.from(new Set(motivos));

  if (motivosUnicos.length === 0) {
    throw new Error("No hay un motivo que obligue a la apertura de una cuenta bancaria.");
  }

  const existente = await cargarAperturaCuentaBancaria(cooperadoraId);
  if (existente) {
    const motivosActualizados = Array.from(new Set([...existente.motivos, ...motivosUnicos]));
    if (motivosActualizados.length === existente.motivos.length) return existente;

    const actualizado: AperturaCuentaBancaria = {
      ...existente,
      motivos: motivosActualizados,
    };

    if (usingMinisterioApi()) {
      return ministerioRequest<AperturaCuentaBancaria>(
        `/api/cooperadoras/${cooperadoraId}/apertura-cuenta-bancaria`,
        {
          method: "PATCH",
          body: JSON.stringify({ motivos: motivosActualizados }),
        },
      );
    }

    localStorage.setItem(clave(cooperadoraId), JSON.stringify(actualizado));
    return actualizado;
  }

  const fechaNotificacion = fechaIsoLocal(hoy);
  const fechaVencimiento = fechaIsoLocal(calcularVencimientoAperturaCuenta(hoy));

  const nueva: AperturaCuentaBancaria = {
    fechaNotificacion,
    fechaVencimiento,
    motivos: motivosUnicos,
  };

  if (usingMinisterioApi()) {
    return ministerioRequest<AperturaCuentaBancaria>(
      `/api/cooperadoras/${cooperadoraId}/apertura-cuenta-bancaria`,
      {
        method: "POST",
        body: JSON.stringify(nueva),
      },
    );
  }

  localStorage.setItem(clave(cooperadoraId), JSON.stringify(nueva));
  return nueva;
}

export function aperturaCuentaVencida(
  apertura: AperturaCuentaBancaria,
  hoy = new Date(),
) {
  const vencimiento = new Date(`${apertura.fechaVencimiento}T23:59:59`);
  return hoy.getTime() > vencimiento.getTime();
}
