import { ministerioRequest, usingMinisterioApi } from "./index";

export type ResumenBancario = {
  nombreArchivo: string;
  tipo: string;
  tamano: number;
  actualizadoEn: string;
};

const DEMO_RESUMEN_BANCARIO_KEY_PREFIX = "demo-resumen-bancario-";

function claveResumenBancario(cooperadoraId: string) {
  return `${DEMO_RESUMEN_BANCARIO_KEY_PREFIX}${cooperadoraId}`;
}

function indexedDbDisponible() {
  return typeof indexedDB !== "undefined";
}

async function abrirDb() {
  if (!indexedDbDisponible()) {
    throw new Error("El navegador no permite almacenamiento local de documentos.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("libro-cooperadoras", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documentos")) {
        db.createObjectStore("documentos");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
}

export function calcularProximaActualizacionResumenBancario(actualizadoEn: string) {
  const fecha = new Date(actualizadoEn);
  if (Number.isNaN(fecha.getTime())) return null;
  const proxima = new Date(fecha);
  proxima.setMonth(proxima.getMonth() + 6);
  return proxima;
}

export function resumenBancarioVencido(resumen: ResumenBancario | null | undefined, hoy = new Date()) {
  if (!resumen) return true;
  const proxima = calcularProximaActualizacionResumenBancario(resumen.actualizadoEn);
  return !proxima || proxima.getTime() < hoy.getTime();
}

export async function cargarResumenBancario(
  cooperadoraId: string,
): Promise<ResumenBancario | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<ResumenBancario | null>(
      `/api/cooperadoras/${cooperadoraId}/resumen-bancario`,
    );
  }

  try {
    const raw = localStorage.getItem(claveResumenBancario(cooperadoraId));
    if (!raw) return null;
    return JSON.parse(raw) as ResumenBancario;
  } catch {
    return null;
  }
}

export async function guardarResumenBancario(
  cooperadoraId: string,
  archivo: File,
): Promise<ResumenBancario> {
  if (archivo.type !== "application/pdf") {
    throw new Error("El resumen bancario debe estar en formato PDF.");
  }

  if (archivo.size > 3 * 1024 * 1024) {
    throw new Error("El resumen bancario no puede superar los 3 MB.");
  }

  if (usingMinisterioApi()) {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return ministerioRequest<ResumenBancario>(
      `/api/cooperadoras/${cooperadoraId}/resumen-bancario`,
      {
        method: "POST",
        body: formData,
      },
    );
  }

  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("documentos", "readwrite");
    tx.objectStore("documentos").put(archivo, claveResumenBancario(cooperadoraId));
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("No se pudo guardar el resumen bancario."));
  });
  db.close();

  const metadata: ResumenBancario = {
    nombreArchivo: archivo.name,
    tipo: archivo.type,
    tamano: archivo.size,
    actualizadoEn: new Date().toISOString(),
  };

  localStorage.setItem(claveResumenBancario(cooperadoraId), JSON.stringify(metadata));
  return metadata;
}

export async function abrirResumenBancario(cooperadoraId: string) {
  if (usingMinisterioApi()) {
    const resultado = await ministerioRequest<{ url: string } | null>(
      `/api/cooperadoras/${cooperadoraId}/resumen-bancario/archivo`,
    );
    if (!resultado?.url) throw new Error("No hay un resumen bancario disponible.");
    window.open(resultado.url, "_blank", "noopener,noreferrer");
    return;
  }

  const db = await abrirDb();
  const archivo = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction("documentos", "readonly");
    const request = tx.objectStore("documentos").get(claveResumenBancario(cooperadoraId));
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo leer el resumen bancario."));
  });
  db.close();

  if (!archivo) throw new Error("No hay un resumen bancario disponible.");

  const url = URL.createObjectURL(archivo);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
