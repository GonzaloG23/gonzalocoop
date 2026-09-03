import { utils, writeFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { fechaCorta, money, nombreMes } from "./formato";
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
    head: [["Fecha", "Tipo", "Rubro", "Concepto", "Comprobante", "Monto"]],
    body: movimientos.map((m) => [
      fechaCorta(m.fecha),
      m.tipo === "ingreso" ? "Ingreso" : "Egreso",
      rubros.find((r) => r.id === m.rubro_id)?.nombre ?? "-",
      m.ajusta_movimiento_id ? `AJUSTE · ${m.concepto}` : m.concepto,
      m.comprobante ?? "-",
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
