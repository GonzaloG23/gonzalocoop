import { supabaseData, supabaseConfigured } from "./supabase";
import { usingMinisterioApi, ministerioRequest } from "./index";
import { DEMO_MOVIMIENTOS_KEY, DEMO_PERIODOS_CERRADOS_KEY } from "./operaciones";

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
const DEMO_RUBROS_KEY = "demo-rubros";
const DEMO_RUBROS_SEED_KEY = "demo-rubros-seed-v2";
const DEMO_PARAMETROS_KEY = "demo-parametros";

export async function getSesion() { const { data } = await supabase.auth.getUser(); return data.user ?? null; }
export async function cargarContexto(): Promise<Contexto | null> { const { data: userData } = await supabase.auth.getUser(); const user = userData.user; if (!user) return null; const [{ data: perfil }, { data: roles }] = await Promise.all([supabase.from("perfiles").select("id, nombre, email, cooperadora_id").eq("id", user.id).maybeSingle(), supabase.from("user_roles").select("role").eq("user_id", user.id)]); const cooperadoraId = perfil?.cooperadora_id ?? null; let cooperadora: Cooperadora | null = null; if (cooperadoraId) { const { data } = await supabase.from("cooperadoras").select("*").eq("id", cooperadoraId).maybeSingle(); cooperadora = (data as Cooperadora | null) ?? null; } return { userId: user.id, email: perfil?.email ?? user.email ?? null, nombre: perfil?.nombre || (user.email ?? ""), cooperadoraId, cooperadora, esAuditor: (roles ?? []).some((r) => r.role === "auditor") }; }

