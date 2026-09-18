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
  personaTipo: "alumno" | "oferente";
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
  const rubroLineas = doc.splitTextToSize(datos.rubro.toUpperCase(), 82);
  doc.text(rubroLineas, MARGEN_X + 95, y + 8, {
    align: "left",
    lineHeightFactor: 1,
  });

  doc.setFontSize(9);
  doc.text(
    `N° ${datos.comprobante || "—"}`,
    MARGEN_X + 5,
    y + 17,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(85, 85, 85);
  doc.text("COOPERADORA ESCOLAR", MARGEN_X + 5, y + 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const nombreInstitucional = doc.splitTextToSize(datos.cooperadora.nombre, 175);
  doc.text(nombreInstitucional, MARGEN_X + 5, y + 32, {
    lineHeightFactor: 1,
  });

  const institucion = [
    datos.cooperadora.cue ? `CUE ${datos.cooperadora.cue}` : null,
    datos.cooperadora.localidad,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (institucion) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text(institucion, MARGEN_X + 5, y + 39);
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(MARGEN_X + 5, y + 43, ANCHO_A4 - MARGEN_X - 5, y + 43);
  doc.setTextColor(0, 0, 0);

  const tieneDatosPersona =
    Boolean(datos.alumnoNombre || datos.alumnoDni || datos.alumnoCurso);

  if (tieneDatosPersona) {
    const esOferente = datos.personaTipo === "oferente";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      esOferente ? "DATOS DEL OFERENTE" : "DATOS DEL ALUMNO",
      MARGEN_X + 5,
      y + 51,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      `Nombre y apellido: ${datos.alumnoNombre}`,
      MARGEN_X + 5,
      y + 59,
    );

    doc.text(`DNI: ${datos.alumnoDni}`, MARGEN_X + 5, y + 66);

    if (!esOferente && datos.alumnoCurso) {
      doc.text(
        `Curso / grado: ${datos.alumnoCurso}`,
        MARGEN_X + 75,
        y + 66,
      );
    }
  }

  const desplazamientoPago = tieneDatosPersona ? 0 : -27;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DATOS DEL PAGO", MARGEN_X + 5, y + 78 + desplazamientoPago);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Fecha: ${fechaCorta(datos.fecha)}`, MARGEN_X + 5, y + 86 + desplazamientoPago);

  doc.text(
    `Medio de pago: ${datos.medioPago || "No informado"}`,
    MARGEN_X + 5,
    y + 93 + desplazamientoPago,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    `MONTO ABONADO: ${money(datos.monto)}`,
    MARGEN_X + 5,
    y + 107 + desplazamientoPago,
  );

  doc.setDrawColor(190, 190, 190);
  doc.line(
    MARGEN_X + 5,
    y + 113 + desplazamientoPago,
    ANCHO_A4 - MARGEN_X - 5,
    y + 106 + desplazamientoPago,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "Conservar este comprobante como constancia del pago.",
    MARGEN_X + 5,
    y + 123 + desplazamientoPago,
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
    `${datos.personaTipo === "oferente" ? "Oferente" : "Alumno/a"}: ${datos.alumnoNombre}`,
    `DNI: ${datos.alumnoDni}`,
    `Rubro: ${datos.rubro}`,
    `Monto abonado: ${money(datos.monto)}`,
    `Fecha: ${fechaCorta(datos.fecha)}`,
    "",
    "Se adjunta el comprobante de pago en PDF.",
  ].join("\n");
}

export function prepararComprobanteParaWhatsApp(
  datos: DatosComprobanteIngreso,
  telefono: string,
) {
  const destino = validarWhatsApp(telefono);
  descargarComprobanteIngreso(datos);

  const ventana = window.open(
    `https://web.whatsapp.com/send?phone=${destino}&text=${encodeURIComponent(mensajeComprobante(datos))}`,
    "_blank",
  );

  if (!ventana) {
    throw new Error(
      "El navegador bloqueó la apertura de WhatsApp Web. Permití las ventanas emergentes para continuar.",
    );
  }
}
