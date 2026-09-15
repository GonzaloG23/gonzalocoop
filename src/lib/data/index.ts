/**
 * Capa de acceso a datos de la aplicación.
 *
 * La aplicación sigue funcionando con Supabase durante la transición. La
 * futura API del Ministerio se incorpora de forma paralela y podrá activarse
 * cuando el backend PostgreSQL del Ministerio esté operativo.
 */

export type DataBackend = "supabase" | "ministerio-api";

const configuredBackend = import.meta.env.VITE_DATA_BACKEND as string | undefined;

// Por seguridad, cualquier valor desconocido mantiene Supabase y evita que
// una configuración incompleta deje inutilizable la aplicación de prueba.
export const DATA_BACKEND: DataBackend =
  configuredBackend === "ministerio-api" ? "ministerio-api" : "supabase";

export function usingMinisterioApi(): boolean {
  return DATA_BACKEND === "ministerio-api";
}

export { supabaseData } from "./supabase";
export {
  ministerioApiConfigured,
  ministerioRequest,
  MinisterioApiError,
} from "./ministerio-api";
