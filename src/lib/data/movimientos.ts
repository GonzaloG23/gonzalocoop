import { insertarMovimiento, type NuevoMovimiento } from "./operaciones";

/**
 * Adaptador semántico de movimientos.
 *
 * Las pantallas no deberían conocer tablas, RPC ni detalles de Supabase.
 * Cuando el Ministerio tenga su API, este módulo podrá cambiar su
 * implementación sin modificar el formulario de movimientos.
 */
export async function registrarMovimiento(input: NuevoMovimiento) {
  return insertarMovimiento(input);
}

export { cerrarPeriodo } from "./operaciones";
