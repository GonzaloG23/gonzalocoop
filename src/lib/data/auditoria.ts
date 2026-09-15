import { supabaseData } from "./supabase";

const supabase = supabaseData.client;

/**
 * Operaciones de auditoría. Actualmente usan Supabase; en la migración
 * serán implementadas por la API del Ministerio.
 */
export async function cargarCooperadorasAuditoria() {
  const { data, error } = await supabase.from("cooperadoras").select("*").order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function otorgarRolAuditor(email: string) {
  const { error } = await supabase.rpc("otorgar_rol_auditor", { _email: email });
  if (error) throw error;
}

export async function reclamarRolAuditor() {
  const { error } = await supabase.rpc("reclamar_rol_auditor");
  if (error) throw error;
}
