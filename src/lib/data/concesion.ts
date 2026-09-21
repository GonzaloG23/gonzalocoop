import { ministerioRequest, usingMinisterioApi } from "./index";

export type ConcesionKiosco = {
  apellido: string;
  nombre: string;
  canon: number | string;
  canonVigente: number | string;
  canonProrroga: number | string;
  canonProrrogaVigente: number | string;
  fechaFirmaContrato: string;
  fechaVencimientoContrato: string;
  tieneProrroga: boolean;
  fechaInicioProrroga: string;
  fechaVencimientoProrroga: string;
};

export type DocumentoConcesion = {
  nombreArchivo: string;
  tipo: string;
  tamano: number;
  actualizadoEn: string;
};

export type TipoDocumentoConcesion = "contrato" | "contrato_sellado" | "buena_conducta";

function fechaValida(valor: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    !Number.isNaN(new Date(valor + "T00:00:00").getTime())
  );
}

export function calcularVencimientoConcesion(fechaInicio: string, duracionAnios: number) {
  if (!fechaValida(fechaInicio)) return "";
  const [anio, mes, dia] = fechaInicio.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia));
  resultado.setUTCFullYear(resultado.getUTCFullYear() + duracionAnios);

  return [
    resultado.getUTCFullYear(),
    String(resultado.getUTCMonth() + 1).padStart(2, "0"),
    String(resultado.getUTCDate()).padStart(2, "0"),
  ].join("-");
}


export function calcularFechaActualizacionAnual(fechaInicio: string, aniosCumplidos = 1) {
  return calcularVencimientoConcesion(fechaInicio, aniosCumplidos);
}

export function calcularProximaActualizacionCanon(
  fechaInicio: string,
  fechaUltimaActualizacion = "",
) {
  if (!fechaValida(fechaInicio)) return "";
  const base = fechaUltimaActualizacion && fechaValida(fechaUltimaActualizacion)
    ? fechaUltimaActualizacion
    : fechaInicio;
  return calcularFechaActualizacionAnual(base, 1);
}

export function canonNecesitaActualizacion(fechaObjetivo: string, hoy = new Date()) {
  if (!fechaValida(fechaObjetivo)) return false;
  const [anio, mes, dia] = fechaObjetivo.split("-").map(Number);
  const objetivo = new Date(Date.UTC(anio, mes - 1, dia));
  const hoyUtc = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  return hoyUtc.getTime() >= objetivo.getTime();
}

export function calcularCanonActualizadoPorIPC(
  canonAnterior: number,
  indiceDesde: number,
  indiceHasta: number,
) {
  if (!Number.isFinite(canonAnterior) || canonAnterior < 0) {
    throw new Error("El canon anterior no es válido.");
  }
  if (!Number.isFinite(indiceDesde) || indiceDesde <= 0 || !Number.isFinite(indiceHasta) || indiceHasta <= 0) {
    throw new Error("Los índices IPC deben ser mayores que cero.");
  }

  return Math.round(canonAnterior * (indiceHasta / indiceDesde) * 100) / 100;
}

export function normalizarConcesion(datos: Partial<ConcesionKiosco>): ConcesionKiosco {
  const fechaFirmaContrato = String(datos.fechaFirmaContrato ?? "").trim();
  const tieneProrroga = Boolean(datos.tieneProrroga);
  const fechaInicioProrroga = tieneProrroga ? String(datos.fechaInicioProrroga ?? "").trim() : "";

  return {
    apellido: String(datos.apellido ?? "").trim(),
    nombre: String(datos.nombre ?? "").trim(),
    canon: datos.canon ?? "",
    canonVigente: datos.canonVigente ?? datos.canon ?? "",
    canonProrroga: datos.canonProrroga ?? "",
    canonProrrogaVigente: datos.canonProrrogaVigente ?? datos.canonProrroga ?? "",
    fechaFirmaContrato,
    fechaVencimientoContrato:
      String(datos.fechaVencimientoContrato ?? "").trim() ||
      calcularVencimientoConcesion(fechaFirmaContrato, 2),
    tieneProrroga,
    fechaInicioProrroga,
    fechaVencimientoProrroga:
      tieneProrroga
        ? String(datos.fechaVencimientoProrroga ?? "").trim() ||
          calcularVencimientoConcesion(fechaInicioProrroga, 1)
        : "",
  };
}

