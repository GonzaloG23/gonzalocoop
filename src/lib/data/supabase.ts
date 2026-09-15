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
