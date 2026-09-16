import { num } from "./formato";
import {
  getSesion,
  cargarContexto,
  cargarEjercicio,
  cargarRubros,
  cargarTodosLosRubros,
  crearRubro,
  actualizarRubro,
  eliminarRubro,
  toggleRubro,
  asegurarPeriodo,
  cargarParametros,
  guardarParametros,
  PARAMETROS_POR_DEFECTO,
} from "./data/libro";

export type {
  Tipo,
  Cooperadora,
  Periodo,
  Rubro,
  Movimiento,
  Contexto,
  ParametrosControl,
} from "./data/libro";

export {
  getSesion,
  cargarContexto,
  cargarEjercicio,
  cargarRubros,
  cargarTodosLosRubros,
  crearRubro,
  actualizarRubro,
  eliminarRubro,
  toggleRubro,
  asegurarPeriodo,
  cargarParametros,
  guardarParametros,
  PARAMETROS_POR_DEFECTO,
};

import type { Movimiento, Periodo, ParametrosControl } from "./data/libro";

export const TIPOS_FACTURA = [
  { valor: "B", etiqueta: "Factura B" },
  { valor: "C", etiqueta: "Factura C" },
  { valor: "ticket", etiqueta: "Ticket factura" },
] as const;

export function etiquetaFactura(valor: string | null | undefined) {
  return TIPOS_FACTURA.find((t) => t.valor === valor)?.etiqueta ?? "";
}

export type ResumenMes = {
  mes: number;
  periodo: Periodo | null;
  saldoInicial: number;
  ingresos: number;
  egresos: number;
  saldoFinal: number;
  cantidad: number;
  alertas: string[];
};

const clave = (c: string | null) => (c ?? "").trim().toLowerCase();

export function calcularEjercicio(
  saldoInicialEjercicio: number,
  periodos: Periodo[],
  movimientos: Movimiento[],
  parametros: ParametrosControl = PARAMETROS_POR_DEFECTO,
): ResumenMes[] {
  const hoy = new Date();
  const resumen: ResumenMes[] = [];
  let arrastre = saldoInicialEjercicio;
  const diaLimite = Number(parametros.dia_limite_cierre) || 10;
  const tope = num(parametros.tope_egreso);

  const conteo = new Map<string, number>();
  for (const m of movimientos) {
    const k = clave(m.comprobante);
    if (!k) continue;
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }

  for (let mes = 1; mes <= 12; mes++) {
    const periodo = periodos.find((p) => p.mes === mes) ?? null;
    const movs = movimientos.filter((m) => Number(m.fecha.slice(5, 7)) === mes);
    const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + num(m.monto), 0);
    const egresos = movs.filter((m) => m.tipo === "egreso").reduce((s, m) => s + num(m.monto), 0);
    const saldoInicial = arrastre;
    const saldoFinal = saldoInicial + ingresos - egresos;
    const alertas: string[] = [];

    if (saldoFinal < 0) alertas.push("Saldo final negativo");
    if (periodo && num(periodo.saldo_inicial_declarado) !== 0 && Math.abs(num(periodo.saldo_inicial_declarado) - saldoInicial) > 0.009) {
      alertas.push("El saldo inicial declarado no coincide con el saldo final del mes anterior");
    }

    const anioResumen = periodos[0]?.anio ?? hoy.getFullYear();
    const mesYaTranscurrido = anioResumen < hoy.getFullYear() || (anioResumen === hoy.getFullYear() && mes <= hoy.getMonth() + 1);
    if (mesYaTranscurrido && movs.length === 0 && (!periodo || periodo.estado === "abierto")) alertas.push("Mes sin rendición");
    if (movs.some((m) => m.tipo === "egreso" && !m.comprobante?.trim())) alertas.push("Hay egresos sin número de comprobante");

    const fueraDeMes = movs.filter((m) => {
      const [a, mo] = m.fecha.slice(0, 7).split("-").map(Number);
      return a !== anioResumen || mo !== mes;
    });
    for (const m of fueraDeMes) alertas.push(`Movimiento con fecha fuera del mes: ${m.concepto} (${m.fecha.slice(0, 10).split("-").reverse().join("/")})`);

    if (periodo?.estado === "cerrado" && periodo.cerrado_en) {
      const limite = new Date(Date.UTC(anioResumen, mes, diaLimite, 23, 59, 59));
      const cierre = new Date(periodo.cerrado_en);
      if (cierre.getTime() > limite.getTime()) {
        const dias = Math.ceil((cierre.getTime() - limite.getTime()) / 86_400_000);
        alertas.push(`Mes cerrado fuera de plazo (${dias} día${dias === 1 ? "" : "s"} después del ${diaLimite} del mes siguiente)`);
      }
    }

    if (tope > 0) {
      for (const m of movs.filter((m) => m.tipo === "egreso" && num(m.monto) > tope)) {
        alertas.push(`Gasto que supera el tope: ${m.concepto} por ${num(m.monto).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 })}`);
      }
    }

    const repetidos = Array.from(new Set(movs.filter((m) => clave(m.comprobante) && (conteo.get(clave(m.comprobante)) ?? 0) > 1).map((m) => (m.comprobante ?? "").trim())));
    for (const c of repetidos) alertas.push(`Comprobante repetido: N° ${c} figura en más de un movimiento`);

    const ajustes = movs.filter((m) => m.ajusta_movimiento_id).length;
    if (ajustes > 0) alertas.push(`${ajustes} ajuste${ajustes === 1 ? "" : "s"} contable${ajustes === 1 ? "" : "s"} en el mes`);

    resumen.push({ mes, periodo, saldoInicial, ingresos, egresos, saldoFinal, cantidad: movs.length, alertas });
    arrastre = saldoFinal;
  }
  return resumen;
}

export function totalesAnuales(resumen: ResumenMes[]) {
  return {
    ingresos: resumen.reduce((s, r) => s + r.ingresos, 0),
    egresos: resumen.reduce((s, r) => s + r.egresos, 0),
    saldoInicial: resumen[0]?.saldoInicial ?? 0,
    saldoFinal: resumen[11]?.saldoFinal ?? 0,
    alertas: resumen.reduce((s, r) => s + r.alertas.length, 0),
  };
}
