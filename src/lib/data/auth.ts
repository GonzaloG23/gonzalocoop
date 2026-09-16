import { supabaseData, supabaseConfigured } from "./supabase";

const supabase = supabaseData.client;

const DEMO_PASSWORD = "123456";
const DEMO_SESSION_KEY = "demo-auth-session";

const DEMO_ACCOUNTS = [
  {
    id: "demo-cooperadora",
    email: "cooperadora@demo.local",
    role: "cooperadora" as const,
    user_metadata: { nombre: "Cooperadora de Prueba", rol: "cooperadora" },
  },
  {
    id: "demo-auditor",
    email: "auditor@demo.local",
    role: "auditor" as const,
    user_metadata: { nombre: "Auditor de Prueba", rol: "auditor" },
  },
];

type DemoUser = (typeof DEMO_ACCOUNTS)[number];
type DemoSession = { user: DemoUser };

function getDemoSession(): DemoSession | null {
  try {
    const email = localStorage.getItem(DEMO_SESSION_KEY);
    const user = DEMO_ACCOUNTS.find((account) => account.email === email);
    return user ? { user } : null;
  } catch {
    return null;
  }
}

/**
 * Authentication seam for the future Ministerio API.
 *
 * During the transition this adapter talks to Supabase when available. If
 * Supabase is not configured, temporary local demo accounts are used so the
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
      const account = DEMO_ACCOUNTS.find((item) => item.email === email);
      if (!account || password !== DEMO_PASSWORD) {
        return Promise.resolve({
          data: { user: null, session: null },
          error: { message: "Invalid login credentials" },
        });
      }
      localStorage.setItem(DEMO_SESSION_KEY, account.email);
      const session = { user: account };
      return Promise.resolve({ data: { user: account, session }, error: null });
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
    if (!supabaseConfigured()) {
      return DEMO_ACCOUNTS.some((account) => account.id === userId && account.role === "auditor");
    }
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
