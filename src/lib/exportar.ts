import { utils, writeFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { fechaCorta, money, nombreMes } from "./formato";
import { etiquetaFactura } from "./libro";
import type { Cooperadora, Movimiento, ResumenMes, Rubro } from "./libro";

function encabezado(doc: jsPDF, titulo: string, coop: Cooperadora, subtitulo: string) {
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

  let anguloActual = -Math.PI / 2;

  segmentos.forEach((segmento, indice) => {
    const amplitud = (segmento.porcentaje / 100) * Math.PI * 2;
    const color = COLORES_GRAFICO[indice % COLORES_GRAFICO.length];

    const puntos: Array<[number, number]> = [[0, 0]];
    const pasos = Math.max(4, Math.ceil(amplitud * 24));
    let anteriorX = 0;
    let anteriorY = 0;

    for (let paso = 0; paso <= pasos; paso += 1) {
      const angulo = anguloActual + (amplitud * paso) / pasos;
      const x = radio * Math.cos(angulo);
      const y = radio * Math.sin(angulo);
      puntos.push([x - anteriorX, y - anteriorY]);
      anteriorX = x;
      anteriorY = y;
    }

    doc.setFillColor(...color);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.lines(puntos, centroX, centroY, 1, "F", true);

    anguloActual += amplitud;
  });

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
  );
  autoTable(doc, {
    startY: 42,
    head: [["Fecha", "Tipo", "Rubro", "Concepto", "Comprobante", "Proveedor", "CUIT", "Factura", "Monto"]],
    body: movimientos.map((m) => [
      fechaCorta(m.fecha),
      m.tipo === "ingreso" ? "Ingreso" : "Egreso",
      rubros.find((r) => r.id === m.rubro_id)?.nombre ?? "-",
      m.ajusta_movimiento_id ? `AJUSTE · ${m.concepto}` : m.concepto,
      m.comprobante ?? "-",
      m.proveedor_razon_social ?? "-",
      m.proveedor_cuit ?? "-",
      etiquetaFactura(m.tipo_factura) || "-",
      money(m.monto),
    ]),
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

  doc.save(`planilla-${coop.ejercicio}-${String(resumen.mes).padStart(2, "0")}.pdf`);
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

export function exportarAnualPDF(coop: Cooperadora, resumen: ResumenMes[]) {
  const doc = new jsPDF();
  encabezado(doc, "Resumen anual de saldos", coop, `Ejercicio ${coop.ejercicio}`);
  autoTable(doc, {
    startY: 42,
    head: [["Mes", "Saldo inicial", "Ingresos", "Egresos", "Saldo final", "Estado"]],
    body: resumen.map((r) => [
      nombreMes(r.mes),
      money(r.saldoInicial),
      money(r.ingresos),
      money(r.egresos),
      money(r.saldoFinal),
      r.periodo?.estado === "cerrado" ? "Cerrado" : "Abierto",
    ]),
    foot: [
      [
        "Total del ejercicio",
        money(resumen[0]?.saldoInicial ?? 0),
        money(resumen.reduce((s, r) => s + r.ingresos, 0)),
        money(resumen.reduce((s, r) => s + r.egresos, 0)),
        money(resumen[11]?.saldoFinal ?? 0),
        "",
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 74, 58] },
    footStyles: { fillColor: [237, 233, 222], textColor: 20, fontStyle: "bold" },
  });
  doc.save(`resumen-anual-${coop.ejercicio}.pdf`);
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
