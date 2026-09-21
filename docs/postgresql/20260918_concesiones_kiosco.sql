-- Esquema PostgreSQL del Ministerio
-- Concesiones, contratos y documentación respaldatoria.
-- Esta migración es independiente de Supabase.

CREATE TABLE IF NOT EXISTS concesiones_kiosco (
  id uuid PRIMARY KEY,
  cooperadora_id uuid NOT NULL UNIQUE,
  apellido text NOT NULL,
  nombre text NOT NULL,
  canon numeric(14,2) NOT NULL CHECK (canon >= 0),
  canon_vigente numeric(14,2) NOT NULL CHECK (canon_vigente >= 0),
  canon_prorroga numeric(14,2) CHECK (canon_prorroga >= 0),
  canon_prorroga_vigente numeric(14,2) CHECK (canon_prorroga_vigente >= 0),
  fecha_firma_contrato date NOT NULL,
  fecha_vencimiento_contrato date NOT NULL,
  fecha_inicio_prorroga date,
  fecha_vencimiento_prorroga date,
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

CREATE TABLE IF NOT EXISTS ipc_indec (
  id uuid PRIMARY KEY,
  periodo date NOT NULL UNIQUE,
  indice_nivel_general numeric(14,6) NOT NULL CHECK (indice_nivel_general > 0),
  fuente text NOT NULL DEFAULT 'INDEC',
  fuente_url text,
  publicado_en date,
  cargado_en timestamptz NOT NULL DEFAULT now(),
  cargado_por uuid
);

CREATE INDEX IF NOT EXISTS idx_ipc_indec_periodo
  ON ipc_indec(periodo DESC);

CREATE TABLE IF NOT EXISTS actualizaciones_canon_ipc (
  id uuid PRIMARY KEY,
  concesion_id uuid NOT NULL REFERENCES concesiones_kiosco(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('contrato_original', 'prorroga')),
  fecha_actualizacion date NOT NULL,
  periodo_ipc_desde date NOT NULL REFERENCES ipc_indec(periodo),
  periodo_ipc_hasta date NOT NULL REFERENCES ipc_indec(periodo),
  indice_ipc_desde numeric(14,6) NOT NULL CHECK (indice_ipc_desde > 0),
  indice_ipc_hasta numeric(14,6) NOT NULL CHECK (indice_ipc_hasta > 0),
  variacion_ipc numeric(14,6) NOT NULL,
  canon_anterior numeric(14,2) NOT NULL CHECK (canon_anterior >= 0),
  canon_nuevo numeric(14,2) NOT NULL CHECK (canon_nuevo >= 0),
  origen text NOT NULL DEFAULT 'automatico' CHECK (origen IN ('automatico', 'manual')),
  ejecutado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concesion_id, tipo, fecha_actualizacion)
);

CREATE INDEX IF NOT EXISTS idx_actualizaciones_canon_ipc_concesion
  ON actualizaciones_canon_ipc(concesion_id, tipo, fecha_actualizacion DESC);

CREATE TABLE IF NOT EXISTS concesiones_kiosco_historial (
  id uuid PRIMARY KEY,
  concesion_id uuid NOT NULL REFERENCES concesiones_kiosco(id) ON DELETE CASCADE,
  apellido text NOT NULL,
  nombre text NOT NULL,
  canon numeric(14,2) NOT NULL CHECK (canon >= 0),
  canon_vigente numeric(14,2) NOT NULL CHECK (canon_vigente >= 0),
  canon_prorroga numeric(14,2) CHECK (canon_prorroga >= 0),
  canon_prorroga_vigente numeric(14,2) CHECK (canon_prorroga_vigente >= 0),
  fecha_firma_contrato date NOT NULL,
  fecha_vencimiento_contrato date NOT NULL,
  fecha_inicio_prorroga date,
  fecha_vencimiento_prorroga date,
  usuario_id uuid NOT NULL,
  usuario_nombre text NOT NULL,
  usuario_email text,
  modificado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_concesiones_kiosco_prorroga CHECK (
    (fecha_inicio_prorroga IS NULL AND fecha_vencimiento_prorroga IS NULL)
    OR
    (fecha_inicio_prorroga IS NOT NULL AND fecha_vencimiento_prorroga IS NOT NULL)
  )
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


-- Naturaleza del dato:
-- El saldo_bancario representa fondos de la Cooperadora resguardados en la cuenta.
-- No constituye por sí mismo un ingreso ni un egreso del Libro Mensual.


-- Resumen bancario vigente.
-- Debe actualizarse como máximo cada 6 meses.
CREATE TABLE IF NOT EXISTS resumenes_bancarios_cooperadora (
  id uuid PRIMARY KEY,
  cooperadora_id uuid NOT NULL UNIQUE,
  nombre_archivo text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
  tamano_bytes bigint NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 3145728),
  storage_key text NOT NULL,
  actualizado_por uuid NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumenes_bancarios_cooperadora
  ON resumenes_bancarios_cooperadora(cooperadora_id);
