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

export type DatosComisionDirectiva = {
  miembros: MiembroComision[];
  fechaInicioMandato: string | null;
  fechaFinMandato: string | null;
  numeroPeriodo: number;
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

function fechaLocalISO(fecha: Date) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");
}

export function calcularFinMandato(fechaInicio: string) {
  const fecha = new Date(`${fechaInicio}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) throw new Error("La fecha de inicio del mandato no es válida.");
  fecha.setFullYear(fecha.getFullYear() + 2);
  return fechaLocalISO(fecha);
}

export function diasParaVencimientoMandato(fechaFin: string | null, hoy = new Date()) {
  if (!fechaFin) return null;
  const fin = new Date(`${fechaFin}T00:00:00`);
  const actual = new Date(`${fechaLocalISO(hoy)}T00:00:00`);
  if (Number.isNaN(fin.getTime()) || Number.isNaN(actual.getTime())) return null;
  return Math.ceil((fin.getTime() - actual.getTime()) / 86_400_000);
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

export async function cargarComisionDirectiva(cooperadoraId: string): Promise<DatosComisionDirectiva | null> {
  if (usingMinisterioApi()) {
    return ministerioRequest<DatosComisionDirectiva | null>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva`,
    );
  }

  try {
    const raw = localStorage.getItem(claveComision(cooperadoraId));
    if (!raw) return null;
    const datos = JSON.parse(raw) as DatosComisionDirectiva | MiembroComision[];

    if (Array.isArray(datos)) {
      return {
        miembros: datos,
        fechaInicioMandato: null,
        fechaFinMandato: null,
        numeroPeriodo: 0,
      };
    }

    return {
      miembros: Array.isArray(datos.miembros) ? datos.miembros : [],
      fechaInicioMandato: datos.fechaInicioMandato ?? null,
      fechaFinMandato: datos.fechaFinMandato ?? null,
      numeroPeriodo: Number(datos.numeroPeriodo) || 0,
    };
  } catch {
    return null;
  }
}

export async function guardarComisionDirectiva(
  cooperadoraId: string,
  miembros: MiembroComision[],
  mandato?: {
    fechaInicioMandato: string | null;
    fechaFinMandato: string | null;
    numeroPeriodo: number;
  },
) {
  const datos = miembros
    .map((miembro) => ({
      cargo: miembro.cargo,
      nombre: miembro.nombre.trim(),
      dni: miembro.dni.trim(),
    }))
    .filter((miembro) => miembro.nombre);

  const presidente = datos.find((miembro) => miembro.cargo === "presidente");
  const tesorero = datos.find((miembro) => miembro.cargo === "tesorero");

  if (!presidente?.nombre) {
    throw new Error("Debés completar el nombre y apellido del Presidente.");
  }

  if (!tesorero?.nombre) {
    throw new Error("Debés completar el nombre y apellido del Tesorero.");
  }

  const dniInvalido = datos.find(
    (miembro) => miembro.dni !== "" && !/^\d{8}$/.test(miembro.dni),
  );

  if (dniInvalido) {
    throw new Error(`El DNI de ${dniInvalido.nombre || dniInvalido.cargo} debe tener exactamente 8 dígitos numéricos.`);
  }

  if (usingMinisterioApi()) {
    return ministerioRequest<DatosComisionDirectiva>(
      `/api/cooperadoras/${cooperadoraId}/comision-directiva`,
      {
        method: "PUT",
        body: JSON.stringify({
          miembros: datos,
          fecha_inicio_mandato: mandato?.fechaInicioMandato ?? null,
          fecha_fin_mandato: mandato?.fechaFinMandato ?? null,
          numero_periodo: mandato?.numeroPeriodo ?? 0,
        }),
      },
    );
  }

  const actual: DatosComisionDirectiva = {
    miembros: datos,
    fechaInicioMandato: mandato?.fechaInicioMandato ?? null,
    fechaFinMandato: mandato?.fechaFinMandato ?? null,
    numeroPeriodo: mandato?.numeroPeriodo ?? 0,
  };

  localStorage.setItem(claveComision(cooperadoraId), JSON.stringify(actual));
  return actual;
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
