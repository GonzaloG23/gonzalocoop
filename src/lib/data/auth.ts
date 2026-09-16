import { supabaseData, supabaseConfigured } from "./supabase";

const supabase = supabaseData.client;

const DEMO_EMAIL = "cooperadora@demo.local";
const DEMO_PASSWORD = "123456";
const DEMO_SESSION_KEY = "demo-auth-session";

const DEMO_USER = {
  id: "demo-cooperadora",
  email: DEMO_EMAIL,
  user_metadata: { nombre: "Cooperadora de Prueba" },
};

type DemoSession = { user: typeof DEMO_USER };

function getDemoSession(): DemoSession | null {
  try {
    return localStorage.getItem(DEMO_SESSION_KEY) ? { user: DEMO_USER } : null;
  } catch {
    return null;
  }
}

/**
 * Authentication seam for the future Ministerio API.
 *
 * During the transition this adapter talks to Supabase when available. If
 * Supabase is not configured, a temporary local demo account is used so the
 * application flow can be tested without an external backend.
 */
export const authData = {
  isConfigured: () => supabaseConfigured(),

  getSession: () => {
    if (!supabaseConfigured()) return Promise.resolve({ data: { session: getDemoSession() } });
    return supabase.auth.getSession();
  },

  getUser: () => {
    if (!supabaseConfigured()) return Promise.resolve({ data: { user: getDemoSession()?.user ?? null } });
    return supabase.auth.getUser();
  },

  signInWithPassword: (email: string, password: string) => {
    if (!supabaseConfigured()) {
      if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
        return Promise.resolve({
          data: { user: null, session: null },
          error: { message: "Invalid login credentials" },
        });
      }
      localStorage.setItem(DEMO_SESSION_KEY, "1");
      const session = { user: DEMO_USER };
      return Promise.resolve({ data: { user: DEMO_USER, session }, error: null });
    }
    return supabase.auth.signInWithPassword({ email, password });
  },

  signUp: (email: string, password: string, nombre: string, emailRedirectTo: string) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo,
      },
    }),

  signOut: () => {
    if (!supabaseConfigured()) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      return Promise.resolve({ error: null });
    }
    return supabase.auth.signOut();
  },

  hasAuditorRole: async (userId: string) => {
    if (!supabaseConfigured()) return false;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "auditor");
    if (error) throw error;
    return (data ?? []).length > 0;
  },

  claimAuditorRole: () => supabase.rpc("reclamar_rol_auditor"),

  grantAuditorRole: (email: string) =>
    supabase.rpc("otorgar_rol_auditor", { _email: email }),

  createCooperadora: (input: {
    nombre: string;
    cue: string;
    cuit: string;
    localidad: string;
    ejercicio: number;
    saldoInicial: number;
  }) =>
    supabase.rpc("crear_cooperadora", {
      _nombre: input.nombre,
      _cue: input.cue,
      _cuit: input.cuit,
      _localidad: input.localidad,
      _ejercicio: input.ejercicio,
      _saldo_inicial: input.saldoInicial,
    }),

  signInWithGoogle: (redirectUri: string) =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUri },
    }),
};
