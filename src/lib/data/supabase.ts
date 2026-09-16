import { supabase } from "@/integrations/supabase/client";

/**
 * Adaptador temporal.
 *
 * Este módulo es deliberadamente pequeño: centraliza la referencia al cliente
 * Supabase para que, al migrar al Ministerio, podamos reemplazar el adaptador
 * sin repartir cambios de infraestructura por toda la interfaz.
 */
export const supabaseData = {
  client: supabase,
};

/**
 * Permite saber si el entorno tiene credenciales de Supabase sin inicializar
 * el cliente. Esto es importante durante la migración, porque Lovable puede
 * ejecutar la aplicación sin Supabase conectado.
 */
export function supabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  return Boolean(url && key);
}
