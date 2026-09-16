import { supabaseData, supabaseConfigured } from "./supabase";
import { DEMO_MOVIMIENTOS_KEY } from "./operaciones";

const supabase = supabaseData.client;

export type Tipo = "ingreso" | "egreso";
export type Cooperadora = { id: string; nombre: string; cue: string | null; cuit: string | null; localidad: string | null; ejercicio: number; saldo_inicial_ejercicio: number | string; created_at: string };
export type Periodo = { id: string; cooperadora_id: string; anio: number; mes: number; saldo_inicial_declarado: number | string; estado: string; cerrado_en: string | null };
export type Rubro = { id: string; nombre: string; tipo: Tipo; cooperadora_id: string | null; activo: boolean; orden: number | null };
export type Movimiento = { id: string; cooperadora_id: string; periodo_id: string; fecha: string; tipo: Tipo; rubro_id: string | null; concepto: string; monto: number | string; medio_pago: string | null; comprobante: string | null; proveedor_cuit: string | null; proveedor_razon_social: string | null; tipo_factura: string | null; observaciones: string | null; ajusta_movimiento_id: string | null; motivo_ajuste: string | null; creado_en: string };
export type Contexto = { userId: string; email: string | null; nombre: string; cooperadoraId: string | null; esAuditor: boolean; cooperadora: Cooperadora | null };
export type ParametrosControl = { id: string; dia_limite_cierre: number; tope_egreso: number | string };
export const PARAMETROS_POR_DEFECTO: ParametrosControl = { id: "", dia_limite_cierre: 10, tope_egreso: 500000 };

const DEMO_COOPERADORA_ID = "demo-cooperadora-001";

/** Adaptador de datos del libro. En la migración reemplazará Supabase por la API del Ministerio. */
export async function getSesion() { const { data } = await supabase.auth.getUser(); return data.user ?? null; }

