/*
  Control de integridad y trazabilidad de movimientos

  Reglas:
  1. La fecha del movimiento sigue siendo la fecha real del comprobante.
  2. creado_en registra automaticamente la fecha/hora de carga.
  3. Si se carga un movimiento con fecha anterior a otro ya registrado,
     queda identificado como carga fuera de orden y requiere justificacion.
  4. Un egreso no puede superar el tope configurado por el auditor.
  5. Un periodo cerrado no puede reabrirse ni modificarse.
*/

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS carga_fuera_de_orden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_carga_tardia text;

ALTER TABLE public.movimientos
  DROP CONSTRAINT IF EXISTS carga_tardia_con_motivo;

ALTER TABLE public.movimientos
  ADD CONSTRAINT carga_tardia_con_motivo
  CHECK (
    carga_fuera_de_orden = false
    OR (motivo_carga_tardia IS NOT NULL AND length(btrim(motivo_carga_tardia)) > 0)
  );

CREATE INDEX IF NOT EXISTS idx_movimientos_fecha_coop
  ON public.movimientos(cooperadora_id, fecha);

CREATE OR REPLACE FUNCTION public.validar_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  saldo numeric;
  tope numeric;
  max_fecha_existente date;
  es_fuera_de_orden boolean := false;
BEGIN
  SELECT * INTO p
  FROM public.periodos
  WHERE id = NEW.periodo_id;

  IF p IS NULL THEN
    RAISE EXCEPTION 'Periodo inexistente';
  END IF;

  IF p.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El mes % / % está cerrado: no se pueden registrar movimientos', p.mes, p.anio;
  END IF;

  IF p.cooperadora_id <> NEW.cooperadora_id THEN
    RAISE EXCEPTION 'El periodo no pertenece a la cooperadora';
  END IF;

  IF EXTRACT(MONTH FROM NEW.fecha)::int <> p.mes
     OR EXTRACT(YEAR FROM NEW.fecha)::int <> p.anio THEN
    RAISE EXCEPTION 'La fecha del movimiento (%) no corresponde al mes del período (% / %)',
      to_char(NEW.fecha, 'DD/MM/YYYY'), p.mes, p.anio;
  END IF;

  SELECT MAX(m.fecha)
    INTO max_fecha_existente
  FROM public.movimientos m
  WHERE m.cooperadora_id = NEW.cooperadora_id
    AND m.id <> NEW.id;

  IF max_fecha_existente IS NOT NULL AND NEW.fecha < max_fecha_existente THEN
    es_fuera_de_orden := true;
  END IF;

  NEW.carga_fuera_de_orden := es_fuera_de_orden;

  IF es_fuera_de_orden
     AND COALESCE(btrim(NEW.motivo_carga_tardia), '') = '' THEN
    RAISE EXCEPTION
      'El movimiento tiene fecha anterior a otro movimiento ya registrado. Debe indicar el motivo de la carga tardía.';
  END IF;

  IF NEW.tipo = 'egreso' THEN
    IF COALESCE(btrim(NEW.comprobante), '') = '' THEN
      RAISE EXCEPTION 'El egreso requiere el número de comprobante';
    END IF;

    IF COALESCE(regexp_replace(NEW.proveedor_cuit, '[^0-9]', '', 'g'), '') !~ '^[0-9]{11}$' THEN
      RAISE EXCEPTION 'El CUIT del proveedor debe tener 11 dígitos';
    END IF;

    IF COALESCE(btrim(NEW.proveedor_razon_social), '') = '' THEN
      RAISE EXCEPTION 'El egreso requiere la razón social o nombre del comercio';
    END IF;

    IF COALESCE(NEW.tipo_factura, '') NOT IN ('B', 'C', 'ticket') THEN
      RAISE EXCEPTION 'El tipo de factura debe ser B, C o Ticket factura';
    END IF;

    SELECT COALESCE(pc.tope_egreso, 0)
      INTO tope
    FROM public.parametros_control pc
    ORDER BY pc.created_at
    LIMIT 1;

    IF COALESCE(tope, 0) > 0 AND NEW.monto > tope THEN
      RAISE EXCEPTION 'El egreso de $% supera el tope autorizado de $%. Debe registrarse según el procedimiento de excepción correspondiente.',
        trim(to_char(NEW.monto, 'FM999999999990.00')),
        trim(to_char(tope, 'FM999999999990.00'));
    END IF;

    SELECT COALESCE(c.saldo_inicial_ejercicio, 0)
         + COALESCE((
             SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END)
             FROM public.movimientos m
             WHERE m.cooperadora_id = NEW.cooperadora_id
               AND m.fecha <= NEW.fecha
               AND m.id <> NEW.id
           ), 0)
      INTO saldo
    FROM public.cooperadoras c
    WHERE c.id = NEW.cooperadora_id;

    IF saldo IS NULL THEN
      saldo := 0;
    END IF;

    IF saldo <= 0 THEN
      RAISE EXCEPTION 'No hay saldo disponible al % : el saldo es $%. No se pueden registrar egresos sin saldo.',
        to_char(NEW.fecha, 'DD/MM/YYYY'),
        trim(to_char(saldo, 'FM999999999990.00'));
    END IF;

    IF NEW.monto > saldo THEN
      RAISE EXCEPTION 'El egreso supera el saldo disponible al %: saldo $%, faltan $%.',
        to_char(NEW.fecha, 'DD/MM/YYYY'),
        trim(to_char(saldo, 'FM999999999990.00')),
        trim(to_char(NEW.monto - saldo, 'FM999999999990.00'));
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_periodo_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El mes ya fue cerrado y no puede modificarse';
  END IF;

  IF OLD.estado = 'abierto' AND NEW.estado = 'cerrado' THEN
    NEW.cerrado_en := now();
    NEW.cerrado_por := auth.uid();
  ELSIF OLD.estado = 'abierto' AND NEW.estado <> 'abierto' THEN
    RAISE EXCEPTION 'Estado de periodo no válido';
  END IF;

  RETURN NEW;
END;
$function$;

/* No se permite modificar creado_en ni creado_por porque movimientos
   solo tiene INSERT/SELECT para usuarios autenticados. */
