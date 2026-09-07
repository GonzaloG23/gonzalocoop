import { supabase } from "@/integrations/supabase/client";
import { num } from "./formato";

export type Tipo = "ingreso" | "egreso";

export type Cooperadora = {
  id: string;
  nombre: string;
  cue: string | null;
  cuit: string | null;
  localidad: string | null;
  ejercicio: number;
  saldo_inicial_ejercicio: number | string;
  created_at: string;
};

export type Periodo = {
  id: string;
  cooperadora_id: string;
  anio: number;
  mes: number;
  saldo_inicial_declarado: number | string;
  estado: string;
  cerrado_en: string | null;
};

export type Rubro = { id: string; nombre: string; tipo: Tipo; cooperadora_id: string | null; activo: boolean };

export type Movimiento = {
  id: string;
  cooperadora_id: string;
  periodo_id: string;
  fecha: string;
  tipo: Tipo;
  rubro_id: string | null;
  concepto: string;
  monto: number | string;
  medio_pago: string | null;
  comprobante: string | null;
  observaciones: string | null;
  ajusta_movimiento_id: string | null;
  motivo_ajuste: string | null;
  creado_en: string;
};

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

/* ------------------------------- consultas ------------------------------- */

export async function getSesion() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export type Contexto = {
  userId: string;
  email: string | null;
  nombre: string;
  cooperadoraId: string | null;
  esAuditor: boolean;
  cooperadora: Cooperadora | null;
};

export async function cargarContexto(): Promise<Contexto | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: perfil }, { data: roles }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, email, cooperadora_id").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const cooperadoraId = perfil?.cooperadora_id ?? null;
  let cooperadora: Cooperadora | null = null;
  if (cooperadoraId) {
    const { data } = await supabase.from("cooperadoras").select("*").eq("id", cooperadoraId).maybeSingle();
    cooperadora = (data as Cooperadora | null) ?? null;
  }

  return {
    userId: user.id,
    email: perfil?.email ?? user.email ?? null,
    nombre: perfil?.nombre || (user.email ?? ""),
    cooperadoraId,
    esAuditor: (roles ?? []).some((r) => r.role === "auditor"),
    cooperadora,
  };
}

export async function cargarEjercicio(cooperadoraId: string, anio: number) {
  const [{ data: periodos, error: e1 }, { data: movimientos, error: e2 }] = await Promise.all([
    supabase.from("periodos").select("*").eq("cooperadora_id", cooperadoraId).eq("anio", anio).order("mes"),
    supabase
      .from("movimientos")
      .select("*")
      .eq("cooperadora_id", cooperadoraId)
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`)
      .order("fecha"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    periodos: (periodos ?? []) as Periodo[],
    movimientos: (movimientos ?? []) as Movimiento[],
  };
}

export async function cargarRubros(cooperadoraId: string | null) {
  const { data, error } = await supabase.from("rubros").select("*").eq("activo", true).order("nombre");
  if (error) throw error;
  return (data ?? []).filter(
    (r) => r.cooperadora_id === null || r.cooperadora_id === cooperadoraId,
  ) as Rubro[];
}

/** Devuelve el periodo del mes, creándolo si todavía no existe. */
export async function asegurarPeriodo(cooperadoraId: string, anio: number, mes: number): Promise<Periodo> {
  const existente = await supabase
    .from("periodos")
    .select("*")
    .eq("cooperadora_id", cooperadoraId)
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();
  if (existente.data) return existente.data as Periodo;

  const { data, error } = await supabase
    .from("periodos")
    .insert({ cooperadora_id: cooperadoraId, anio, mes })
    .select("*")
    .single();
  if (error) throw error;
  return data as Periodo;
}

/* ----------------------------- parámetros -------------------------------- */

export type ParametrosControl = {
  id: string;
  dia_limite_cierre: number;
  tope_egreso: number | string;
};

export const PARAMETROS_POR_DEFECTO: ParametrosControl = {
  id: "",
  dia_limite_cierre: 10,
  tope_egreso: 500000,
};

export async function cargarParametros(): Promise<ParametrosControl> {
  const { data, error } = await supabase
    .from("parametros_control")
    .select("id, dia_limite_cierre, tope_egreso")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ParametrosControl | null) ?? PARAMETROS_POR_DEFECTO;
}

export async function guardarParametros(p: {
  id: string;
  dia_limite_cierre: number;
  tope_egreso: number;
}) {
  if (p.id) {
    const { error } = await supabase
      .from("parametros_control")
      .update({ dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso })
      .eq("id", p.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("parametros_control")
    .insert({ dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso });
  if (error) throw error;
}

/* ------------------------------- cálculos -------------------------------- */

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

  // comprobantes repetidos dentro del ejercicio
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
    if (periodo && num(periodo.saldo_inicial_declarado) !== 0) {
      if (Math.abs(num(periodo.saldo_inicial_declarado) - saldoInicial) > 0.009) {
        alertas.push("El saldo inicial declarado no coincide con el saldo final del mes anterior");
      }
    }
    const anioResumen = periodos[0]?.anio ?? hoy.getFullYear();
    const mesYaTranscurrido =
      anioResumen < hoy.getFullYear() || (anioResumen === hoy.getFullYear() && mes <= hoy.getMonth() + 1);
    if (mesYaTranscurrido && movs.length === 0 && (!periodo || periodo.estado === "abierto")) {
      alertas.push("Mes sin rendición");
    }
    if (movs.some((m) => m.tipo === "egreso" && !m.comprobante?.trim())) {
      alertas.push("Hay egresos sin número de comprobante");
    }

    // 1. cierre fuera de plazo
    if (periodo?.estado === "cerrado" && periodo.cerrado_en) {
      const limite = new Date(Date.UTC(anioResumen, mes, diaLimite, 23, 59, 59));
      const cierre = new Date(periodo.cerrado_en);
      if (cierre.getTime() > limite.getTime()) {
        const dias = Math.ceil((cierre.getTime() - limite.getTime()) / 86_400_000);
        alertas.push(
          `Mes cerrado fuera de plazo (${dias} día${dias === 1 ? "" : "s"} después del ${diaLimite} del mes siguiente)`,
        );
      }
    }

    // 2. gastos por encima del tope
    if (tope > 0) {
      const excedidos = movs.filter((m) => m.tipo === "egreso" && num(m.monto) > tope);
      for (const m of excedidos) {
        alertas.push(`Gasto que supera el tope: ${m.concepto} por ${num(m.monto).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 })}`);
      }
    }

    // 3. comprobantes repetidos
    const repetidos = Array.from(
      new Set(
        movs
          .filter((m) => clave(m.comprobante) && (conteo.get(clave(m.comprobante)) ?? 0) > 1)
          .map((m) => (m.comprobante ?? "").trim()),
      ),
    );
    for (const c of repetidos) {
      alertas.push(`Comprobante repetido: N° ${c} figura en más de un movimiento`);
    }

    // 4. ajustes contables del mes
    const ajustes = movs.filter((m) => m.ajusta_movimiento_id).length;
    if (ajustes > 0) {
      alertas.push(`${ajustes} ajuste${ajustes === 1 ? "" : "s"} contable${ajustes === 1 ? "" : "s"} en el mes`);
    }

    resumen.push({
      mes,
      periodo,
      saldoInicial,
      ingresos,
      egresos,
      saldoFinal,
      cantidad: movs.length,
      alertas,
    });
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
