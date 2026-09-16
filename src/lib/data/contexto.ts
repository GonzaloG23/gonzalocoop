/**
 * Adaptador de contexto de usuario/cooperadora.
 *
 * Durante la migración usa cuentas y datos locales de prueba cuando Supabase
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

  let email: string | null = null;
  try {
    email = localStorage.getItem(DEMO_SESSION_KEY);
  } catch {
    return null;
  }

  if (!email) return null;

  if (email === "auditor@demo.local") {
    return {
      userId: "demo-auditor",
      email,
      nombre: "Auditor de Prueba",
      cooperadoraId: null,
      esAuditor: true,
      cooperadora: null,
    };
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
