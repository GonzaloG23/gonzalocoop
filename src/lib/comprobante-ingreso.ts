import { jsPDF } from "jspdf";

import { ministerioApiConfigured, ministerioRequest } from "./data";
import { fechaCorta, money } from "./formato";
import type { Cooperadora } from "./libro";

export type DatosComprobanteIngreso = {
  cooperadora: Cooperadora;
  fecha: string;
  rubro: string;
  monto: number;
  medioPago: string;
  comprobante: string;
  alumnoNombre: string;
  alumnoDni: string;
  alumnoCurso: string;
};

const ANCHO_A4 = 210;
const ALTO_A4 = 297;
const MARGEN_X = 10;
const ANCHO_COMPROBANTE = ANCHO_A4 - MARGEN_X * 2;
const ALTO_COMPROBANTE = 134;

function dibujarComprobante(
  doc: jsPDF,
  datos: DatosComprobanteIngreso,
  y: number,
) {
  doc.setDrawColor(155, 155, 155);
  doc.roundedRect(
    MARGEN_X,
    y,
    ANCHO_COMPROBANTE,
    ALTO_COMPROBANTE,
    2,
    2,
  );

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COMPROBANTE DE INGRESO", MARGEN_X + 5, y + 9);

  doc.setFontSize(10);
  doc.text(
    `N° ${datos.comprobante || "—"}`,
    ANCHO_A4 - MARGEN_X - 5,
    y + 9,
    { align: "right" },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(datos.cooperadora.nombre, MARGEN_X + 5, y + 17);

  const institucion = [
    datos.cooperadora.cue ? `CUE ${datos.cooperadora.cue}` : null,
    datos.cooperadora.localidad,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (institucion) {
    doc.text(institucion, MARGEN_X + 5, y + 23);
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(MARGEN_X + 5, y + 27, ANCHO_A4 - MARGEN_X - 5, y + 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DATOS DEL ALUMNO", MARGEN_X + 5, y + 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Nombre y apellido: ${datos.alumnoNombre}`, MARGEN_X + 5, y + 43);
  doc.text(`DNI: ${datos.alumnoDni}`, MARGEN_X + 5, y + 50);

  if (datos.alumnoCurso) {
    doc.text(`Curso / grado: ${datos.alumnoCurso}`, MARGEN_X + 75, y + 50);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DATOS DEL PAGO", MARGEN_X + 5, y + 62);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Fecha: ${fechaCorta(datos.fecha)}`, MARGEN_X + 5, y + 70);
  doc.text(`Rubro: ${datos.rubro}`, MARGEN_X + 65, y + 70);
  doc.text(
    `Medio de pago: ${datos.medioPago || "No informado"}`,
    MARGEN_X + 5,
    y + 77,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    `MONTO ABONADO: ${money(datos.monto)}`,
    MARGEN_X + 5,
    y + 91,
  );

  doc.setDrawColor(190, 190, 190);
  doc.line(MARGEN_X + 5, y + 97, ANCHO_A4 - MARGEN_X - 5, y + 97);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "Constancia del ingreso registrado en el Libro Mensual de la Cooperadora.",
    MARGEN_X + 5,
    y + 107,
  );
  doc.text(
    "Las anulaciones o devoluciones se registran mediante ajuste contable.",
    MARGEN_X + 5,
    y + 114,
  );
  doc.text(
    "Conservar este comprobante como constancia del pago.",
    MARGEN_X + 5,
    y + 123,
  );

  doc.setTextColor(0, 0, 0);
}

export const DEMO_COMPROBANTES_KEY = "demo-comprobantes-ingreso-v1";

function crearDocumento(datos: DatosComprobanteIngreso) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  dibujarComprobante(doc, datos, 8);
  return doc;
}

function crearDocumentoDosComprobantes(
  comprobantes: [DatosComprobanteIngreso, DatosComprobanteIngreso],
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  dibujarComprobante(doc, comprobantes[0], 8);
  dibujarComprobante(doc, comprobantes[1], 155);

  doc.setDrawColor(190, 190, 190);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, 148.5, 200, 148.5);
  doc.setLineDashPattern([], 0);

  return doc;
}

export function guardarComprobanteIngresoDemo(datos: DatosComprobanteIngreso) {
  if (typeof window === "undefined") return;

  const actuales = JSON.parse(
    localStorage.getItem(DEMO_COMPROBANTES_KEY) ?? "[]",
  ) as DatosComprobanteIngreso[];

  const sinDuplicado = actuales.filter(
    (item) => item.comprobante !== datos.comprobante,
  );

  sinDuplicado.push(datos);
  localStorage.setItem(DEMO_COMPROBANTES_KEY, JSON.stringify(sinDuplicado));
}

export function cargarComprobantesIngresoDemo() {
  if (typeof window === "undefined") return [] as DatosComprobanteIngreso[];

  try {
    return JSON.parse(
      localStorage.getItem(DEMO_COMPROBANTES_KEY) ?? "[]",
    ) as DatosComprobanteIngreso[];
  } catch {
    return [] as DatosComprobanteIngreso[];
  }
}

export function generarComprobanteIngreso(datos: DatosComprobanteIngreso) {
  const doc = crearDocumento(datos);
  const nombreArchivo = `comprobante-ingreso-${datos.comprobante.replace(/[^0-9-]/g, "")}.pdf`;

  return {
    blob: doc.output("blob"),
    nombreArchivo,
  };
}

export function generarDosComprobantesIngreso(
  comprobantes: [DatosComprobanteIngreso, DatosComprobanteIngreso],
) {
  if (comprobantes[0].comprobante === comprobantes[1].comprobante) {
    throw new Error("Para imprimir una hoja A4 se necesitan dos comprobantes distintos.");
  }

  const doc = crearDocumentoDosComprobantes(comprobantes);
  const nombreArchivo = `comprobantes-ingreso-${comprobantes[0].comprobante.replace(/[^0-9-]/g, "")}-${comprobantes[1].comprobante.replace(/[^0-9-]/g, "")}.pdf`;

  return {
    blob: doc.output("blob"),
    nombreArchivo,
  };
}

export function descargarComprobanteIngreso(datos: DatosComprobanteIngreso) {
  const doc = crearDocumento(datos);
  const nombreArchivo = `comprobante-ingreso-${datos.comprobante.replace(/[^0-9-]/g, "")}.pdf`;
  doc.save(nombreArchivo);
}

export function abrirComprobantesIngresoParaImprimir(
  comprobantes: [DatosComprobanteIngreso, DatosComprobanteIngreso],
) {
  const { blob } = generarDosComprobantesIngreso(comprobantes);
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, "_blank");

  if (!ventana) {
    URL.revokeObjectURL(url);
    throw new Error(
      "El navegador bloqueó la apertura del comprobante. Permití las ventanas emergentes para imprimirlo.",
    );
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function abrirComprobanteIngresoParaImprimir(
  datos: DatosComprobanteIngreso,
) {
  const { blob } = generarComprobanteIngreso(datos);
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, "_blank");

  if (!ventana) {
    URL.revokeObjectURL(url);
    throw new Error(
      "El navegador bloqueó la apertura del comprobante. Permití las ventanas emergentes para imprimirlo.",
    );
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function validarEmail(email: string) {
  const destino = email.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
    throw new Error("Ingresá una dirección de correo electrónico válida.");
  }

  return destino;
}

function validarWhatsApp(telefono: string) {
  const destino = telefono.replace(/\D/g, "");

  if (destino.length < 8) {
    throw new Error(
      "Ingresá un número de WhatsApp válido con código de país.",
    );
  }

  return destino;
}

function mensajeComprobante(datos: DatosComprobanteIngreso) {
  return [
    `Comprobante de pago N° ${datos.comprobante}`,
    `Escuela: ${datos.cooperadora.nombre}`,
    `Alumno/a: ${datos.alumnoNombre}`,
    `DNI: ${datos.alumnoDni}`,
    `Rubro: ${datos.rubro}`,
    `Monto abonado: ${money(datos.monto)}`,
    `Fecha: ${fechaCorta(datos.fecha)}`,
  ].join("\n");
}

async function enviarComprobante(
  path: string,
  campoDestino: string,
  destino: string,
  datos: DatosComprobanteIngreso,
) {
  if (!ministerioApiConfigured()) {
    throw new Error(
      "El envío automático requiere la API del Ministerio configurada. No se utilizará mailto ni WhatsApp Web porque no pueden adjuntar el PDF automáticamente.",
    );
  }

  const { blob, nombreArchivo } = generarComprobanteIngreso(datos);
  const form = new FormData();
  form.append("archivo", blob, nombreArchivo);
  form.append(campoDestino, destino);
  form.append("numero_comprobante", datos.comprobante);
  form.append("asunto", `Comprobante de pago N° ${datos.comprobante}`);
  form.append("mensaje", mensajeComprobante(datos));

  await ministerioRequest<{ message?: string }>(path, {
    method: "POST",
    body: form,
  });
}

export async function enviarComprobantePorEmail(
  datos: DatosComprobanteIngreso,
  email: string,
) {
  const destino = validarEmail(email);
  await enviarComprobante(
    "/api/comprobantes/email",
    "email",
    destino,
    datos,
  );
}

export async function enviarComprobantePorWhatsApp(
  datos: DatosComprobanteIngreso,
  telefono: string,
) {
  const destino = validarWhatsApp(telefono);
  await enviarComprobante(
    "/api/comprobantes/whatsapp",
    "telefono",
    destino,
    datos,
  );
}
