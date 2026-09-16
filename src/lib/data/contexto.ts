/**
 * Adaptador de contexto de usuario/cooperadora.
 *
 * Durante la migración conserva la implementación actual. Más adelante
 * podrá reemplazarse por la API del Ministerio sin modificar las pantallas.
 */
import { cargarContexto as cargarContextoActual } from "@/lib/libro";

export async function cargarContexto() {
  return cargarContextoActual();
}
