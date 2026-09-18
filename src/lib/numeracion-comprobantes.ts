const FORMATO = /^(\d{5})-(\d{9})$/;

export type ComprobanteNumerable = {
  comprobante: string | null;
};

export function formatearNumeroComprobanteIngreso(secuencia: number) {
  if (!Number.isInteger(secuencia) || secuencia < 1 || secuencia > 999999999) {
    throw new Error("Se alcanzó el límite de numeración de comprobantes.");
  }

  return `00000-${String(secuencia).padStart(9, "0")}`;
}

export function siguienteNumeroComprobanteIngreso(
  movimientos: ComprobanteNumerable[],
) {
  let mayor = 0;

  for (const movimiento of movimientos) {
    const comprobante = movimiento.comprobante?.trim() ?? "";
    const match = comprobante.match(FORMATO);
    if (!match) continue;

    const secuencia = Number(match[2]);
    if (Number.isInteger(secuencia)) mayor = Math.max(mayor, secuencia);
  }

  return formatearNumeroComprobanteIngreso(mayor + 1);
}
