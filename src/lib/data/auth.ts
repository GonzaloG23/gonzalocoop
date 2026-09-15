import { supabase } from "@/integrations/supabase/client";

/**
 * Authentication seam for the future Ministerio API.
 *
 * The application can keep using Supabase during the transition, while the
 * screens depend on semantic authentication operations instead of Supabase.
 * Later this file can be replaced by an HTTP client for the Ministry backend.
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
  getAuditorRole: (userId: string) =>
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "auditor"),
  claimAuditorRole: () => supabase.rpc("reclamar_rol_auditor"),
};
