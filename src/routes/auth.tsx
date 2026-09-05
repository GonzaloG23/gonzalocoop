import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpenCheck, Building2, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const busqueda = z.object({
  rol: z.enum(["cooperadora", "auditor"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: busqueda,
  head: () => ({
    meta: [
      { title: "Acceso | Libro de Cooperadoras Escolares" },
      {
        name: "description",
        content:
          "Acceso separado para cooperadoras escolares y para la auditoría provincial: ingresá o creá tu cuenta según tu rol.",
      },
      { property: "og:title", content: "Acceso | Libro de Cooperadoras Escolares" },
      {
        property: "og:description",
        content: "Ingreso para cooperadoras y acceso reservado para auditores.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { rol } = Route.useSearch();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/panel" });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2 text-primary">
        <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <BookOpenCheck className="h-5 w-5" />
        </span>
        <span className="font-serif text-lg font-semibold">Libro de Cooperadoras Escolares</span>
      </Link>

      {!rol ? <ElegirRol /> : <Acceso rol={rol} />}
    </div>
  );
}

function ElegirRol() {
  const opciones = [
    {
      rol: "cooperadora" as const,
      icon: Building2,
      titulo: "Soy de una cooperadora escolar",
      texto:
        "Registrá los ingresos y egresos de tu escuela, cerrá cada mes y consultá el resumen anual.",
    },
    {
      rol: "auditor" as const,
      icon: ShieldCheck,
      titulo: "Soy auditor",
      texto:
        "Acceso reservado al control provincial: saldos, rendiciones y alertas de todas las cooperadoras.",
    },
  ];

  return (
    <div className="w-full max-w-3xl">
      <h1 className="mb-6 text-center font-serif text-2xl font-semibold text-foreground">
        ¿Cómo querés ingresar?
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {opciones.map((o) => (
          <Card key={o.rol} className="flex flex-col">
            <CardHeader>
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-sm bg-secondary text-primary">
                <o.icon className="h-5 w-5" />
              </span>
              <CardTitle className="font-serif text-lg">{o.titulo}</CardTitle>
              <CardDescription>{o.texto}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link to="/auth" search={{ rol: o.rol }}>
                  Continuar
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Acceso({ rol }: { rol: "cooperadora" | "auditor" }) {
  const navigate = useNavigate();
  const esAuditor = rol === "auditor";
  const [cargando, setCargando] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");

  async function avisarSiNoEsAuditor() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "auditor");
    if (!roles || roles.length === 0) {
      toast.warning(
        "Tu cuenta todavía no tiene permisos de auditoría. Pedile a un auditor que te habilite con tu email.",
      );
    }
  }

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setCargando(false);
      toast.error(
        error.message.includes("Invalid login")
          ? "Email o contraseña incorrectos."
          : `No se pudo ingresar: ${error.message}`,
      );
      return;
    }
    if (esAuditor) await avisarSiNoEsAuditor();
    setCargando(false);
    navigate({ to: esAuditor ? "/auditoria" : "/panel" });
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: `${window.location.origin}${esAuditor ? "/auditoria" : "/panel"}`,
      },
    });
    if (error) {
      setCargando(false);
      toast.error(`No se pudo crear la cuenta: ${error.message}`);
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setCargando(false);
      toast.success("Cuenta creada. Revisá tu casilla para confirmar el email.");
      return;
    }

    if (esAuditor) {
      const { error: errRol } = await supabase.rpc("reclamar_rol_auditor");
      setCargando(false);
      if (errRol) {
        toast.warning(
          "Cuenta creada, pero el rol de auditoría lo tiene que habilitar un auditor ya registrado con tu email.",
        );
      } else {
        toast.success("Cuenta de auditoría creada.");
      }
      navigate({ to: "/auditoria" });
      return;
    }

    setCargando(false);
    toast.success("Cuenta creada. Ya podés registrar tu cooperadora.");
    navigate({ to: "/panel" });
  }

  async function conGoogle() {
    setCargando(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setCargando(false);
      toast.error("No se pudo ingresar con Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: esAuditor ? "/auditoria" : "/panel" });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-sm bg-secondary text-primary">
          {esAuditor ? <ShieldCheck className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
        </span>
        <CardTitle className="font-serif">
          {esAuditor ? "Acceso de auditoría" : "Acceso de cooperadoras"}
        </CardTitle>
        <CardDescription>
          {esAuditor
            ? "Control provincial de las cooperadoras escolares de Tucumán."
            : "Registro de ingresos, egresos y saldos de tu escuela."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ingresar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ingresar">Ingresar</TabsTrigger>
            <TabsTrigger value="crear">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="ingresar">
            <form onSubmit={ingresar} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {esAuditor ? "Ingresar a auditoría" : "Ingresar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="crear">
            <form onSubmit={registrar} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre y apellido</Label>
                <Input
                  id="nombre"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. María López"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-nuevo">Email</Label>
                <Input
                  id="email-nuevo"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-nuevo">Contraseña</Label>
                <Input
                  id="password-nuevo"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {esAuditor ? "Crear cuenta de auditoría" : "Crear cuenta de la cooperadora"}
              </Button>
              {esAuditor && (
                <p className="text-xs text-muted-foreground">
                  La auditoría es un acceso restringido: si ya hay un auditor registrado, tiene que
                  habilitarte con tu email desde su panel.
                </p>
              )}
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={conGoogle} disabled={cargando}>
          Continuar con Google
        </Button>

        <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
          <Link to="/auth">
            <ArrowLeft className="mr-1 h-4 w-4" /> Cambiar tipo de acceso
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
