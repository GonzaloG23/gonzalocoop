import { supabaseData } from "./supabase";
import type { Cooperadora } from "@/lib/libro";

const supabase = supabaseData.client;

/**
 * Operaciones de auditoría.
 *
 * Este módulo funciona como adaptador para que las pantallas de auditoría no
 * dependan directamente de las tablas o RPC de Supabase. Más adelante, estas
 * funciones podrán delegar en la API del Ministerio sin cambiar las pantallas.
 */
export async function cargarCooperadorasAuditoria() {
  const { data, error } = await supabase
    .from("cooperadoras")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function cargarCooperadoraAuditoria(id: string): Promise<Cooperadora | null> {
  const { data, error } = await supabase
    .from("cooperadoras")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Cooperadora | null) ?? null;
}

export async function otorgarRolAuditor(email: string) {
  const { error } = await supabase.rpc("otorgar_rol_auditor", { _email: email });
  if (error) throw error;
}

export async function reclamarRolAuditor() {
  const { error } = await supabase.rpc("reclamar_rol_auditor");
  if (error) throw error;
}
