import { supabaseData, supabaseConfigured } from "./supabase";
import { usingMinisterioApi, ministerioRequest } from "./index";

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
type MinisterioMe = {
  user: { id: string; email: string; nombre?: string | null } | null;
  role?: "cooperadora" | "auditor" | null;
};
type MinisterioUser = {
  id: string;
  email: string;
  user_metadata: { nombre?: string; rol?: string };
};

function getDemoSession(): DemoSession | null {
  try {
    const email = localStorage.getItem(DEMO_SESSION_KEY);
    const user = DEMO_ACCOUNTS.find((account) => account.email === email);
    return user ? { user } : null;
  } catch {
    return null;
  }
}

async function cargarMeMinisterio(): Promise<MinisterioMe | null> {
  try {
    return await ministerioRequest<MinisterioMe>("/api/me");
  } catch (error) {
    if (error instanceof Error && "status" in error && (error as { status: number }).status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * Adaptador de autenticación.
 *
 * Durante la transición usa Supabase o cuentas demo. Cuando se selecciona
 * `ministerio-api`, las pantallas pasan a trabajar con la sesión y el
 * contexto que entrega la API institucional.
 */
export const authData = {
  isConfigured: () => supabaseConfigured() || usingMinisterioApi(),

  getSession: async () => {
    if (usingMinisterioApi()) {
      const me = await cargarMeMinisterio();
      if (!me?.user) return { data: { session: null } };
      const user: MinisterioUser = {
        id: me.user.id,
        email: me.user.email,
        user_metadata: { nombre: me.user.nombre ?? undefined, rol: me.role ?? undefined },
      };
      return { data: { session: { user } } };
    }
    if (!supabaseConfigured()) return { data: { session: getDemoSession() } };
    return supabase.auth.getSession();
  },

  getUser: async () => {
    if (usingMinisterioApi()) {
      const me = await cargarMeMinisterio();
      if (!me?.user) return { data: { user: null } };
      const user: MinisterioUser = {
        id: me.user.id,
        email: me.user.email,
        user_metadata: { nombre: me.user.nombre ?? undefined, rol: me.role ?? undefined },
      };
      return { data: { user } };
    }
    if (!supabaseConfigured()) return { data: { user: getDemoSession()?.user ?? null } };
    return supabase.auth.getUser();
  },

  signInWithPassword: async (email: string, password: string) => {
    if (usingMinisterioApi()) {
      try {
        const result = await ministerioRequest<{
          user: { id: string; email: string; nombre?: string | null };
          role: "cooperadora" | "auditor";
        }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        return {
          data: {
            user: {
              id: result.user.id,
              email: result.user.email,
              user_metadata: { nombre: result.user.nombre ?? undefined, rol: result.role },
            },
            session: { user: result.user },
          },
          error: null,
        };
      } catch (error) {
        return {
          data: { user: null, session: null },
          error: { message: error instanceof Error ? error.message : "Error de autenticación" },
        };
      }
    }
    if (!supabaseConfigured()) {
      const account = DEMO_ACCOUNTS.find((item) => item.email === email);
      if (!account || password !== DEMO_PASSWORD) {
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      }
      localStorage.setItem(DEMO_SESSION_KEY, account.email);
      return { data: { user: account, session: { user: account } }, error: null };
    }
    return supabase.auth.signInWithPassword({ email, password });
  },

  signUp: (email: string, password: string, nombre: string, emailRedirectTo: string) =>
    supabase.auth.signUp({ email, password, options: { data: { nombre }, emailRedirectTo } }),

  signOut: async () => {
    if (usingMinisterioApi()) {
      try {
        await ministerioRequest<void>("/api/auth/logout", { method: "POST" });
      } catch (error) {
        if (!(error instanceof Error && "status" in error && (error as { status: number }).status === 404)) throw error;
      }
      return { error: null };
    }
    if (!supabaseConfigured()) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      return { error: null };
    }
    return supabase.auth.signOut();
  },

  hasAuditorRole: async (userId: string) => {
    if (usingMinisterioApi()) {
      const me = await cargarMeMinisterio();
      return me?.user?.id === userId && me.role === "auditor";
    }
    if (!supabaseConfigured()) return DEMO_ACCOUNTS.some((account) => account.id === userId && account.role === "auditor");
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "auditor");
    if (error) throw error;
    return (data ?? []).length > 0;
  },

  claimAuditorRole: () => {
    if (usingMinisterioApi()) return ministerioRequest<void>("/api/auditoria/reclamar-rol", { method: "POST" });
    return supabase.rpc("reclamar_rol_auditor");
  },

  grantAuditorRole: (email: string) => {
    if (usingMinisterioApi()) return ministerioRequest<void>("/api/auditoria/auditores", { method: "POST", body: JSON.stringify({ email }) });
    return supabase.rpc("otorgar_rol_auditor", { _email: email });
  },

  createCooperadora: async (input: {
    nombre: string;
    cue: string;
    cuit: string;
    localidad: string;
    ejercicio: number;
    saldoInicial: number;
  }) => {
    if (usingMinisterioApi()) {
      return ministerioRequest("/api/cooperadoras", {
        method: "POST",
        body: JSON.stringify({ ...input, saldo_inicial: input.saldoInicial }),
      });
    }
    return supabase.rpc("crear_cooperadora", {
      _nombre: input.nombre,
      _cue: input.cue,
      _cuit: input.cuit,
      _localidad: input.localidad,
      _ejercicio: input.ejercicio,
      _saldo_inicial: input.saldoInicial,
    });
  },

  signInWithGoogle: (redirectUri: string) =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUri } }),
};
