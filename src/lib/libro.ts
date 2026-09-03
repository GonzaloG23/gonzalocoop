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

/* ------------------------------- cálculos -------------------------------- */

export function calcularEjercicio(
  saldoInicialEjercicio: number,
  periodos: Periodo[],
  movimientos: Movimiento[],
): ResumenMes[] {
  const hoy = new Date();
  const resumen: ResumenMes[] = [];
  let arrastre = saldoInicialEjercicio;

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
