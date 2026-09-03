import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceso | Libro de Cooperadoras Escolares" },
      {
        name: "description",
        content:
          "Ingresá o creá tu cuenta para registrar los ingresos, egresos y saldos de la cooperadora escolar.",
      },
      { property: "og:title", content: "Acceso | Libro de Cooperadoras Escolares" },
      {
        property: "og:description",
        content: "Ingresá o creá tu cuenta para registrar los movimientos de la cooperadora escolar.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/panel" });
    });
  }, [navigate]);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "Email o contraseña incorrectos."
          : `No se pudo ingresar: ${error.message}`,
      );
      return;
    }
    navigate({ to: "/panel" });
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre }, emailRedirectTo: `${window.location.origin}/panel` },
    });
    setCargando(false);
    if (error) {
      toast.error(`No se pudo crear la cuenta: ${error.message}`);
      return;
    }
    toast.success("Cuenta creada. Si el sistema pide confirmar el email, revisá tu casilla.");
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: "/panel" });
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
    navigate({ to: "/panel" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2 text-primary">
        <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <BookOpenCheck className="h-5 w-5" />
        </span>
        <span className="font-serif text-lg font-semibold">Libro de Cooperadoras Escolares</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-serif">Acceso al sistema</CardTitle>
          <CardDescription>Cooperadoras escolares de la provincia de Tucumán</CardDescription>
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
                  Ingresar
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
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={conGoogle} disabled={cargando}>
            Continuar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
