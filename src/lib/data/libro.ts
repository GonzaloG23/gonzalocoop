import { supabaseData } from "./supabase";
import type {
  Cooperadora,
  Contexto,
  Movimiento,
  ParametrosControl,
  Periodo,
  Rubro,
  Tipo,
} from "@/lib/libro";

const supabase = supabaseData.client;

/**
 * Acceso a datos del libro.
 *
 * Este módulo concentra las consultas que hoy usan Supabase. En la migración
 * al Ministerio, este es uno de los adaptadores que podrá reemplazarse por
 * llamadas a la API institucional sin tocar los cálculos ni las pantallas.
 */

export async function getSesion() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

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

export async function cargarTodosLosRubros(cooperadoraId: string | null) {
  const { data, error } = await supabase.from("rubros").select("*").order("tipo").order("nombre");
  if (error) throw error;
  return (data ?? []).filter(
    (r) => r.cooperadora_id === null || r.cooperadora_id === cooperadoraId,
  ) as Rubro[];
}

export async function crearRubro(cooperadoraId: string, nombre: string, tipo: Tipo) {
  const { error } = await supabase
    .from("rubros")
    .insert({ cooperadora_id: cooperadoraId, nombre: nombre.trim(), tipo });
  if (error) throw error;
}

export async function toggleRubro(rubroId: string, activo: boolean) {
  const { error } = await supabase.from("rubros").update({ activo }).eq("id", rubroId);
  if (error) throw error;
}

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

export async function cargarParametros(): Promise<ParametrosControl> {
  const { data, error } = await supabase
    .from("parametros_control")
    .select("id, dia_limite_cierre, tope_egreso")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ParametrosControl | null;
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
