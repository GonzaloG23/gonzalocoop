import { ministerioRequest, usingMinisterioApi } from "./index";

export type CargoComision =
  | "presidente"
  | "secretario"
  | "tesorero"
  | "vocal_1"
  | "vocal_2"
  | "revisor_cuentas"
  | "asesor_director";

export type MiembroComision = {
  cargo: CargoComision;
  nombre: string;
  dni: string;
};

export type ActaConstitucion = {
  nombreArchivo: string;
  tipo: string;
  tamano: number;
  actualizadoEn: string;
};

const DEMO_COMISION_KEY_PREFIX = "demo-comision-directiva-";
const DEMO_ACTA_KEY_PREFIX = "demo-acta-constitucion-";

function claveComision(cooperadoraId: string) {
  return `${DEMO_COMISION_KEY_PREFIX}${cooperadoraId}`;
}

function claveActa(cooperadoraId: string) {
  return `${DEMO_ACTA_KEY_PREFIX}${cooperadoraId}`;
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

export async function cargarComisionDirectiva(cooperadoraId: string): Promise<MiembroComision[]> {
  if (usingMinisterioApi()) {
    return ministerioRequest<MiembroComision[]>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva`,
    );
  }

  try {
    const raw = localStorage.getItem(claveComision(cooperadoraId));
    if (!raw) return [];
    const datos = JSON.parse(raw) as MiembroComision[];
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export async function guardarComisionDirectiva(
  cooperadoraId: string,
  miembros: MiembroComision[],
) {
  const datos = miembros
    .map((miembro) => ({
      cargo: miembro.cargo,
      nombre: miembro.nombre.trim(),
      dni: miembro.dni.trim(),
    }))
    .filter((miembro) => miembro.nombre);

  if (usingMinisterioApi()) {
    return ministerioRequest<MiembroComision[]>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva`,
      {
        method: "PUT",
        body: JSON.stringify({ miembros: datos }),
      },
    );
  }

  localStorage.setItem(claveComision(cooperadoraId), JSON.stringify(datos));
  return datos;
}

export async function cargarActaConstitucion(cooperadoraId: string): Promise<ActaConstitucion | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<ActaConstitucion | null>(
      `/api/cooperadoras/${cooperadoraId}/acta-constitucion`,
    );
  }

  try {
    const raw = localStorage.getItem(claveActa(cooperadoraId));
    return raw ? (JSON.parse(raw) as ActaConstitucion) : null;
  } catch {
    return null;
  }
}

export async function guardarActaConstitucion(cooperadoraId: string, archivo: File) {
  if (archivo.type !== "application/pdf") {
    throw new Error("El acta debe estar en formato PDF.");
  }

  if (usingMinisterioApi()) {
    const formData = new FormData();
    formData.append("archivo", archivo);
    return ministerioRequest<ActaConstitucion>(
      `/api/cooperadoras/${cooperadoraId}/acta-constitucion`,
      {
        method: "POST",
        body: formData,
      },
    );
  }

  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("documentos", "readwrite");
    tx.objectStore("documentos").put(archivo, claveActa(cooperadoraId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar el acta."));
  });
  db.close();

  const metadata: ActaConstitucion = {
    nombreArchivo: archivo.name,
    tipo: archivo.type,
    tamano: archivo.size,
    actualizadoEn: new Date().toISOString(),
  };
  localStorage.setItem(claveActa(cooperadoraId), JSON.stringify(metadata));
  return metadata;
}

export async function abrirActaConstitucion(cooperadoraId: string) {
  if (usingMinisterioApi()) {
    const resultado = await ministerioRequest<{ url: string } | null>(
      `/api/cooperadoras/${cooperadoraId}/acta-constitucion/archivo`,
    );
    if (!resultado?.url) throw new Error("No hay un archivo de acta disponible.");
    window.open(resultado.url, "_blank", "noopener,noreferrer");
    return;
  }

  const db = await abrirDb();
  const archivo = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction("documentos", "readonly");
    const request = tx.objectStore("documentos").get(claveActa(cooperadoraId));
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el acta."));
  });
  db.close();
  if (!archivo) throw new Error("No hay un archivo de acta disponible.");

  const url = URL.createObjectURL(archivo);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
