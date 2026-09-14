/* La interfaz existente ya dispone de Observaciones. Para no duplicar campos,
   ese texto se utiliza como justificación de una carga fuera de orden. */

CREATE OR REPLACE FUNCTION public.validar_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  saldo numeric;
  max_fecha_existente date;
BEGIN
  SELECT * INTO p FROM public.periodos WHERE id = NEW.periodo_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Periodo inexistente'; END IF;
  IF p.estado = 'cerrado' THEN RAISE EXCEPTION 'El mes % / % está cerrado: no se pueden registrar movimientos', p.mes, p.anio; END IF;
  IF p.cooperadora_id <> NEW.cooperadora_id THEN RAISE EXCEPTION 'El periodo no pertenece a la cooperadora'; END IF;

  IF EXTRACT(MONTH FROM NEW.fecha)::int <> p.mes OR EXTRACT(YEAR FROM NEW.fecha)::int <> p.anio THEN
    RAISE EXCEPTION 'La fecha del movimiento (%) no corresponde al mes del período (% / %)', to_char(NEW.fecha, 'DD/MM/YYYY'), p.mes, p.anio;
  END IF;

  SELECT MAX(m.fecha) INTO max_fecha_existente
  FROM public.movimientos m
  WHERE m.cooperadora_id = NEW.cooperadora_id AND m.id <> NEW.id;

  NEW.carga_fuera_de_orden := max_fecha_existente IS NOT NULL AND NEW.fecha < max_fecha_existente;

  IF NEW.carga_fuera_de_orden THEN
    NEW.motivo_carga_tardia := NULLIF(btrim(COALESCE(NEW.motivo_carga_tardia, NEW.observaciones)), '');
    IF NEW.motivo_carga_tardia IS NULL THEN
      RAISE EXCEPTION 'Carga fuera de orden cronológico. En Observaciones indique el motivo de la carga tardía.';
    END IF;
  ELSE
    NEW.motivo_carga_tardia := NULL;
  END IF;

  IF NEW.tipo = 'egreso' THEN
    IF COALESCE(btrim(NEW.comprobante), '') = '' THEN RAISE EXCEPTION 'El egreso requiere el número de comprobante'; END IF;
    IF COALESCE(regexp_replace(NEW.proveedor_cuit, '[^0-9]', '', 'g'), '') !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'El CUIT del proveedor debe tener 11 dígitos'; END IF;
    IF COALESCE(btrim(NEW.proveedor_razon_social), '') = '' THEN RAISE EXCEPTION 'El egreso requiere la razón social o nombre del comercio'; END IF;
    IF COALESCE(NEW.tipo_factura, '') NOT IN ('B', 'C', 'ticket') THEN RAISE EXCEPTION 'El tipo de factura debe ser B, C o Ticket factura'; END IF;

    /* El tope de egreso es una alerta de auditoría y NO bloquea el registro. */

    SELECT COALESCE(c.saldo_inicial_ejercicio, 0)
         + COALESCE((
             SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END)
             FROM public.movimientos m
             WHERE m.cooperadora_id = NEW.cooperadora_id AND m.fecha <= NEW.fecha AND m.id <> NEW.id
           ), 0)
      INTO saldo
    FROM public.cooperadoras c WHERE c.id = NEW.cooperadora_id;

    IF saldo IS NULL THEN saldo := 0; END IF;
    IF saldo <= 0 THEN RAISE EXCEPTION 'No hay saldo disponible al % : el saldo es $%. No se pueden registrar egresos sin saldo.', to_char(NEW.fecha, 'DD/MM/YYYY'), trim(to_char(saldo, 'FM999999999990.00')); END IF;
    IF NEW.monto > saldo THEN RAISE EXCEPTION 'El egreso supera el saldo disponible al %: saldo $%, faltan $%.', to_char(NEW.fecha, 'DD/MM/YYYY'), trim(to_char(saldo, 'FM999999999990.00')), trim(to_char(NEW.monto - saldo, 'FM999999999990.00')); END IF;
  END IF;

  RETURN NEW;
END;
$function$;
