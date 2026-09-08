import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, useContexto } from "@/components/AppShell";
import { calcularEjercicio, cargarEjercicio, cargarParametros, totalesAnuales, type Cooperadora } from "@/lib/libro";
import { exportarAnualExcel, exportarAnualPDF } from "@/lib/exportar";
import { money, nombreMes, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/anual")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Resumen anual | Libro de Cooperadoras" },
      {
        name: "description",
        content:
          "Los doce meses del ejercicio con saldo inicial, ingresos, egresos, saldo final y el resultado anual.",
      },
      { property: "og:title", content: "Resumen anual del ejercicio" },
      {
        property: "og:description",
        content: "Planilla de los doce meses con evolución del saldo y total del ejercicio.",
      },
    ],
  }),
  component: AnualPage,
});

function AnualPage() {
  const { data: ctx, isLoading } = useContexto();
  const coop = ctx?.cooperadora ?? null;

  return (
    <AppShell
      titulo="Resumen anual"
      descripcion={coop ? `${coop.nombre} · Ejercicio ${coop.ejercicio}` : "Ejercicio en curso"}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && !coop && (
        <p className="text-sm text-muted-foreground">
          Registrá tu cooperadora desde el panel para ver el resumen del ejercicio.
        </p>
      )}
      {coop && <Anual cooperadora={coop} />}
    </AppShell>
  );
}

export function Anual({ cooperadora }: { cooperadora: Cooperadora }) {
  const anio = cooperadora.ejercicio;
  const ejercicio = useQuery({
    queryKey: ["ejercicio", cooperadora.id, anio],
    queryFn: () => cargarEjercicio(cooperadora.id, anio),
  });

  const parametros = useQuery({
    queryKey: ["parametros"],
    queryFn: cargarParametros,
    staleTime: 30_000,
  });

  const resumen = useMemo(() => {
    if (!ejercicio.data) return null;
    return calcularEjercicio(
      num(cooperadora.saldo_inicial_ejercicio),
      ejercicio.data.periodos,
      ejercicio.data.movimientos,
      parametros.data,
    );
  }, [ejercicio.data, cooperadora, parametros.data]);

  if (!resumen) return <p className="text-sm text-muted-foreground">Cargando planilla…</p>;
  const totales = totalesAnuales(resumen);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportarAnualExcel(cooperadora, resumen)}>
          <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportarAnualPDF(cooperadora, resumen)}>
          <Download className="mr-1 h-4 w-4" /> PDF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg">Evolución del saldo</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={resumen.map((r) => ({ mes: nombreMes(r.mes).slice(0, 3), saldo: r.saldoFinal }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                fontSize={12}
                width={80}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => money(v)}
              />
              <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => `Mes: ${l}`} />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg">Planilla del ejercicio {anio}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Observaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.map((r) => (
                <TableRow key={r.mes}>
                  <TableCell className="font-medium">{nombreMes(r.mes)}</TableCell>
                  <TableCell className="text-right">{money(r.saldoInicial)}</TableCell>
                  <TableCell className="text-right">{money(r.ingresos)}</TableCell>
                  <TableCell className="text-right">{money(r.egresos)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${r.saldoFinal < 0 ? "text-destructive" : ""}`}
                  >
                    {money(r.saldoFinal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.periodo?.estado === "cerrado" ? "default" : "secondary"}>
                      {r.periodo?.estado === "cerrado" ? "Cerrado" : "Abierto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.alertas.join(" · ")}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-secondary font-semibold">
                <TableCell>Total del ejercicio</TableCell>
                <TableCell className="text-right">{money(totales.saldoInicial)}</TableCell>
                <TableCell className="text-right">{money(totales.ingresos)}</TableCell>
                <TableCell className="text-right">{money(totales.egresos)}</TableCell>
                <TableCell className="text-right">{money(totales.saldoFinal)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
