import { supabaseData, supabaseConfigured } from "./supabase";

const supabase = supabaseData.client;
const DEMO_COOPERADORA_ID = "demo-cooperadora-001";
export const DEMO_MOVIMIENTOS_KEY = "demo-movimientos";
export const DEMO_PERIODOS_CERRADOS_KEY = "demo-periodos-cerrados";

export async function cerrarPeriodo(periodoId: string) {
  if (!supabaseConfigured() && periodoId.startsWith("demo-periodo-")) {
    const actuales = JSON.parse(
      localStorage.getItem(DEMO_PERIODOS_CERRADOS_KEY) ?? "[]",
    ) as string[];

    if (!actuales.includes(periodoId)) actuales.push(periodoId);
    localStorage.setItem(DEMO_PERIODOS_CERRADOS_KEY, JSON.stringify(actuales));
    return;
  }

  const { error } = await supabase
    .from("periodos")
    .update({ estado: "cerrado" })
    .eq("id", periodoId);
  if (error) throw error;
}

export type NuevoMovimiento = {
  cooperadora_id: string;
  periodo_id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  rubro_id: string | null;
  concepto: string;
  monto: number;
  medio_pago: string | null;
  comprobante: string | null;
  proveedor_cuit: string | null;
  proveedor_razon_social: string | null;
  tipo_factura: string | null;
  observaciones: string | null;
  ajusta_movimiento_id: string | null;
  motivo_ajuste: string | null;
  creado_por: string;
};

export async function insertarMovimiento(input: NuevoMovimiento) {
  if (!supabaseConfigured() && input.cooperadora_id === DEMO_COOPERADORA_ID) {
    const cerrados = JSON.parse(
      localStorage.getItem(DEMO_PERIODOS_CERRADOS_KEY) ?? "[]",
    ) as string[];

    if (cerrados.includes(input.periodo_id)) {
      throw new Error("El período está cerrado y no admite nuevos movimientos.");
    }

    const movimiento = {
      ...input,
      id: `demo-movimiento-${Date.now()}`,
      creado_en: new Date().toISOString(),
    };

    const actuales = JSON.parse(localStorage.getItem(DEMO_MOVIMIENTOS_KEY) ?? "[]") as unknown[];
    actuales.push(movimiento);
    localStorage.setItem(DEMO_MOVIMIENTOS_KEY, JSON.stringify(actuales));
    return movimiento;
  }

  const { error } = await supabase.from("movimientos").insert(input);
  if (error) throw error;
}
