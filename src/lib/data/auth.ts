import { supabaseData } from "./supabase";

const supabase = supabaseData.client;

/**
 * Authentication seam for the future Ministerio API.
 *
 * During the transition this adapter talks to Supabase. The UI should use
 * these semantic operations instead of importing Supabase directly.
 * Later this implementation can be replaced by the Ministry backend API.
 */
export const authData = {
  getSession: () => supabase.auth.getSession(),
  getUser: () => supabase.auth.getUser(),

  signInWithPassword: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signUp: (email: string, password: string, nombre: string, emailRedirectTo: string) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo,
      },
    }),

  signOut: () => supabase.auth.signOut(),

  hasAuditorRole: async (userId: string) => {
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
