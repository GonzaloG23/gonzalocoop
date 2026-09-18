import { jsPDF } from "jspdf";

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
    "Conservar este comprobante como constancia del pago.",
    MARGEN_X + 5,
    y + 107,
  );

  doc.setTextColor(0, 0, 0);
}

function crearDocumento(datos: DatosComprobanteIngreso) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  dibujarComprobante(doc, datos, 8);
  return doc;
}

export function generarComprobanteIngreso(datos: DatosComprobanteIngreso) {
  const doc = crearDocumento(datos);
  const nombreArchivo = `comprobante-ingreso-${datos.comprobante.replace(/[^0-9-]/g, "")}.pdf`;

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
    throw new Error("Ingresá un número de WhatsApp válido con código de país.");
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
    "",
    "Se adjunta el comprobante de pago en PDF.",
  ].join("\n");
}

export function prepararComprobanteParaEmail(
  datos: DatosComprobanteIngreso,
  email: string,
) {
  const destino = validarEmail(email);
  descargarComprobanteIngreso(datos);

  const asunto = `Comprobante de pago N° ${datos.comprobante}`;
  const cuerpo = mensajeComprobante(datos);

  window.location.href =
    `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export async function prepararComprobanteParaWhatsApp(
  datos: DatosComprobanteIngreso,
  telefono: string,
) {
  const destino = validarWhatsApp(telefono);
  const { blob, nombreArchivo } = generarComprobanteIngreso(datos);
  const archivo = new File([blob], nombreArchivo, { type: "application/pdf" });
  const mensaje = mensajeComprobante(datos);

  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [archivo] })
  ) {
    await navigator.share({
      files: [archivo],
      text: mensaje,
      title: `Comprobante de pago N° ${datos.comprobante}`,
    });
    return;
  }

  descargarComprobanteIngreso(datos);

  const ventana = window.open(
    `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`,
    "_blank",
  );

  if (!ventana) {
    throw new Error(
      "El navegador bloqueó la apertura de WhatsApp. Permití las ventanas emergentes para continuar.",
    );
  }
}
