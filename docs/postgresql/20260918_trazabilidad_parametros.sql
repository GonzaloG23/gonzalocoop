-- Trazabilidad de cambios de los parámetros provinciales.
-- La API del Ministerio debería tomar estos datos del usuario autenticado
-- y no confiar en valores enviados por el navegador.

ALTER TABLE parametros_control
  ADD COLUMN IF NOT EXISTS ultima_modificacion_en timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ultima_modificacion_por_id text NULL,
  ADD COLUMN IF NOT EXISTS ultima_modificacion_por_nombre text NULL,
  ADD COLUMN IF NOT EXISTS ultima_modificacion_por_email text NULL;

COMMENT ON COLUMN parametros_control.ultima_modificacion_en IS
  'Fecha y hora de la última modificación de los parámetros de control.';

COMMENT ON COLUMN parametros_control.ultima_modificacion_por_id IS
  'ID del usuario autenticado que realizó la última modificación.';

COMMENT ON COLUMN parametros_control.ultima_modificacion_por_nombre IS
  'Nombre del usuario autenticado que realizó la última modificación.';

COMMENT ON COLUMN parametros_control.ultima_modificacion_por_email IS
  'Email del usuario autenticado que realizó la última modificación.';
