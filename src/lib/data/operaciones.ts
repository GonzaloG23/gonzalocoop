import { supabaseData, supabaseConfigured } from "./supabase";

const supabase = supabaseData.client;
const DEMO_COOPERADORA_ID = "demo-cooperadora-001";
export const DEMO_MOVIMIENTOS_KEY = "demo-movimientos";

export async function cerrarPeriodo(periodoId: string) {
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
