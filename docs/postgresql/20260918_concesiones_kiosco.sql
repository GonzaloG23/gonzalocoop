-- Esquema PostgreSQL del Ministerio
-- Concesiones, contratos y documentación respaldatoria.
-- Esta migración es independiente de Supabase.

CREATE TABLE IF NOT EXISTS concesiones_kiosco (
  id uuid PRIMARY KEY,
  cooperadora_id uuid NOT NULL UNIQUE,
  apellido text NOT NULL,
  nombre text NOT NULL,
  canon numeric(14,2) NOT NULL CHECK (canon >= 0),
  fecha_firma_contrato date NOT NULL,
  creado_por uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concesiones_kiosco_cooperadora
  ON concesiones_kiosco(cooperadora_id);

CREATE TABLE IF NOT EXISTS documentos_concesion (
  id uuid PRIMARY KEY,
  concesion_id uuid NOT NULL REFERENCES concesiones_kiosco(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (
    tipo IN ('contrato', 'contrato_sellado', 'buena_conducta')
  ),
  nombre_archivo text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
  tamano_bytes bigint NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 3145728),
  storage_key text NOT NULL,
  actualizado_por uuid NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concesion_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_documentos_concesion_concesion
  ON documentos_concesion(concesion_id);

CREATE TABLE IF NOT EXISTS concesiones_kiosco_historial (
  id uuid PRIMARY KEY,
  concesion_id uuid NOT NULL REFERENCES concesiones_kiosco(id) ON DELETE CASCADE,
  apellido text NOT NULL,
  nombre text NOT NULL,
  canon numeric(14,2) NOT NULL CHECK (canon >= 0),
  fecha_firma_contrato date NOT NULL,
  usuario_id uuid NOT NULL,
  usuario_nombre text NOT NULL,
  usuario_email text,
  modificado_en timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS documentos_concesion_historial (
  id uuid PRIMARY KEY,
  concesion_id uuid NOT NULL REFERENCES concesiones_kiosco(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (
    tipo IN ('contrato', 'contrato_sellado', 'buena_conducta')
  ),
  nombre_archivo text NOT NULL,
  accion text NOT NULL CHECK (accion IN ('carga', 'reemplazo')),
  usuario_id uuid NOT NULL,
  usuario_nombre text NOT NULL,
  usuario_email text,
  modificado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_concesion_historial
  ON documentos_concesion_historial(concesion_id, modificado_en DESC);

CREATE INDEX IF NOT EXISTS idx_concesion_historial_concesion
  ON concesiones_kiosco_historial(concesion_id, modificado_en DESC);

-- Nota:
-- Los PDF no se guardan dentro de PostgreSQL. El backend debe almacenarlos
-- en el almacenamiento institucional definido por el Ministerio y conservar
-- aquí solamente su referencia (storage_key) y metadatos.


-- Cuenta bancaria de la cooperadora: saldo y titulares registrados.
CREATE TABLE IF NOT EXISTS cuentas_bancarias_cooperadora (
  id uuid PRIMARY KEY,
  cooperadora_id uuid NOT NULL UNIQUE,
  saldo_bancario numeric(14,2) NOT NULL CHECK (saldo_bancario >= 0),
  asesor_director_nombre text NOT NULL,
  asesor_director_dni text NOT NULL CHECK (asesor_director_dni ~ '^[0-9]{8}$'),
  presidente_nombre text NOT NULL,
  presidente_dni text NOT NULL CHECK (presidente_dni ~ '^[0-9]{8}$'),
  tesorero_nombre text NOT NULL,
  tesorero_dni text NOT NULL CHECK (tesorero_dni ~ '^[0-9]{8}$'),
  actualizado_por uuid NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_cooperadora
  ON cuentas_bancarias_cooperadora(cooperadora_id);
