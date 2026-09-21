import { utils, writeFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { fechaCorta, money, nombreMes } from "./formato";
import { etiquetaFactura } from "./libro";
import type { Cooperadora, Movimiento, ResumenMes, Rubro } from "./libro";

function sanitizarNombreArchivo(valor: string, fallback = "Establecimiento") {
  const limpio = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return limpio || fallback;
}

function encabezado(
  doc: jsPDF,
  titulo: string,
  coop: Cooperadora,
  subtitulo: string,
  estadoRendicion?: string,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(coop.nombre, 14, 23);

  const datos = [
    coop.cue ? `CUE ${coop.cue}` : null,
    coop.cuit ? `CUIT ${coop.cuit}` : null,
    coop.localidad,
    `Ejercicio ${coop.ejercicio}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  doc.text(datos, 14, 29);
  doc.text(subtitulo, 14, 35);

  if (estadoRendicion) {
    doc.setFontSize(9);
    doc.text(`Estado de la rendición: ${estadoRendicion}`, 14, 41);
    doc.text(
      `Generado el ${new Date().toLocaleDateString("es-AR")}`,
      196,
      41,
      { align: "right" },
    );
  }
}

type SegmentoCircular = {
  nombre: string;
  monto: number;
  porcentaje: number;
};

const COLORES_GRAFICO: Array<[number, number, number]> = [
  [31, 74, 58],
  [52, 101, 164],
  [198, 121, 54],
  [125, 91, 166],
  [74, 127, 128],
  [182, 72, 72],
  [120, 120, 120],
  [72, 72, 72],
];

function agruparMovimientosPorRubro(
  movimientos: Movimiento[],
  rubros: Rubro[],
  tipo: "ingreso" | "egreso",
): SegmentoCircular[] {
  const acumulados = new Map<string, number>();

  for (const movimiento of movimientos) {
    if (movimiento.tipo !== tipo) continue;

    const nombre =
      rubros.find((rubro) => rubro.id === movimiento.rubro_id)?.nombre ??
      "Sin rubro";

    acumulados.set(nombre, (acumulados.get(nombre) ?? 0) + Number(movimiento.monto));
  }

  const total = Array.from(acumulados.values()).reduce((suma, valor) => suma + valor, 0);

  if (total <= 0) return [];

  const ordenados = Array.from(acumulados.entries())
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);

  const maxSegmentos = 7;
  const principales = ordenados.slice(0, maxSegmentos);
  const otros = ordenados.slice(maxSegmentos).reduce((suma, item) => suma + item.monto, 0);

  if (otros > 0) principales.push({ nombre: "Otros rubros", monto: otros });

  return principales.map((item) => ({
    ...item,
    porcentaje: (item.monto / total) * 100,
  }));
}

function dibujarGraficoCircular(
  doc: jsPDF,
  titulo: string,
  segmentos: SegmentoCircular[],
  centroX: number,
  centroY: number,
) {
  const radio = 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, centroX, 47, { align: "center" });

  if (segmentos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No hay movimientos para mostrar.", centroX, centroY, { align: "center" });
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;
  const contexto = canvas.getContext("2d");

  if (!contexto) {
    throw new Error("No se pudo crear el gráfico de movimientos.");
  }

  const centro = 160;
  const radioCanvas = 130;
  let anguloActual = -Math.PI / 2;

  segmentos.forEach((segmento, indice) => {
    const amplitud = (segmento.porcentaje / 100) * Math.PI * 2;
    const color = COLORES_GRAFICO[indice % COLORES_GRAFICO.length];

    contexto.beginPath();
    contexto.moveTo(centro, centro);
    contexto.arc(
      centro,
      centro,
      radioCanvas,
      anguloActual,
      anguloActual + amplitud,
    );
    contexto.closePath();
    contexto.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    contexto.fill();

    contexto.strokeStyle = "#ffffff";
    contexto.lineWidth = 2;
    contexto.stroke();

    anguloActual += amplitud;
  });

  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    centroX - radio,
    centroY - radio,
    radio * 2,
    radio * 2,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  let leyendaY = centroY + radio + 10;
  segmentos.forEach((segmento, indice) => {
    const color = COLORES_GRAFICO[indice % COLORES_GRAFICO.length];
    const porcentaje = segmento.porcentaje.toFixed(1).replace(".", ",");

    doc.setFillColor(...color);
    doc.rect(centroX - 50, leyendaY - 3, 4, 4, "F");

    const nombre = segmento.nombre.length > 27
      ? `${segmento.nombre.slice(0, 24)}…`
      : segmento.nombre;

    doc.text(
      `${nombre} · ${porcentaje}% · ${money(segmento.monto)}`,
      centroX - 44,
      leyendaY,
    );

    leyendaY += 7;
  });
}

function agregarAnalisisRubros(
  doc: jsPDF,
  movimientos: Movimiento[],
  rubros: Rubro[],
) {
  const ingresos = agruparMovimientosPorRubro(movimientos, rubros, "ingreso");
  const egresos = agruparMovimientosPorRubro(movimientos, rubros, "egreso");

  doc.addPage();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Distribución de movimientos por rubro", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Los porcentajes se calculan sobre el total de ingresos y egresos del mes.", 14, 25);

  dibujarGraficoCircular(doc, "Ingresos por rubro", ingresos, 63, 92);
  dibujarGraficoCircular(doc, "Egresos por rubro", egresos, 147, 92);

  const mayorIngreso = ingresos[0];
  const mayorEgreso = egresos[0];

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    mayorIngreso
      ? `Mayor fuente de ingresos: ${mayorIngreso.nombre} · ${money(mayorIngreso.monto)} (${mayorIngreso.porcentaje.toFixed(1).replace(".", ",")}% del total)`
      : "Mayor fuente de ingresos: no hay ingresos registrados.",
    14,
    208,
  );
  doc.text(
    mayorEgreso
      ? `Mayor rubro de gastos: ${mayorEgreso.nombre} · ${money(mayorEgreso.monto)} (${mayorEgreso.porcentaje.toFixed(1).replace(".", ",")}% del total)`
      : "Mayor rubro de gastos: no hay egresos registrados.",
    14,
    216,
  );
}

export function exportarMesPDF(
  coop: Cooperadora,
  resumen: ResumenMes,
  movimientos: Movimiento[],
  rubros: Rubro[],
) {
  const doc = new jsPDF();
  encabezado(
    doc,
    "Planilla mensual de movimientos",
    coop,
    `${nombreMes(resumen.mes)} de ${coop.ejercicio}`,
    resumen.periodo?.estado === "cerrado" ? "Cerrada" : "Abierta",
  );
  autoTable(doc, {
    startY: 48,
    head: [["Fecha", "Tipo", "Rubro", "Concepto", "Comprobante", "Proveedor", "CUIT", "Factura", "Monto"]],
    body: movimientos.length
      ? movimientos.map((m) => [
      fechaCorta(m.fecha),
      m.tipo === "ingreso" ? "Ingreso" : "Egreso",
      rubros.find((r) => r.id === m.rubro_id)?.nombre ?? "-",
      m.ajusta_movimiento_id ? `AJUSTE · ${m.concepto}` : m.concepto,
      m.comprobante ?? "-",
      m.proveedor_razon_social ?? "-",
      m.proveedor_cuit ?? "-",
      etiquetaFactura(m.tipo_factura) || "-",
      money(m.monto),
    ])
      : [["", "", "", "No hay movimientos registrados para este mes.", "", "", "", "", money(0)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 74, 58] },
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text(`Saldo inicial: ${money(resumen.saldoInicial)}`, 14, y);
  doc.text(`Ingresos: ${money(resumen.ingresos)}`, 14, y + 6);
  doc.text(`Egresos: ${money(resumen.egresos)}`, 14, y + 12);
  doc.setFont("helvetica", "bold");
  doc.text(`Saldo final: ${money(resumen.saldoFinal)}`, 14, y + 19);

  agregarAnalisisRubros(doc, movimientos, rubros);

  const nombreEstablecimiento = sanitizarNombreArchivo(coop.nombre);
  const identificador = coop.cue ? `_${sanitizarNombreArchivo(coop.cue, "")}` : "";
  const periodo = `${coop.ejercicio}-${String(resumen.mes).padStart(2, "0")}`;

  doc.save(`${nombreEstablecimiento}${identificador}_Movimientos_${periodo}.pdf`);
}

export function exportarMesExcel(
  coop: Cooperadora,
  resumen: ResumenMes,
  movimientos: Movimiento[],
  rubros: Rubro[],
) {
  const filas = movimientos.map((m) => ({
    Fecha: fechaCorta(m.fecha),
    Tipo: m.tipo === "ingreso" ? "Ingreso" : "Egreso",
    Rubro: rubros.find((r) => r.id === m.rubro_id)?.nombre ?? "",
    Concepto: m.concepto,
    "Medio de pago": m.medio_pago ?? "",
    Comprobante: m.comprobante ?? "",
    "Razón social": m.proveedor_razon_social ?? "",
    "CUIT proveedor": m.proveedor_cuit ?? "",
    "Tipo de factura": etiquetaFactura(m.tipo_factura),
    Ajuste: m.ajusta_movimiento_id ? "Sí" : "",
    "Motivo del ajuste": m.motivo_ajuste ?? "",
    Monto: Number(m.monto),
  }));
  const hoja = utils.json_to_sheet(filas);
  utils.sheet_add_aoa(
    hoja,
    [
      [],
      ["Saldo inicial", resumen.saldoInicial],
      ["Ingresos", resumen.ingresos],
      ["Egresos", resumen.egresos],
      ["Saldo final", resumen.saldoFinal],
    ],
    { origin: -1 },
  );
  const libro = utils.book_new();
  utils.book_append_sheet(libro, hoja, `${nombreMes(resumen.mes)}`.slice(0, 31));
  writeFile(libro, `planilla-${coop.ejercicio}-${String(resumen.mes).padStart(2, "0")}.xlsx`);
}

export function exportarAnualPDF(
  coop: Cooperadora,
  resumen: ResumenMes[],
  movimientos: Movimiento[],
  rubros: Rubro[],
) {
  const doc = new jsPDF();
  const totalIngresos = resumen.reduce((s, r) => s + r.ingresos, 0);
  const totalEgresos = resumen.reduce((s, r) => s + r.egresos, 0);
  const estadoEjercicio = resumen.every((r) => r.periodo?.estado === "cerrado")
    ? "Todos los meses cerrados"
    : "Ejercicio con meses abiertos";

  encabezado(
    doc,
    "Informe anual de movimientos",
    coop,
    `Ejercicio ${coop.ejercicio}`,
    estadoEjercicio,
  );

  autoTable(doc, {
    startY: 48,
    head: [["Mes", "Saldo inicial", "Ingresos", "Egresos", "Saldo final", "Estado"]],
    body: resumen.map((r) => [
      nombreMes(r.mes),
      money(r.saldoInicial),
      money(r.ingresos),
      money(r.egresos),
      money(r.saldoFinal),
      r.periodo?.estado === "cerrado" ? "Cerrado" : "Abierto",
    ]),
    foot: [[
      "Total del ejercicio",
      money(resumen[0]?.saldoInicial ?? 0),
      money(totalIngresos),
      money(totalEgresos),
      money(resumen[11]?.saldoFinal ?? 0),
      "",
    ]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 74, 58] },
    footStyles: { fillColor: [237, 233, 222], textColor: 20, fontStyle: "bold" },
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Movimientos registrados en el ejercicio: ${movimientos.length}`, 14, 142);
  doc.text(`Ingresos del ejercicio: ${money(totalIngresos)}`, 14, 149);
  doc.text(`Egresos del ejercicio: ${money(totalEgresos)}`, 14, 156);
  doc.setFont("helvetica", "normal");
  doc.text(
    "A continuación se detalla la totalidad de los movimientos registrados, mes por mes.",
    14,
    166,
  );

  for (const resumenMes of resumen) {
    doc.addPage();
    encabezado(
      doc,
      "Detalle mensual de movimientos",
      coop,
      `${nombreMes(resumenMes.mes)} de ${coop.ejercicio}`,
      resumenMes.periodo?.estado === "cerrado" ? "Cerrada" : "Abierta",
    );

    const movimientosMes = movimientos
      .filter((m) => Number(m.fecha.slice(0, 7).split("-")[1]) === resumenMes.mes)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Saldo inicial: ${money(resumenMes.saldoInicial)}`, 14, 54);
    doc.text(`Ingresos: ${money(resumenMes.ingresos)}`, 14, 61);
    doc.text(`Egresos: ${money(resumenMes.egresos)}`, 14, 68);
    doc.text(`Saldo final: ${money(resumenMes.saldoFinal)}`, 14, 75);

    autoTable(doc, {
      startY: 82,
      head: [["Fecha", "Tipo", "Rubro", "Concepto", "Comprobante", "Proveedor", "CUIT", "Factura", "Monto"]],
      body: movimientosMes.length
        ? movimientosMes.map((m) => [
            fechaCorta(m.fecha),
            m.tipo === "ingreso" ? "Ingreso" : "Egreso",
            rubros.find((r) => r.id === m.rubro_id)?.nombre ?? "-",
            m.ajusta_movimiento_id ? `AJUSTE · ${m.concepto}` : m.concepto,
            m.comprobante ?? "-",
            m.proveedor_razon_social ?? "-",
            m.proveedor_cuit ?? "-",
            etiquetaFactura(m.tipo_factura) || "-",
            money(m.monto),
          ])
        : [["", "", "", "No hay movimientos registrados para este mes.", "", "", "", "", money(0)]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 74, 58] },
    });
  }

  const nombreEstablecimiento = sanitizarNombreArchivo(coop.nombre);
  const identificador = coop.cue ? `_${sanitizarNombreArchivo(coop.cue, "")}` : "";
  doc.save(`${nombreEstablecimiento}${identificador}_Movimientos_Anual_${coop.ejercicio}.pdf`);
}

export function exportarAnualExcel(coop: Cooperadora, resumen: ResumenMes[]) {
  const filas = resumen.map((r) => ({
    Mes: nombreMes(r.mes),
    "Saldo inicial": r.saldoInicial,
    Ingresos: r.ingresos,
    Egresos: r.egresos,
    "Saldo final": r.saldoFinal,
    Movimientos: r.cantidad,
    Estado: r.periodo?.estado === "cerrado" ? "Cerrado" : "Abierto",
    Observaciones: r.alertas.join(" / "),
  }));
  const hoja = utils.json_to_sheet(filas);
  const libro = utils.book_new();
  utils.book_append_sheet(libro, hoja, `Ejercicio ${coop.ejercicio}`.slice(0, 31));
  writeFile(libro, `resumen-anual-${coop.ejercicio}.xlsx`);
}

export function exportarComparativoExcel(
  filas: Array<Record<string, string | number>>,
  nombreArchivo = "comparativo-cooperadoras.xlsx",
) {
  const hoja = utils.json_to_sheet(filas);
  const libro = utils.book_new();
  utils.book_append_sheet(libro, hoja, "Comparativo");
  writeFile(libro, nombreArchivo);
}
