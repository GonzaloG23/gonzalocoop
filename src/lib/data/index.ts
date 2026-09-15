/**
 * Capa de acceso a datos de la aplicación.
 *
 * Durante la etapa de transición, el adaptador Supabase mantiene el sistema
 * funcionando sin cambios funcionales. En una etapa posterior se incorporará
 * un adaptador HTTP para la API del Ministerio, sin que las pantallas tengan
 * que conocer PostgreSQL ni Supabase.
 */

export type DataBackend = "supabase" | "ministerio-api";

export const DATA_BACKEND: DataBackend = "supabase";

export function usingMinisterioApi(): boolean {
  return DATA_BACKEND === "ministerio-api";
}

export { supabaseData } from "./supabase";
