import { supabaseData, supabaseConfigured } from "./supabase";
import type { Cooperadora } from "@/lib/libro";

const supabase = supabaseData.client;

const DEMO_COOPERADORA = {
  id: "demo-cooperadora-001",
  nombre: "Cooperadora de Prueba",
  cue: "9000001",
  cuit: "30-99999999-9",
  localidad: "San Miguel de Tucumán",
  ejercicio: 2026,
  saldo_inicial_ejercicio: 250000,
  created_at: "2026-01-01T00:00:00.000Z",
};

/**
 * Operaciones de auditoría.
 *
 * Este módulo funciona como adaptador para que las pantallas de auditoría no
 * dependan directamente de las tablas o RPC de Supabase. Más adelante, estas
 * funciones podrán delegar en la API del Ministerio sin cambiar las pantallas.
 */
export async function cargarCooperadorasAuditoria() {
  if (!supabaseConfigured()) return [DEMO_COOPERADORA];

  const { data, error } = await supabase
    .from("cooperadoras")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function cargarCooperadoraAuditoria(id: string): Promise<Cooperadora | null> {
  if (!supabaseConfigured()) {
    return id === DEMO_COOPERADORA.id ? (DEMO_COOPERADORA as Cooperadora) : null;
  }

  const { data, error } = await supabase
    .from("cooperadoras")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Cooperadora | null) ?? null;
}

export async function otorgarRolAuditor(email: string) {
  if (!supabaseConfigured()) {
    throw new Error("La habilitación de otros auditores se conectará al backend del Ministerio.");
  }

  const { error } = await supabase.rpc("otorgar_rol_auditor", { _email: email });
  if (error) throw error;
}

export async function reclamarRolAuditor() {
  if (!supabaseConfigured()) return;

  const { error } = await supabase.rpc("reclamar_rol_auditor");
  if (error) throw error;
}