export async function cargarEjercicio(cooperadoraId: string, anio: number) {
  if (usingMinisterioApi()) return ministerioRequest<{ periodos: Periodo[]; movimientos: Movimiento[] }>(`/api/cooperadoras/${cooperadoraId}/ejercicio/${anio}`);
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) { const saldoInicial = 250000; let cerrados: string[] = []; try { cerrados = JSON.parse(localStorage.getItem(DEMO_PERIODOS_CERRADOS_KEY) ?? "[]") as string[]; } catch { cerrados = []; } const periodos: Periodo[] = Array.from({ length: 12 }, (_, index) => { const id = `demo-periodo-${index + 1}`; const estaCerrado = cerrados.includes(id); return { id, cooperadora_id: DEMO_COOPERADORA_ID, anio, mes: index + 1, saldo_inicial_declarado: saldoInicial, estado: estaCerrado ? "cerrado" : "abierto", cerrado_en: estaCerrado ? new Date().toISOString() : null }; }); let movimientos: Movimiento[] = []; try { const guardados = JSON.parse(localStorage.getItem(DEMO_MOVIMIENTOS_KEY) ?? "[]") as Movimiento[]; movimientos = guardados.filter((movimiento) => movimiento.cooperadora_id === cooperadoraId && movimiento.fecha.startsWith(`${anio}-`)); } catch { movimientos = []; } return { periodos, movimientos }; } const [{ data: periodos, error: e1 }, { data: movimientos, error: e2 }] = await Promise.all([supabase.from("periodos").select("*").eq("cooperadora_id", cooperadoraId).eq("anio", anio).order("mes"), supabase.from("movimientos").select("*").eq("cooperadora_id", cooperadoraId).gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`).order("fecha")]); if (e1) throw e1; if (e2) throw e2; return { periodos: (periodos ?? []) as Periodo[], movimientos: (movimientos ?? []) as Movimiento[] }; }

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
  { id: "demo-rubro-egreso-01", nombre: "Refacciones y mantenimiento", tipo: "egreso", cooperadora_id: null, activo: true, orden: 11 },
  { id: "demo-rubro-egreso-02", nombre: "Útiles y material didáctico", tipo: "egreso", cooperadora_id: null, activo: true, orden: 12 },
  { id: "demo-rubro-egreso-03", nombre: "Servicios", tipo: "egreso", cooperadora_id: null, activo: true, orden: 13 },
  { id: "demo-rubro-egreso-04", nombre: "Limpieza", tipo: "egreso", cooperadora_id: null, activo: true, orden: 14 },
  { id: "demo-rubro-egreso-05", nombre: "Equipamiento", tipo: "egreso", cooperadora_id: null, activo: true, orden: 15 },
  { id: "demo-rubro-egreso-06", nombre: "Gastos bancarios", tipo: "egreso", cooperadora_id: null, activo: true, orden: 16 },
  { id: "demo-rubro-egreso-07", nombre: "Otros Egresos", tipo: "egreso", cooperadora_id: null, activo: true, orden: 17 },
];

function cargarRubrosDemoGuardados(): Rubro[] {
  try {
    const guardados = JSON.parse(localStorage.getItem(DEMO_RUBROS_KEY) ?? "null") as Rubro[] | null;
    if (!Array.isArray(guardados)) return RUBROS_DEMO;
    if (localStorage.getItem(DEMO_RUBROS_SEED_KEY) !== "1") {
      const idsExistentes = new Set(guardados.map((r) => r.id));
      const faltantes = RUBROS_DEMO.filter((r) => !idsExistentes.has(r.id));
      if (faltantes.length) {
        const actualizados = [...guardados, ...faltantes];
        localStorage.setItem(DEMO_RUBROS_KEY, JSON.stringify(actualizados));
        localStorage.setItem(DEMO_RUBROS_SEED_KEY, "1");
        return actualizados;
      }
      localStorage.setItem(DEMO_RUBROS_SEED_KEY, "1");
    }
    return guardados;
  } catch {
    return RUBROS_DEMO;
  }
}

export async function cargarRubros(cooperadoraId: string | null) {
  if (usingMinisterioApi()) { if (!cooperadoraId) return []; return ministerioRequest<Rubro[]>(`/api/cooperadoras/${cooperadoraId}/rubros`); }
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) return cargarRubrosDemoGuardados().filter((r) => r.activo); const { data, error } = await supabase.from("rubros").select("*").eq("activo", true).order("orden", { ascending: true }); if (error) throw error; return (data ?? []).filter((r) => r.cooperadora_id === null || r.cooperadora_id === cooperadoraId) as Rubro[];
}

export async function cargarTodosLosRubros(cooperadoraId: string | null) {
  if (usingMinisterioApi()) { if (!cooperadoraId) return []; return ministerioRequest<Rubro[]>(`/api/cooperadoras/${cooperadoraId}/rubros`); }
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) return cargarRubrosDemoGuardados(); const { data, error } = await supabase.from("rubros").select("*").order("orden", { ascending: true }); if (error) throw error; return (data ?? []).filter((r) => r.cooperadora_id === null || r.cooperadora_id === cooperadoraId) as Rubro[];
}

export async function crearRubro(cooperadoraId: string, nombre: string, tipo: Tipo) {
  const nombreLimpio = nombre.trim(); if (!nombreLimpio) throw new Error("El nombre del rubro no puede estar vacío.");
  if (usingMinisterioApi()) return ministerioRequest<Rubro>(`/api/cooperadoras/${cooperadoraId}/rubros`, { method: "POST", body: JSON.stringify({ nombre: nombreLimpio, tipo }) });
  if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) { const actuales = cargarRubrosDemoGuardados(); const nuevo: Rubro = { id: `demo-rubro-${Date.now()}`, nombre: nombreLimpio, tipo, cooperadora_id: cooperadoraId, activo: true, orden: actuales.length + 1 }; actuales.push(nuevo); localStorage.setItem(DEMO_RUBROS_KEY, JSON.stringify(actuales)); return nuevo; } const { data, error } = await supabase.from("rubros").insert({ cooperadora_id: cooperadoraId, nombre: nombreLimpio, tipo }).select("*").single(); if (error) throw error; return data as Rubro;
}

export async function actualizarRubro(rubroId: string, nombre: string, tipo: Tipo) {
  const nombreLimpio = nombre.trim(); if (!nombreLimpio) throw new Error("El nombre del rubro no puede estar vacío.");
  if (usingMinisterioApi()) return ministerioRequest<Rubro>(`/api/rubros/${rubroId}`, { method: "PATCH", body: JSON.stringify({ nombre: nombreLimpio, tipo }) });
  if (!supabaseConfigured() && rubroId.startsWith("demo-rubro-")) { const actuales = cargarRubrosDemoGuardados(); localStorage.setItem(DEMO_RUBROS_KEY, JSON.stringify(actuales.map((rubro) => rubro.id === rubroId ? { ...rubro, nombre: nombreLimpio, tipo } : rubro))); return; } const { error } = await supabase.from("rubros").update({ nombre: nombreLimpio, tipo }).eq("id", rubroId); if (error) throw error;
}

export async function eliminarRubro(rubroId: string) {
  if (usingMinisterioApi()) return ministerioRequest<void>(`/api/rubros/${rubroId}`, { method: "PATCH", body: JSON.stringify({ activo: false }) });
  if (!supabaseConfigured() && rubroId.startsWith("demo-rubro-")) { const actuales = cargarRubrosDemoGuardados(); localStorage.setItem(DEMO_RUBROS_KEY, JSON.stringify(actuales.filter((rubro) => rubro.id !== rubroId))); return; } const { error } = await supabase.from("rubros").delete().eq("id", rubroId); if (error) throw error;
}

export async function toggleRubro(rubroId: string, activo: boolean) {
  if (usingMinisterioApi()) return ministerioRequest<Rubro>(`/api/rubros/${rubroId}`, { method: "PATCH", body: JSON.stringify({ activo }) });
  if (!supabaseConfigured() && rubroId.startsWith("demo-rubro-")) { const actuales = cargarRubrosDemoGuardados(); localStorage.setItem(DEMO_RUBROS_KEY, JSON.stringify(actuales.map((rubro) => rubro.id === rubroId ? { ...rubro, activo } : rubro))); return; } const { error } = await supabase.from("rubros").update({ activo }).eq("id", rubroId); if (error) throw error;
}

export async function asegurarPeriodo(cooperadoraId: string, anio: number, mes: number): Promise<Periodo> { if (!supabaseConfigured() && cooperadoraId === DEMO_COOPERADORA_ID) { let cerrados: string[] = []; try { cerrados = JSON.parse(localStorage.getItem(DEMO_PERIODOS_CERRADOS_KEY) ?? "[]") as string[]; } catch { cerrados = []; } const id = `demo-periodo-${mes}`; const estaCerrado = cerrados.includes(id); return { id, cooperadora_id: DEMO_COOPERADORA_ID, anio, mes, saldo_inicial_declarado: 250000, estado: estaCerrado ? "cerrado" : "abierto", cerrado_en: estaCerrado ? new Date().toISOString() : null }; } const existente = await supabase.from("periodos").select("*").eq("cooperadora_id", cooperadoraId).eq("anio", anio).eq("mes", mes).maybeSingle(); if (existente.data) return existente.data as Periodo; const { data, error } = await supabase.from("periodos").insert({ cooperadora_id: cooperadoraId, anio, mes }).select("*").single(); if (error) throw error; return data as Periodo; }

export async function cargarParametros(): Promise<ParametrosControl> {
  if (usingMinisterioApi()) return ministerioRequest<ParametrosControl>("/api/parametros-control");
  if (!supabaseConfigured()) { try { const guardados = JSON.parse(localStorage.getItem(DEMO_PARAMETROS_KEY) ?? "null") as ParametrosControl | null; if (guardados && Number.isFinite(Number(guardados.dia_limite_cierre)) && Number.isFinite(Number(guardados.tope_egreso))) return guardados; } catch {} return PARAMETROS_POR_DEFECTO; } const { data, error } = await supabase.from("parametros_control").select("id, dia_limite_cierre, tope_egreso").order("created_at").limit(1).maybeSingle(); if (error) throw error; return (data as ParametrosControl | null) ?? PARAMETROS_POR_DEFECTO;
}

export async function guardarParametros(p: { id: string; dia_limite_cierre: number; tope_egreso: number }) {
  if (usingMinisterioApi()) return ministerioRequest<ParametrosControl>("/api/parametros-control", { method: "PATCH", body: JSON.stringify({ id: p.id, dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso }) });
  if (!supabaseConfigured()) { const parametros: ParametrosControl = { id: p.id || "demo-parametros", dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso }; localStorage.setItem(DEMO_PARAMETROS_KEY, JSON.stringify(parametros)); return; } if (p.id) { const { error } = await supabase.from("parametros_control").update({ dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso }).eq("id", p.id); if (error) throw error; return; } const { error } = await supabase.from("parametros_control").insert({ dia_limite_cierre: p.dia_limite_cierre, tope_egreso: p.tope_egreso }); if (error) throw error; }