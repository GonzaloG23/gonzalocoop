import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import {
  cargarTodosLosRubros,
  crearRubro,
  toggleRubro,
  type Rubro,
  type Tipo,
} from "@/lib/libro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/rubros")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rubros | Libro de Cooperadoras" },
      {
        name: "description",
        content: "Gestioná los rubros de ingresos y egresos de tu cooperadora escolar.",
      },
    ],
  }),
  component: RubrosPage,
});

function RubrosPage() {
  const { data: ctx, isLoading } = useContexto();
  const coop = ctx?.cooperadora ?? null;

  if (isLoading) {
    return (
      <AppShell titulo="Rubros">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (!coop) {
    return (
      <AppShell titulo="Rubros">
        <p className="text-sm text-muted-foreground">
          Registrá tu cooperadora desde el panel para gestionar los rubros.
        </p>
      </AppShell>
    );
  }

  return <GestionRubros cooperadoraId={coop.id} />;
}

function GestionRubros({ cooperadoraId }: { cooperadoraId: string }) {
  const qc = useQueryClient();
  const rubros = useQuery({
    queryKey: ["rubros-todos", cooperadoraId],
    queryFn: () => cargarTodosLosRubros(cooperadoraId),
  });

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<Tipo>("ingreso");

  const crear = useMutation({
    mutationFn: () => crearRubro(cooperadoraId, nuevoNombre, nuevoTipo),
    onSuccess: () => {
      toast.success("Rubro creado.");
      setNuevoNombre("");
      qc.invalidateQueries({ queryKey: ["rubros-todos", cooperadoraId] });
      qc.invalidateQueries({ queryKey: ["rubros", cooperadoraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ rubro, activo }: { rubro: Rubro; activo: boolean }) =>
      toggleRubro(rubro.id, activo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rubros-todos", cooperadoraId] });
      qc.invalidateQueries({ queryKey: ["rubros", cooperadoraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ingresos = (rubros.data ?? []).filter((r) => r.tipo === "ingreso");
  const egresos = (rubros.data ?? []).filter((r) => r.tipo === "egreso");

  return (
    <AppShell
      titulo="Rubros"
      descripcion="Gestioná los rubros de ingresos y egresos de tu cooperadora."
    >
      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Plus className="h-5 w-5" /> Nuevo rubro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nuevoNombre.trim()) return;
              crear.mutate();
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="nombre-rubro">Nombre</Label>
              <Input
                id="nombre-rubro"
                required
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej. Venta de uniformes"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={nuevoTipo} onValueChange={(v) => setNuevoTipo(v as Tipo)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={crear.isPending || !nuevoNombre.trim()}>
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListaRubros
          titulo="Rubros de ingresos"
          icon={ArrowDownToLine}
          rubros={ingresos}
          onToggle={toggle.mutate}
          cargando={rubros.isLoading}
        />
        <ListaRubros
          titulo="Rubros de egresos"
          icon={ArrowUpFromLine}
          rubros={egresos}
          onToggle={toggle.mutate}
          cargando={rubros.isLoading}
        />
      </div>
    </AppShell>
  );
}

function ListaRubros({
  titulo,
  icon: Icon,
  rubros,
  onToggle,
  cargando,
}: {
  titulo: string;
  icon: React.ComponentType<{ className?: string }>;
  rubros: Rubro[];
  onToggle: (args: { rubro: Rubro; activo: boolean }) => void;
  cargando: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Icon className="h-4 w-4" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cargando && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!cargando && rubros.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay rubros en esta categoría.</p>
        )}
        {rubros.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.nombre}
                    {r.cooperadora_id === null && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        General
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.activo ? "default" : "secondary"}>
                      {r.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.cooperadora_id !== null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggle({ rubro: r, activo: !r.activo })}
                      >
                        {r.activo ? "Desactivar" : "Activar"}
                      </Button>
                    )}
                    {r.cooperadora_id === null && (
                      <span className="text-xs text-muted-foreground">No editable</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
