import { ministerioRequest, usingMinisterioApi } from "./index";

export type ConcesionKiosco = {
  apellido: string;
  nombre: string;
  canon: number | string;
};

export type DocumentoConcesion = {
  nombreArchivo: string;
  tipo: string;
  tamano: number;
  actualizadoEn: string;
};

export type TipoDocumentoConcesion = "contrato" | "buena_conducta";

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
    return ministerioRequest<ConcesionKiosco | null>(
      `/api/cooperadoras/${cooperadoraId}/concesion-kiosco`,
    );
  }

  try {
    const raw = localStorage.getItem(claveConcesion(cooperadoraId));
    if (!raw) return null;
    return JSON.parse(raw) as ConcesionKiosco;
  } catch {
    return null;
  }
}

export async function guardarConcesionKiosco(
  cooperadoraId: string,
  datos: ConcesionKiosco,
): Promise<ConcesionKiosco> {
  const canonTexto = String(datos.canon).trim().replace(",", ".");
  if (!canonTexto) throw new Error("Debés completar el canon.");

  const normalizados: ConcesionKiosco = {
    apellido: datos.apellido.trim(),
    nombre: datos.nombre.trim(),
    canon: Number(canonTexto),
  };

  if (!normalizados.apellido) throw new Error("Debés completar el apellido del concesionario.");
  if (!normalizados.nombre) throw new Error("Debés completar el nombre del concesionario.");
  if (!Number.isFinite(normalizados.canon) || normalizados.canon < 0) {
    throw new Error("El canon debe ser un importe válido mayor o igual a cero.");
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
