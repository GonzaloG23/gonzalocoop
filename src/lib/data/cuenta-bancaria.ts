import { ministerioRequest, usingMinisterioApi } from "./index";

export type CuentaBancariaCooperadora = {
  saldoBancario: number | string;
  asesorDirectorNombre: string;
  asesorDirectorDni: string;
  presidenteNombre: string;
  presidenteDni: string;
  tesoreroNombre: string;
  tesoreroDni: string;
};

const DEMO_CUENTA_BANCARIA_KEY_PREFIX = "demo-cuenta-bancaria-cooperadora-";

function claveCuentaBancaria(cooperadoraId: string) {
  return `${DEMO_CUENTA_BANCARIA_KEY_PREFIX}${cooperadoraId}`;
}

export async function cargarCuentaBancaria(
  cooperadoraId: string,
): Promise<CuentaBancariaCooperadora | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<CuentaBancariaCooperadora | null>(
      `/api/cooperadoras/${cooperadoraId}/cuenta-bancaria`,
    );
  }

  try {
    const raw = localStorage.getItem(claveCuentaBancaria(cooperadoraId));
    if (!raw) return null;
    return JSON.parse(raw) as CuentaBancariaCooperadora;
  } catch {
    return null;
  }
}

export async function guardarCuentaBancaria(
  cooperadoraId: string,
  datos: CuentaBancariaCooperadora,
): Promise<CuentaBancariaCooperadora> {
  const saldoTexto = String(datos.saldoBancario).trim().replace(",", ".");
  const normalizados: CuentaBancariaCooperadora = {
    saldoBancario: Number(saldoTexto),
    asesorDirectorNombre: datos.asesorDirectorNombre.trim(),
    asesorDirectorDni: datos.asesorDirectorDni.replace(/\D/g, "").slice(0, 8),
    presidenteNombre: datos.presidenteNombre.trim(),
    presidenteDni: datos.presidenteDni.replace(/\D/g, "").slice(0, 8),
    tesoreroNombre: datos.tesoreroNombre.trim(),
    tesoreroDni: datos.tesoreroDni.replace(/\D/g, "").slice(0, 8),
  };

  const faltantes: string[] = [];
  if (!normalizados.asesorDirectorNombre) faltantes.push("Nombre y apellido del Asesor/Director");
  if (!/^\d{8}$/.test(normalizados.asesorDirectorDni)) {
    faltantes.push("DNI del Asesor/Director (8 dígitos)");
  }
  if (!normalizados.presidenteNombre) faltantes.push("Nombre y apellido del Presidente");
  if (!/^\d{8}$/.test(normalizados.presidenteDni)) {
    faltantes.push("DNI del Presidente (8 dígitos)");
  }
  if (!normalizados.tesoreroNombre) faltantes.push("Nombre y apellido del Tesorero");
  if (!/^\d{8}$/.test(normalizados.tesoreroDni)) {
    faltantes.push("DNI del Tesorero (8 dígitos)");
  }
  if (!saldoTexto || !Number.isFinite(normalizados.saldoBancario) || normalizados.saldoBancario < 0) {
    faltantes.push("Saldo depositado en la cuenta bancaria");
  }

  if (faltantes.length > 0) {
    throw new Error(`Completá correctamente los datos de la cuenta bancaria: ${faltantes.join(", ")}.`);
  }

  if (usingMinisterioApi()) {
    return ministerioRequest<CuentaBancariaCooperadora>(
      `/api/cooperadoras/${cooperadoraId}/cuenta-bancaria`,
      {
        method: "PUT",
        body: JSON.stringify({ datos: normalizados }),
      },
    );
  }

  localStorage.setItem(claveCuentaBancaria(cooperadoraId), JSON.stringify(normalizados));
  return normalizados;
}
