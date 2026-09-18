const FORMATO = /^(\d{5})-(\d{9})$/;
const MAX_PREFIJO = 99999;
const MAX_SECUENCIA = 999999999;

export type ComprobanteNumerable = {
  comprobante: string | null;
};

export function formatearNumeroComprobanteIngreso(
  secuencia: number,
  prefijo = 0,
) {
  if (
    !Number.isInteger(secuencia) ||
    secuencia < 1 ||
    secuencia > MAX_SECUENCIA ||
    !Number.isInteger(prefijo) ||
    prefijo < 0 ||
    prefijo > MAX_PREFIJO
  ) {
    throw new Error("Se alcanzó el límite de numeración de comprobantes.");
  }

  return `${String(prefijo).padStart(5, "0")}-${String(secuencia).padStart(9, "0")}`;
}

export function siguienteNumeroComprobanteIngreso(
  movimientos: ComprobanteNumerable[],
) {
  let mayorPrefijo = 0;
  let mayorSecuencia = 0;

  for (const movimiento of movimientos) {
    const comprobante = movimiento.comprobante?.trim() ?? "";
    const match = comprobante.match(FORMATO);
    if (!match) continue;

    const prefijo = Number(match[1]);
    const secuencia = Number(match[2]);

    if (
      !Number.isInteger(prefijo) ||
      !Number.isInteger(secuencia) ||
      prefijo < 0 ||
      prefijo > MAX_PREFIJO ||
      secuencia < 1 ||
      secuencia > MAX_SECUENCIA
    ) {
      continue;
    }

    if (
      prefijo > mayorPrefijo ||
      (prefijo === mayorPrefijo && secuencia > mayorSecuencia)
    ) {
      mayorPrefijo = prefijo;
      mayorSecuencia = secuencia;
    }
  }

  if (mayorSecuencia < MAX_SECUENCIA) {
    return formatearNumeroComprobanteIngreso(
      mayorSecuencia + 1,
      mayorPrefijo,
    );
  }

  if (mayorPrefijo < MAX_PREFIJO) {
    return formatearNumeroComprobanteIngreso(1, mayorPrefijo + 1);
  }

  throw new Error("Se alcanzó el límite total de numeración de comprobantes.");
}
