import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Save, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import {
  abrirActaConstitucion,
  cargarActaConstitucion,
  cargarComisionDirectiva,
  guardarActaConstitucion,
  guardarComisionDirectiva,
  type CargoComision,
  type MiembroComision,
} from "@/lib/data/comision";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/comision")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Comisión directiva | Libro de Cooperadoras" },
      {
        name: "description",
        content: "Datos de los miembros de la comisión directiva y acta de constitución de la cooperadora.",
      },
      { property: "og:title", content: "Comisión directiva de la cooperadora" },
      {
        property: "og:description",
        content: "Registro de autoridades y acta de constitución.",
      },
    ],
  }),
  component: ComisionPage,
});

type CampoCargo = {
  cargo: CargoComision;
  etiqueta: string;
};

const CARGOS: CampoCargo[] = [
  { cargo: "presidente", etiqueta: "Presidente" },
  { cargo: "secretario", etiqueta: "Secretario" },
  { cargo: "tesorero", etiqueta: "Tesorero" },
  { cargo: "vocal_1", etiqueta: "Vocal" },
  { cargo: "vocal_2", etiqueta: "Vocal" },
  { cargo: "revisor_cuentas", etiqueta: "Revisor de Cuentas" },
  { cargo: "asesor_director", etiqueta: "Asesor/Director" },
];

function ComisionPage() {
  const { data: ctx, isLoading } = useContexto();
  const qc = useQueryClient();
  const cooperadora = ctx?.cooperadora;
  const [miembros, setMiembros] = useState<Record<CargoComision, string>>(() =>
    Object.fromEntries(CARGOS.map(({ cargo }) => [cargo, ""])) as Record<CargoComision, string>,
  );
  const [archivo, setArchivo] = useState<File | null>(null);

  const comision = useQuery({
    queryKey: ["comision-directiva", cooperadora?.id],
    queryFn: () => cargarComisionDirectiva(cooperadora!.id),
    enabled: !!cooperadora,
  });

  const acta = useQuery({
    queryKey: ["acta-constitucion", cooperadora?.id],
    queryFn: () => cargarActaConstitucion(cooperadora!.id),
    enabled: !!cooperadora,
  });

  useEffect(() => {
    if (!comision.data) return;
    setMiembros((actual) => {
      const siguiente = { ...actual };
      for (const miembro of comision.data ?? []) siguiente[miembro.cargo] = miembro.nombre;
      return siguiente;
    });
  }, [comision.data]);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      const datos: MiembroComision[] = CARGOS.map(({ cargo }) => ({
        cargo,
        nombre: miembros[cargo].trim(),
      }));
      await guardarComisionDirectiva(cooperadora.id, datos);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comision-directiva", cooperadora?.id] });
      toast.success("Datos de la comisión directiva guardados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const subirActa = useMutation({
    mutationFn: async () => {
      if (!cooperadora || !archivo) throw new Error("Seleccioná un archivo PDF.");
      if (archivo.size > 10 * 1024 * 1024) throw new Error("El PDF no puede superar los 10 MB.");
      return guardarActaConstitucion(cooperadora.id, archivo);
    },
    onSuccess: () => {
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["acta-constitucion", cooperadora?.id] });
      toast.success("Acta de constitución cargada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell titulo="Comisión directiva">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (!cooperadora) {
    return (
      <AppShell titulo="Comisión directiva" descripcion="Primero registrá la cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Todavía no registraste tu cooperadora. Volvé al panel para completar los datos institucionales.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Comisión directiva"
      descripcion={`${cooperadora.nombre}${cooperadora.localidad ? ` · ${cooperadora.localidad}` : ""}`}
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Users className="h-5 w-5 text-primary" /> Integrantes de la Comisión Directiva
            </CardTitle>
            <CardDescription>
              Completá el nombre y apellido de cada integrante. Podés guardar los datos aunque todavía falte algún cargo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {CARGOS.map(({ cargo, etiqueta }, index) => (
              <div key={cargo} className="space-y-2">
                <Label htmlFor={`cargo-${cargo}`}>
                  {etiqueta}{index === 3 || index === 4 ? ` ${index - 2}` : ""}
                </Label>
                <Input
                  id={`cargo-${cargo}`}
                  value={miembros[cargo]}
                  placeholder="Nombre y apellido"
                  onChange={(e) =>
                    setMiembros((actual) => ({ ...actual, [cargo]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="sm:col-span-2 pt-2">
              <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {guardar.isPending ? "Guardando…" : "Guardar comisión directiva"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-primary" /> Acta de constitución
            </CardTitle>
            <CardDescription>
              Subí el acta de constitución de la cooperadora en formato PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-sm border border-dashed border-border p-4">
              <Label htmlFor="acta-pdf">Archivo PDF</Label>
              <Input
                id="acta-pdf"
                className="mt-2"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              <p className="mt-2 text-xs text-muted-foreground">Tamaño máximo: 10 MB.</p>
            </div>

            {archivo && (
              <p className="text-sm">
                Archivo seleccionado: <span className="font-medium">{archivo.name}</span>
              </p>
            )}

            {acta.data && (
              <div className="rounded-sm border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-medium">Acta cargada</p>
                <p className="mt-1 break-all text-muted-foreground">{acta.data.nombreArchivo}</p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => abrirActaConstitucion(cooperadora.id).catch((error: Error) => toast.error(error.message))}
                >
                  <FileText className="mr-2 h-4 w-4" /> Ver PDF
                </Button>
              </div>
            )}

            <Button
              onClick={() => subirActa.mutate()}
              disabled={!archivo || subirActa.isPending}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {subirActa.isPending ? "Subiendo…" : "Subir acta de constitución"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
