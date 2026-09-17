/**
 * Cliente HTTP para la futura API del Ministerio.
 *
 * IMPORTANTE: durante la etapa actual la aplicación continúa usando Supabase.
 * Este cliente se incorpora para que la migración final no requiera modificar
 * las pantallas: únicamente se reemplazará el adaptador de datos.
 */

export class MinisterioApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MinisterioApiError";
    this.status = status;
  }
}

function getApiBaseUrl(): string {
  const value = import.meta.env.VITE_MINISTERIO_API_URL as string | undefined;
  return value?.replace(/\/$/, "") ?? "";
}

export function ministerioApiConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}

export async function ministerioRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new MinisterioApiError(
      "La API del Ministerio todavía no está configurada.",
      0,
    );
  }

  const esFormulario = init.body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(esFormulario ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Error de API (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Mantener el mensaje HTTP cuando la respuesta no contiene JSON.
    }
    throw new MinisterioApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
