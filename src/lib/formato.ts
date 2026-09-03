export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function money(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? Number(valor) : (valor ?? 0);
  return pesos.format(Number.isFinite(n) ? n : 0);
}

export function num(valor: number | string | null | undefined): number {
  const n = typeof valor === "string" ? Number(valor) : (valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Formatea una fecha ISO (yyyy-mm-dd) como dd/mm/aaaa sin desfase de zona horaria. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}
