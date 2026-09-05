import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenCheck, FileSpreadsheet, ShieldCheck, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Libro de Cooperadoras Escolares | Tucumán" },
      {
        name: "description",
        content:
          "Sistema de control de saldos iniciales, ingresos, egresos y saldo final de las cooperadoras escolares de Tucumán, mes a mes y con cierre anual.",
      },
      { property: "og:title", content: "Libro de Cooperadoras Escolares | Tucumán" },
      {
        property: "og:description",
        content:
          "Registro inalterable de movimientos, saldos mensuales, resumen anual y control de rendiciones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portada,
});

const puntos = [
  {
    icon: BookOpenCheck,
    titulo: "Libro mensual",
    texto:
      "Saldo inicial heredado del mes anterior, movimientos con rubro y comprobante, saldo final calculado.",
  },
  {
    icon: ShieldCheck,
    titulo: "Registro inalterable",
    texto:
      "Ningún movimiento se borra ni se edita: los errores se corrigen con un ajuste contable con motivo.",
  },
  {
    icon: TrendingUp,
    titulo: "Resumen anual",
    texto: "Los doce meses en una planilla, con evolución del saldo y total del ejercicio.",
  },
  {
    icon: FileSpreadsheet,
    titulo: "Reportes",
    texto: "Planilla mensual y anual a Excel y PDF, y comparativo entre cooperadoras para auditoría.",
  },
];

function Portada() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <span className="flex items-center gap-2 text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <span className="font-serif text-base font-semibold">Libro de Cooperadoras</span>
          </span>
          <Button asChild size="sm">
            <Link to="/auth">Ingresar</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          Control de saldos de las cooperadoras escolares de Tucumán
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Cada cooperadora registra sus ingresos y egresos mes a mes. El sistema calcula el saldo
          inicial, el saldo final y el resultado anual, y avisa cuando algo no cierra.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ rol: "cooperadora" }}>
              Ingreso de cooperadoras
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ rol: "auditor" }}>
              Ingreso de auditores
            </Link>
          </Button>
        </div>


        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {puntos.map((p) => (
            <Card key={p.titulo}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary text-primary">
                  <p.icon className="h-5 w-5" />
                </span>
                <CardTitle className="font-serif text-lg">{p.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{p.texto}</CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Cooperadoras escolares · Provincia de Tucumán
      </footer>
    </div>
  );
}
