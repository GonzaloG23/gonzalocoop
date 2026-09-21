-- Vigencia de contratos de concesión.
-- Contrato inicial: 2 años.
-- Prórroga: 1 año adicional, con su propia fecha de inicio y vencimiento.

ALTER TABLE concesiones_kiosco
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_contrato date;

UPDATE concesiones_kiosco
SET fecha_vencimiento_contrato = (fecha_firma_contrato + INTERVAL '2 years')::date
WHERE fecha_vencimiento_contrato IS NULL;

ALTER TABLE concesiones_kiosco
  ALTER COLUMN fecha_vencimiento_contrato SET NOT NULL;

ALTER TABLE concesiones_kiosco
  ADD COLUMN IF NOT EXISTS fecha_inicio_prorroga date,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_prorroga date;

ALTER TABLE concesiones_kiosco
  DROP CONSTRAINT IF EXISTS ck_concesiones_kiosco_prorroga;

ALTER TABLE concesiones_kiosco
  ADD CONSTRAINT ck_concesiones_kiosco_prorroga CHECK (
    (fecha_inicio_prorroga IS NULL AND fecha_vencimiento_prorroga IS NULL)
    OR
    (fecha_inicio_prorroga IS NOT NULL AND fecha_vencimiento_prorroga IS NOT NULL)
  );

ALTER TABLE concesiones_kiosco_historial
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_contrato date;

UPDATE concesiones_kiosco_historial
SET fecha_vencimiento_contrato = (fecha_firma_contrato + INTERVAL '2 years')::date
WHERE fecha_vencimiento_contrato IS NULL;

ALTER TABLE concesiones_kiosco_historial
  ALTER COLUMN fecha_vencimiento_contrato SET NOT NULL;

ALTER TABLE concesiones_kiosco_historial
  ADD COLUMN IF NOT EXISTS fecha_inicio_prorroga date,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_prorroga date;

ALTER TABLE concesiones_kiosco_historial
  DROP CONSTRAINT IF EXISTS ck_concesiones_kiosco_historial_prorroga;

ALTER TABLE concesiones_kiosco_historial
  ADD CONSTRAINT ck_concesiones_kiosco_historial_prorroga CHECK (
    (fecha_inicio_prorroga IS NULL AND fecha_vencimiento_prorroga IS NULL)
    OR
    (fecha_inicio_prorroga IS NOT NULL AND fecha_vencimiento_prorroga IS NOT NULL)
  );


ALTER TABLE concesiones_kiosco
  ADD COLUMN IF NOT EXISTS canon_prorroga numeric(14,2);

ALTER TABLE concesiones_kiosco
  ADD CONSTRAINT ck_concesiones_kiosco_canon_prorroga
  CHECK (canon_prorroga IS NULL OR canon_prorroga >= 0);

ALTER TABLE concesiones_kiosco_historial
  ADD COLUMN IF NOT EXISTS canon_prorroga numeric(14,2);

ALTER TABLE concesiones_kiosco_historial
  ADD CONSTRAINT ck_concesiones_kiosco_historial_canon_prorroga
  CHECK (canon_prorroga IS NULL OR canon_prorroga >= 0);


-- Actualización anual del canon según IPC.
-- El canon original se conserva. El canon vigente se actualiza cada aniversario
-- de la fecha de firma del contrato y, cuando corresponda, de la fecha de inicio de la prórroga.

ALTER TABLE concesiones_kiosco
  ADD COLUMN IF NOT EXISTS canon_vigente numeric(14,2);

UPDATE concesiones_kiosco
SET canon_vigente = canon
WHERE canon_vigente IS NULL;

ALTER TABLE concesiones_kiosco
  ALTER COLUMN canon_vigente SET NOT NULL;

ALTER TABLE concesiones_kiosco
  DROP CONSTRAINT IF EXISTS ck_concesiones_kiosco_canon_vigente;

ALTER TABLE concesiones_kiosco
  ADD CONSTRAINT ck_concesiones_kiosco_canon_vigente
  CHECK (canon_vigente >= 0);

ALTER TABLE concesiones_kiosco
  ADD COLUMN IF NOT EXISTS canon_prorroga_vigente numeric(14,2);

UPDATE concesiones_kiosco
SET canon_prorroga_vigente = canon_prorroga
WHERE canon_prorroga IS NOT NULL
  AND canon_prorroga_vigente IS NULL;

ALTER TABLE concesiones_kiosco
  DROP CONSTRAINT IF EXISTS ck_concesiones_kiosco_canon_prorroga_vigente;

ALTER TABLE concesiones_kiosco
  ADD CONSTRAINT ck_concesiones_kiosco_canon_prorroga_vigente
  CHECK (canon_prorroga_vigente IS NULL OR canon_prorroga_vigente >= 0);

ALTER TABLE concesiones_kiosco_historial
  ADD COLUMN IF NOT EXISTS canon_vigente numeric(14,2);

UPDATE concesiones_kiosco_historial
SET canon_vigente = canon
WHERE canon_vigente IS NULL;

ALTER TABLE concesiones_kiosco_historial
  ALTER COLUMN canon_vigente SET NOT NULL;

ALTER TABLE concesiones_kiosco_historial
  DROP CONSTRAINT IF EXISTS ck_concesiones_kiosco_historial_canon_vigente;

ALTER TABLE concesiones_kiosco_historial
  ADD CONSTRAINT ck_concesiones_kiosco_historial_canon_vigente
  CHECK (canon_vigente >= 0);

ALTER TABLE concesiones_kiosco_historial
  ADD COLUMN IF NOT EXISTS canon_prorroga_vigente numeric(14,2);

UPDATE concesiones_kiosco_historial
SET canon_prorroga_vigente = canon_prorroga
WHERE canon_prorroga IS NOT NULL
  AND canon_prorroga_vigente IS NULL;

ALTER TABLE concesiones_kiosco_historial
  DROP CONSTRAINT IF EXISTS ck_concesiones_kiosco_historial_canon_prorroga_vigente;

ALTER TABLE concesiones_kiosco_historial
  ADD CONSTRAINT ck_concesiones_kiosco_historial_canon_prorroga_vigente
  CHECK (canon_prorroga_vigente IS NULL OR canon_prorroga_vigente >= 0);

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
