import { supabaseData, supabaseConfigured } from "./supabase";
import { usingMinisterioApi, ministerioRequest } from "./index";
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
  if (usingMinisterioApi()) {
    return ministerioRequest<Cooperadora[]>("/api/auditoria/cooperadoras");
  }

  if (!supabaseConfigured()) return [DEMO_COOPERADORA];

  const { data, error } = await supabase
    .from("cooperadoras")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function cargarCooperadoraAuditoria(id: string): Promise<Cooperadora | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<Cooperadora | null>(`/api/auditoria/cooperadoras/${id}`);
  }

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

export async function actualizarDatosIdentificatoriosCooperadora(
  id: string,
  datos: Pick<Cooperadora, "nombre" | "cue">,
): Promise<Cooperadora> {
  const nombre = datos.nombre.trim();
  const cue = (datos.cue ?? "").replace(/\D/g, "");
  if (!nombre) throw new Error("El nombre de la escuela es obligatorio.");
  if (!cue) throw new Error("El CUE es obligatorio.");

  if (usingMinisterioApi()) {
    return ministerioRequest<Cooperadora>(`/api/auditoria/cooperadoras/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre, cue }),
    });
  }

  if (!supabaseConfigured()) {
    if (id === DEMO_COOPERADORA.id) throw new Error("La edición del nombre y CUE del entorno de prueba queda reservada a auditoría en el backend institucional.");
    throw new Error("No se puede modificar esta cooperadora desde el entorno de prueba.");
  }

  const { data, error } = await supabase
    .from("cooperadoras")
    .update({ nombre, cue })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Cooperadora;
}

export async function otorgarRolAuditor(email: string) {
  if (usingMinisterioApi()) {
    return ministerioRequest<void>("/api/auditoria/auditores", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  if (!supabaseConfigured()) {
    throw new Error("La habilitación de otros auditores se conectará al backend del Ministerio.");
  }

  const { error } = await supabase.rpc("otorgar_rol_auditor", { _email: email });
  if (error) throw error;
}

export async function reclamarRolAuditor() {
  if (usingMinisterioApi()) {
    return ministerioRequest<void>("/api/auditoria/reclamar-rol", {
      method: "POST",
    });
  }

  if (!supabaseConfigured()) return;

  const { error } = await supabase.rpc("reclamar_rol_auditor");
  if (error) throw error;
}