const DEMO_CONCESION_KEY_PREFIX = "demo-concesion-kiosco-";
const DEMO_DOCUMENTO_KEY_PREFIX = "demo-documento-concesion-";

function claveConcesion(cooperadoraId: string) {
  return `${DEMO_CONCESION_KEY_PREFIX}${cooperadoraId}`;
}

function claveDocumento(cooperadoraId: string, tipo: TipoDocumentoConcesion) {
  return `${DEMO_DOCUMENTO_KEY_PREFIX}${tipo}-${cooperadoraId}`;
}

function indexedDbDisponible() {
  return typeof indexedDB !== "undefined";
}

async function abrirDb() {
  if (!indexedDbDisponible()) throw new Error("El navegador no permite almacenamiento local de documentos.");
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("libro-cooperadoras", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documentos")) db.createObjectStore("documentos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
}

export async function cargarConcesionKiosco(cooperadoraId: string): Promise<ConcesionKiosco | null> {
  if (usingMinisterioApi()) {
    const datos = await ministerioRequest<ConcesionKiosco | null>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco`,
    );
    return datos ? normalizarConcesion(datos) : null;
  }

  try {
    const raw = localStorage.getItem(claveConcesion(cooperadoraId));
    if (!raw) return null;
    return normalizarConcesion(JSON.parse(raw) as Partial<ConcesionKiosco>);
  } catch {
    return null;
  }
}

export async function guardarConcesionKiosco(
  cooperadoraId: string,
  datos: ConcesionKiosco,
): Promise<ConcesionKiosco> {
  const canonTexto = String(datos.canon).trim().replace(",", ".");
  const canonProrrogaTexto = String(datos.canonProrroga ?? "").trim().replace(",", ".");
  const canonVigenteTexto = String(datos.canonVigente ?? datos.canon ?? "").trim().replace(",", ".");
  const canonProrrogaVigenteTexto = String(datos.canonProrrogaVigente ?? datos.canonProrroga ?? "").trim().replace(",", ".");
  const fechaFirmaContrato = String(datos.fechaFirmaContrato ?? "").trim();

  if (!canonTexto) throw new Error("Debés completar el canon del contrato original.");
  if (!fechaFirmaContrato) throw new Error("Debés completar la fecha de firma del contrato.");

  if (!fechaValida(fechaFirmaContrato)) {
    throw new Error("La fecha de firma del contrato no es válida.");
  }

  const tieneProrroga = Boolean(datos.tieneProrroga);
  const fechaInicioProrroga = tieneProrroga ? String(datos.fechaInicioProrroga ?? "").trim() : "";

  if (tieneProrroga && !fechaInicioProrroga) {
    throw new Error("Debés completar la fecha de inicio de la prórroga.");
  }
  if (fechaInicioProrroga && !fechaValida(fechaInicioProrroga)) {
    throw new Error("La fecha de inicio de la prórroga no es válida.");
  }

  if (tieneProrroga && !canonProrrogaTexto) {
    throw new Error("Debés completar el canon de la prórroga.");
  }

  const normalizados: ConcesionKiosco = {
    apellido: datos.apellido.trim(),
    nombre: datos.nombre.trim(),
    canon: Number(canonTexto),
    canonVigente: Number(canonVigenteTexto || canonTexto),
    canonProrroga: tieneProrroga ? Number(canonProrrogaTexto) : "",
    canonProrrogaVigente: tieneProrroga ? Number(canonProrrogaVigenteTexto || canonProrrogaTexto) : "",
    fechaFirmaContrato,
    fechaVencimientoContrato: calcularVencimientoConcesion(fechaFirmaContrato, 2),
    tieneProrroga,
    fechaInicioProrroga,
    fechaVencimientoProrroga: tieneProrroga
      ? calcularVencimientoConcesion(fechaInicioProrroga, 1)
      : "",
  };

  if (!normalizados.apellido) throw new Error("Debés completar el apellido del concesionario.");
  if (!normalizados.nombre) throw new Error("Debés completar el nombre del concesionario.");
  if (!Number.isFinite(normalizados.canon) || normalizados.canon < 0) {
    throw new Error("El canon inicial del contrato original debe ser un importe válido mayor o igual a cero.");
  }
  if (!Number.isFinite(Number(normalizados.canonVigente)) || Number(normalizados.canonVigente) < 0) {
    throw new Error("El canon vigente del contrato original debe ser un importe válido mayor o igual a cero.");
  }
  if (tieneProrroga && (!Number.isFinite(Number(normalizados.canonProrroga)) || Number(normalizados.canonProrroga) < 0)) {
    throw new Error("El canon inicial de la prórroga debe ser un importe válido mayor o igual a cero.");
  }
  if (tieneProrroga && (!Number.isFinite(Number(normalizados.canonProrrogaVigente)) || Number(normalizados.canonProrrogaVigente) < 0)) {
    throw new Error("El canon vigente de la prórroga debe ser un importe válido mayor o igual a cero.");
  }

  if (usingMinisterioApi()) {
    return ministerioRequest<ConcesionKiosco>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco`,
      {
        method: "PUT",
        body: JSON.stringify({ datos: normalizados }),
      },
    );
  }

  localStorage.setItem(claveConcesion(cooperadoraId), JSON.stringify(normalizados));
  return normalizados;
}

