import { usingMinisterioApi, ministerioRequest } from "./index";
import { supabaseData, supabaseConfigured } from "./supabase";

const supabase = supabaseData.client;
const DEMO_COOPERADORA_ID = "demo-cooperadora-001";
export const DEMO_MOVIMIENTOS_KEY = "demo-movimientos";
export const DEMO_PERIODOS_CERRADOS_KEY = "demo-periodos-cerrados";

export async function cerrarPeriodo(periodoId: string) {
  if (usingMinisterioApi()) {
    await ministerioRequest<void>(`/api/periodos/${periodoId}/cerrar`, {
      method: "POST",
    });
    return;
  }

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
  if (usingMinisterioApi()) {
    return ministerioRequest<NuevoMovimiento & { id?: string; creado_en?: string }>(
      "/api/movimientos",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  if (!supabaseConfigured() && input.cooperadora_id === DEMO_COOPERADORA_ID) {
    const cerrados = JSON.parse(
      localStorage.getItem(DEMO_PERIODOS_CERRADOS_KEY) ?? "[]",
    ) as string[];

    if (cerrados.includes(input.periodo_id)) {
      throw new Error("El período está cerrado y no admite nuevos movimientos.");
    }

    // El movimiento debe tener una fecha correspondiente al mes seleccionado.
    const match = input.periodo_id.match(/^demo-periodo-(\d+)$/);
    if (match) {
      const mesPeriodo = Number(match[1]);
      const mesFecha = Number(input.fecha.slice(5, 7));
      if (mesFecha !== mesPeriodo) {
        throw new Error(
          "La fecha del movimiento debe pertenecer al mes seleccionado.",
        );
      }
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