export async function cargarContexto(): Promise<Contexto | null> {
  const { data: userData } = await supabase.auth.getUser(); const user = userData.user; if (!user) return null;
  const [{ data: perfil }, { data: roles }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, email, cooperadora_id").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const cooperadoraId = perfil?.cooperadora_id ?? null;
  let cooperadora: Cooperadora | null = null;
  if (cooperadoraId) { const { data } = await supabase.from("cooperadoras").select("*").eq("id", cooperadoraId).maybeSingle(); cooperadora = (data as Cooperadora | null) ?? null; }
  return { userId: user.id, email: perfil?.email ?? user.email ?? null, nombre: perfil?.nombre || (user.email ?? ""), cooperadoraId, esAuditor: (roles ?? []).some((r) => r.role === "auditor"), cooperadora };
}

export async function cargarEjercicio(cooperadoraId: string, anio: number) {
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) {
    const saldoInicial = 250000;
    const periodos: Periodo[] = Array.from({ length: 12 }, (_, index) => ({
      id: `demo-periodo-${index + 1}`,
      cooperadora_id: DEMO_COOPERADORA_ID,
      anio,
      mes: index + 1,
      saldo_inicial_declarado: saldoInicial,
      estado: "abierto",
      cerrado_en: null,
    }));

    let movimientos: Movimiento[] = [];
    try {
      const guardados = JSON.parse(localStorage.getItem(DEMO_MOVIMIENTOS_KEY) ?? "[]") as Movimiento[];
      movimientos = guardados.filter((movimiento) => movimiento.cooperadora_id === cooperadoraId && movimiento.fecha.startsWith(`${anio}-`));
    } catch {
      movimientos = [];
    }

    return { periodos, movimientos };
  }

  const [{ data: periodos, error: e1 }, { data: movimientos, error: e2 }] = await Promise.all([
    supabase.from("periodos").select("*").eq("cooperadora_id", cooperadoraId).eq("anio", anio).order("mes"),
    supabase.from("movimientos").select("*").eq("cooperadora_id", cooperadoraId).gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`).order("fecha"),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  return { periodos: (periodos ?? []) as Periodo[], movimientos: (movimientos ?? []) as Movimiento[] };
}

const RUBROS_DEMO: Rubro[] = [
  { id: "demo-rubro-ingreso-01", nombre: "Matrícula", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 1 },
  { id: "demo-rubro-ingreso-02", nombre: "Ayuda Escolar/Cooperadora", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 2 },
  { id: "demo-rubro-ingreso-03", nombre: "Beneficios: Loterías, Rifas, Ferias, etc.", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 3 },
  { id: "demo-rubro-ingreso-04", nombre: "Kiosco/Cantina", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 4 },
  { id: "demo-rubro-ingreso-05", nombre: "Venta de Pliegos", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 5 },
  { id: "demo-rubro-ingreso-06", nombre: "Donaciones", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 6 },
  { id: "demo-rubro-ingreso-07", nombre: "Acreditación de interés de cuenta", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 7 },
  { id: "demo-rubro-ingreso-08", nombre: "Certificados voluntarios: Alumno Regular, Permiso de Examen, etc.", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 8 },
  { id: "demo-rubro-ingreso-09", nombre: "Producido de Proyectos Profesionalizantes", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 9 },
  { id: "demo-rubro-ingreso-10", nombre: "Otros Ingresos", tipo: "ingreso", cooperadora_id: null, activo: true, orden: 10 },
];

export async function cargarRubros(cooperadoraId: string | null) {
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) return RUBROS_DEMO;
  const { data, error } = await supabase.from("rubros").select("*").eq("activo", true).order("orden", { ascending: true }); if (error) throw error; return (data ?? []).filter((r) => r.cooperadora_id === null || r.cooperadora_id === cooperadoraId) as Rubro[];
}
export async function cargarTodosLosRubros(cooperadoraId: string | null) { if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) return RUBROS_DEMO; const { data, error } = await supabase.from("rubros").select("*").order("orden", { ascending: true }); if (error) throw error; return (data ?? []).filter((r) => r.cooperadora_id === null || r.cooperadora_id === cooperadoraId) as Rubro[]; }
export async function crearRubro(cooperadoraId: string, nombre: string, tipo: Tipo) { const { error } = await supabase.from("rubros").insert({ cooperadora_id: cooperadoraId, nombre: nombre.trim(), tipo }); if (error) throw error; }
export async function toggleRubro(rubroId: string, activo: boolean) { const { error } = await supabase.from("rubros").update({ activo }).eq("id", rubroId); if (error) throw error; }

export async function asegurarPeriodo(cooperadoraId: string, anio: number, mes: number): Promise<Periodo> {
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) {
    return { id: `demo-periodo-${mes}`, cooperadora_id: DEMO_COOPERADORA_ID, anio, mes, saldo_inicial_declarado: 250000, estado: "abierto", cerrado_en: null };
  }
  const existente = await supabase.from("periodos").select("*").eq("cooperadora_id", cooperadoraId).eq("anio", anio).eq("mes", mes).maybeSingle();
  if (existente.data) return existente.data as Periodo;
  const { data, error } = await supabase.from("periodos").insert({ cooperadora_id: cooperadoraId, anio, mes }).select("*").single(); if (error) throw error; return data as Periodo;
}

export async function cargarParametros(): Promise<ParametrosControl> { if (!supabaseConfigured()) return PARAMETROS_POR_DEFECTO; const { data, error } = await supabase.from("parametros_control").select("id, dia_limite_cierre, tope_egreso").order("created_at").limit(1).maybeSingle(); if (error) throw error; return (data as ParametrosControl | null) ?? PARAMETROS_POR_DEFECTO; }
export async function guardarParametros(p: { id: string; dia_limite_cierre: number; tope_egreso: number }) { if (!supabaseConfigured()) return; if (p.id) { const { error } = await supabase.from("parametros_control").update({ dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso }).eq("id", p.id); if (error) throw error; return; } const { error } = await supabase.from("parametros_control").insert({ dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso }); if (error) throw error; }