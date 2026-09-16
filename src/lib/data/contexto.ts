/**
 * Adaptador de contexto de usuario/cooperadora.
 *
 * Durante la migración usa una cooperadora local de prueba cuando Supabase
 * no está configurado. Más adelante esta implementación será reemplazada
 * por la API del Ministerio sin modificar las pantallas.
 */
import { cargarContexto as cargarContextoActual, type Contexto } from "@/lib/libro";
import { supabaseConfigured } from "./supabase";

const DEMO_SESSION_KEY = "demo-auth-session";

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

export async function cargarContexto(): Promise<Contexto | null> {
  if (supabaseConfigured()) return cargarContextoActual();

  try {
    if (!localStorage.getItem(DEMO_SESSION_KEY)) return null;
  } catch {
    return null;
  }

  return {
    userId: "demo-cooperadora",
    email: "cooperadora@demo.local",
    nombre: "Cooperadora de Prueba",
    cooperadoraId: DEMO_COOPERADORA.id,
    esAuditor: false,
    cooperadora: DEMO_COOPERADORA,
  };
}
