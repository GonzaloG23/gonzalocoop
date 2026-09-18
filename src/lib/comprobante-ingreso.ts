import { jsPDF } from "jspdf";

import type { Cooperadora } from "./libro";
import { fechaCorta, money } from "./formato";

export type DatosComprobanteIngreso = {
  cooperadora: Cooperadora;
  fecha: string;
  rubro: string;
  concepto: string;
  monto: number;
  medioPago: string;
  comprobante: string;
  alumnoNombre: string;
  alumnoDni: string;
  alumnoCurso: string;
};

function crearDocumento(datos: DatosComprobanteIngreso) {
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("COMPROBANTE DE INGRESO", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(datos.cooperadora.nombre, 14, 28);

  const institucion = [
    datos.cooperadora.cue ? `CUE ${datos.cooperadora.cue}` : null,
    datos.cooperadora.localidad,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (institucion) doc.text(institucion, 14, 34);

  doc.setDrawColor(180, 180, 180);
  doc.line(14, 40, 196, 40);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos del alumno", 14, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nombre y apellido: ${datos.alumnoNombre}`, 14, 60);
  doc.text(`DNI: ${datos.alumnoDni}`, 14, 67);

  if (datos.alumnoCurso) {
    doc.text(`Curso / grado: ${datos.alumnoCurso}`, 14, 74);
  }

  const inicioPago = datos.alumnoCurso ? 86 : 79;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos del pago", 14, inicioPago);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fecha: ${fechaCorta(datos.fecha)}`, 14, inicioPago + 8);
  doc.text(`Concepto: ${datos.rubro}`, 14, inicioPago + 15);
  doc.text(`Detalle: ${datos.concepto}`, 14, inicioPago + 22);
  doc.text(`Medio de pago: ${datos.medioPago || "No informado"}`, 14, inicioPago + 29);

  if (datos.comprobante) {
    doc.text(`N° de comprobante: ${datos.comprobante}`, 14, inicioPago + 36);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Monto abonado: ${money(datos.monto)}`, 14, inicioPago + 51);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "Constancia correspondiente al ingreso registrado en el Libro Mensual de la Cooperadora.",
    14,
    145,
  );
  doc.text(
    "Conservar este comprobante como constancia del pago realizado.",
    14,
    151,
  );

  return doc;
}

export function generarComprobanteIngreso(datos: DatosComprobanteIngreso) {
  const doc = crearDocumento(datos);
  const nombreArchivo = `comprobante-ingreso-${datos.fecha}-${datos.alumnoDni}.pdf`;
  return {
    blob: doc.output("blob"),
    nombreArchivo,
  };
}

export function descargarComprobanteIngreso(datos: DatosComprobanteIngreso) {
  const doc = crearDocumento(datos);
  const nombreArchivo = `comprobante-ingreso-${datos.fecha}-${datos.alumnoDni}.pdf`;
  doc.save(nombreArchivo);
}

export function abrirComprobanteIngresoParaImprimir(datos: DatosComprobanteIngreso) {
  const { blob } = generarComprobanteIngreso(datos);
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, "_blank", "noopener,noreferrer");

  if (!ventana) {
    URL.revokeObjectURL(url);
    throw new Error("El navegador bloqueó la apertura del comprobante. Permití las ventanas emergentes para imprimirlo.");
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function telefonoWhatsApp(telefono: string) {
  return telefono.replace(/\D/g, "");
}

export function abrirComprobantePorEmail(
  datos: DatosComprobanteIngreso,
  email: string,
) {
  const destino = email.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
    throw new Error("Ingresá una dirección de correo electrónico válida.");
  }

  descargarComprobanteIngreso(datos);

  const asunto = `Comprobante de pago - ${datos.rubro}`;
  const cuerpo = [
    `Escuela: ${datos.cooperadora.nombre}`,
    `Alumno/a: ${datos.alumnoNombre}`,
    `DNI: ${datos.alumnoDni}`,
    `Concepto: ${datos.rubro}`,
    `Monto abonado: ${money(datos.monto)}`,
    `Fecha: ${fechaCorta(datos.fecha)}`,
    "",
    "Se adjunta el comprobante de pago en PDF.",
  ].join("\n");

  window.location.href = `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export function abrirComprobantePorWhatsApp(
  datos: DatosComprobanteIngreso,
  telefono: string,
) {
  const destino = telefonoWhatsApp(telefono);

  if (destino.length < 8) {
    throw new Error("Ingresá un número de WhatsApp válido con código de país.");
  }

  descargarComprobanteIngreso(datos);

  const mensaje = [
    `Comprobante de pago - ${datos.rubro}`,
    `Escuela: ${datos.cooperadora.nombre}`,
    `Alumno/a: ${datos.alumnoNombre}`,
    `DNI: ${datos.alumnoDni}`,
    `Monto abonado: ${money(datos.monto)}`,
    `Fecha: ${fechaCorta(datos.fecha)}`,
    "",
    "El comprobante PDF se descargó para adjuntarlo a este mensaje.",
  ].join("\n");

  window.open(
    `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
