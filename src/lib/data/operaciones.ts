import { supabaseData } from "./supabase";

const supabase = supabaseData.client;

export async function cerrarPeriodo(periodoId: string) {
  const { error } = await supabase
    .from("periodos")
    .update({ estado: "cerrado" })
    .eq("id", periodoId);
  if (error) throw error;
}

export async function insertarMovimiento(input: {
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
}) {
  const { error } = await supabase.from("movimientos").insert(input);
  if (error) throw error;
}