export async function cargarDocumentoConcesion(
  cooperadoraId: string,
  tipo: TipoDocumentoConcesion,
): Promise<DocumentoConcesion | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<DocumentoConcesion | null>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/${tipo}`,
    );
  }

  try {
    const raw = localStorage.getItem(claveDocumento(cooperadoraId, tipo));
    return raw ? (JSON.parse(raw) as DocumentoConcesion) : null;
  } catch {
    return null;
  }
}

export async function guardarDocumentoConcesion(
  cooperadoraId: string,
  tipo: TipoDocumentoConcesion,
  archivo: File,
) {
  if (archivo.type !== "application/pdf") {
    throw new Error("El documento debe estar en formato PDF.");
  }

  if (archivo.size > 3 * 1024 * 1024) {
    throw new Error("El PDF no puede superar los 3 MB.");
  }

  if (usingMinisterioApi()) {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return ministerioRequest<DocumentoConcesion>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/${tipo}`,
      {
        method: "POST",
        body: formData,
      },
    );
  }

  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("documentos", "readwrite");
    tx.objectStore("documentos").put(archivo, claveDocumento(cooperadoraId, tipo));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar el documento."));
  });
  db.close();

  const metadata: DocumentoConcesion = {
    nombreArchivo: archivo.name,
    tipo: archivo.type,
    tamano: archivo.size,
    actualizadoEn: new Date().toISOString(),
  };
  localStorage.setItem(claveDocumento(cooperadoraId, tipo), JSON.stringify(metadata));
  return metadata;
}

export async function abrirDocumentoConcesion(
  cooperadoraId: string,
  tipo: TipoDocumentoConcesion,
) {
  if (usingMinisterioApi()) {
    const resultado = await ministerioRequest<{ url: string } | null>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco/${tipo}/archivo`,
    );
    if (!resultado?.url) throw new Error("No hay un documento disponible.");
    window.open(resultado.url, "_blank", "noopener,noreferrer");
    return;
  }

  const db = await abrirDb();
  const archivo = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction("documentos", "readonly");
    const request = tx.objectStore("documentos").get(claveDocumento(cooperadoraId, tipo));
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el documento."));
  });
  db.close();
  if (!archivo) throw new Error("No hay un documento disponible.");

  const url = URL.createObjectURL(archivo);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
