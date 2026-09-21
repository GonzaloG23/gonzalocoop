# Contrato de API del Ministerio — Concesiones y Cantinas

## Concesión

### GET `/api/cooperadoras/:id/concesion-kiosco`

Obtiene los datos vigentes de la concesión.

Respuesta:

```json
{
  "id": "uuid",
  "apellido": "Pérez",
  "nombre": "Juan",
  "canon": 125000,
  "canonProrroga": null,
  "fechaFirmaContrato": "2026-09-15",
  "fechaVencimientoContrato": "2028-09-15",
  "tieneProrroga": false,
  "fechaInicioProrroga": "",
  "fechaVencimientoProrroga": ""
}
```

La fecha se devuelve en formato ISO `YYYY-MM-DD`.

### PUT `/api/cooperadoras/:id/concesion-kiosco`

Crea o actualiza los datos de la concesión.

Body:

```json
{
  "datos": {
    "apellido": "Pérez",
    "nombre": "Juan",
    "canon": 125000,
    "canonProrroga": 140000,
    "fechaFirmaContrato": "2026-09-15",
    "fechaVencimientoContrato": "2028-09-15",
    "tieneProrroga": true,
    "fechaInicioProrroga": "2028-09-15",
    "fechaVencimientoProrroga": "2029-09-15"
  }
}
```

Validaciones obligatorias:

- apellido no vacío;
- nombre no vacío;
- canon del contrato original mayor o igual a cero;
- cuando exista prórroga, canon de la prórroga obligatorio y mayor o igual a cero;
- `fechaFirmaContrato` obligatoria;
- `fechaFirmaContrato` válida;
- `fechaVencimientoContrato` calculada automáticamente como 2 años desde `fechaFirmaContrato`;
- cuando `tieneProrroga` es verdadero, `fechaInicioProrroga` es obligatoria;
- `fechaVencimientoProrroga` se calcula automáticamente como 1 año desde `fechaInicioProrroga`;
- si no existe prórroga, las fechas de prórroga deben quedar vacías;
- usuario autenticado;
- usuario autorizado para la cooperadora indicada.

La fecha de firma es un dato obligatorio tanto en frontend como en backend/PostgreSQL.

## Documentación

Los tipos permitidos son:

- `contrato`
- `contrato_sellado`
- `buena_conducta`

### GET `/api/cooperadoras/:id/concesion-kiosco/:tipo`

Devuelve los metadatos del documento:

```json
{
  "nombreArchivo": "contrato-sellado.pdf",
  "tipo": "application/pdf",
  "tamano": 245678,
  "actualizadoEn": "2026-09-18T11:30:00Z"
}
```

### POST `/api/cooperadoras/:id/concesion-kiosco/:tipo`

Recibe un `multipart/form-data` con el campo `archivo`.

Reglas:

- solamente PDF;
- tamaño máximo: 3 MB;
- requiere autenticación y autorización sobre la cooperadora;
- para `tipo=contrato_sellado`, el archivo representa el sellado del contrato;
- al reemplazar un documento, se conserva un único documento vigente por tipo y se actualizan sus metadatos.

El backend debe almacenar el archivo en el almacenamiento institucional del Ministerio y persistir en PostgreSQL la referencia al archivo.

### GET `/api/cooperadoras/:id/concesion-kiosco/:tipo/archivo`

Devuelve una URL temporal o un mecanismo equivalente para abrir/descargar el PDF almacenado institucionalmente.

## Historial

### GET `/api/cooperadoras/:id/concesion-kiosco/historial`

Devuelve las últimas modificaciones de la concesión, incluyendo:

- apellido;
- nombre;
- canon del contrato original;
- canon de la prórroga, si corresponde;
- fecha de firma del contrato;
- fecha de vencimiento del contrato;
- fecha de inicio de la prórroga, si corresponde;
- fecha de vencimiento de la prórroga, si corresponde;
- usuario que realizó el cambio;
- fecha y hora del cambio.

### POST `/api/cooperadoras/:id/concesion-kiosco/historial`

Registra la versión anterior/nueva de los datos de concesión después de una modificación autorizada.

Body:

```json
{
  "datos": {
    "apellido": "Pérez",
    "nombre": "Juan",
    "canon": 125000,
    "fechaFirmaContrato": "2026-09-15",
    "fechaVencimientoContrato": "2028-09-15",
    "tieneProrroga": true,
    "fechaInicioProrroga": "2028-09-15",
    "fechaVencimientoProrroga": "2029-09-15"
  },
  "modificado_por": {
    "id": "uuid",
    "nombre": "Usuario",
    "email": "usuario@dominio.gob.ar"
  }
}
```

## Autorización

El backend debe comprobar que:

- un usuario `cooperadora` solo pueda modificar su propia cooperadora;
- un usuario `auditor` pueda consultar según sus permisos institucionales;
- las operaciones de escritura queden auditadas.

## Almacenamiento de PDFs

PostgreSQL no debe recibir el contenido binario del PDF. Debe persistirse:

- nombre original;
- MIME;
- tamaño;
- referencia al almacenamiento institucional;
- usuario que lo actualizó;
- fecha/hora de actualización.

El almacenamiento concreto queda a definición del Ministerio (servidor de archivos, objeto institucional u otra solución aprobada).


## Historial de documentación

### GET `/api/cooperadoras/:id/concesion-kiosco/historial-documentos`

Devuelve el historial de cargas y reemplazos de los tres documentos de la concesión.

Ejemplo:

```json
[
  {
    "id": "uuid",
    "tipo": "contrato_sellado",
    "nombreArchivo": "sellado-2026.pdf",
    "accion": "reemplazo",
    "usuario_id": "uuid",
    "usuario_nombre": "Juan Pérez",
    "usuario_email": "usuario@dominio.gob.ar",
    "modificado_en": "2026-09-18T12:30:00Z"
  }
]
```

### POST `/api/cooperadoras/:id/concesion-kiosco/historial-documentos`

Registra una carga o reemplazo de documentación.

El backend debe validar que:

- el usuario esté autenticado y autorizado;
- el tipo de documento sea válido;
- `accion` sea `carga` o `reemplazo`;
- el documento corresponda a la cooperadora indicada;
- la operación quede registrada con usuario y fecha/hora.

El historial no se elimina cuando el documento vigente se reemplaza.


## Cuenta bancaria

### GET `/api/cooperadoras/:id/cuenta-bancaria`

Obtiene el importe de fondos de la Cooperadora que se encuentra resguardado en la cuenta bancaria y sus titulares. Este importe es informativo y no constituye un ingreso ni un egreso adicional del Libro Mensual.

Respuesta:

```json
{
  "saldoBancario": 1250000,
  "asesorDirectorNombre": "María Gómez",
  "asesorDirectorDni": "20123456",
  "presidenteNombre": "Juan Pérez",
  "presidenteDni": "30123456",
  "tesoreroNombre": "Ana López",
  "tesoreroDni": "32123456"
}
```

### PUT `/api/cooperadoras/:id/cuenta-bancaria`

Crea o actualiza los datos de la cuenta bancaria.

Body:

```json
{
  "datos": {
    "saldoBancario": 1250000,
    "asesorDirectorNombre": "María Gómez",
    "asesorDirectorDni": "20123456",
    "presidenteNombre": "Juan Pérez",
    "presidenteDni": "30123456",
    "tesoreroNombre": "Ana López",
    "tesoreroDni": "32123456"
  }
}
```

Validaciones obligatorias:

- saldo bancario mayor o igual a cero;
- nombre y DNI del Asesor/Director;
- nombre y DNI del Presidente;
- nombre y DNI del Tesorero;
- todos los DNI deben tener exactamente 8 dígitos;
- usuario autenticado y autorizado sobre la cooperadora.

La comparación con la Comisión Directiva se realiza en la vista de Auditoría: el DNI del Presidente de la cuenta debe coincidir con el DNI del Presidente registrado en la Comisión Directiva, y lo mismo para el Tesorero. Si no coinciden, Auditoría debe mostrar una alerta.


## Naturaleza de los fondos resguardados

El importe informado en la cuenta bancaria representa fondos de la Cooperadora depositados como medida de resguardo.

- Los ingresos y egresos económicos de la Cooperadora se registran exclusivamente mediante los movimientos del Libro Mensual y sus conceptos correspondientes.
- Depositar fondos en la cuenta bancaria no genera un nuevo ingreso.
- Retirar fondos de la cuenta bancaria para utilizarlos no genera por sí mismo un nuevo egreso; el egreso se registra cuando corresponde al concepto real de la operación.
- El importe de fondos resguardados es un dato informativo de custodia y puede diferir del saldo contable del Libro Mensual.


## Efectivo en mano

El panel puede calcular un importe informativo de **efectivo en mano** cuando existe una diferencia entre el saldo actual del Libro Mensual y los fondos resguardados en la cuenta bancaria.

La fórmula es:

`efectivoEnMano = saldoActualLibro - fondosResguardados`

Este importe no se carga manualmente y no genera por sí mismo un movimiento contable. Representa el dinero que, según la información declarada, permanece en efectivo fuera de la cuenta bancaria.

El panel puede ocultar el recuadro cuando la diferencia sea cero.


## Resumen bancario

### GET /api/cooperadoras/:id/resumen-bancario

Obtiene los metadatos del resumen bancario vigente de la cooperadora.

Respuesta:

```json
{
  "nombreArchivo": "resumen-bancario-junio-2026.pdf",
  "tipo": "application/pdf",
  "tamano": 245678,
  "actualizadoEn": "2026-06-30T15:20:00Z"
}
```

### POST /api/cooperadoras/:id/resumen-bancario

Recibe un multipart/form-data con el campo archivo.

Reglas:

- solamente PDF;
- tamaño máximo: 3 MB;
- reemplaza el resumen bancario vigente;
- registra la fecha/hora y usuario de actualización;
- requiere autenticación y autorización sobre la cooperadora.

El backend debe almacenar el PDF en el almacenamiento institucional y guardar en PostgreSQL solamente sus metadatos y storage_key.

### GET /api/cooperadoras/:id/resumen-bancario/archivo

Devuelve una URL temporal o mecanismo equivalente para abrir el PDF vigente.

### Vigencia

El resumen bancario debe actualizarse cada 6 meses. La aplicación calcula la fecha límite a partir de actualizadoEn.

En Auditoría se debe generar una alerta cuando:

- no exista ningún resumen bancario cargado; o
- hayan transcurrido más de 6 meses desde su última actualización.

La vigencia del resumen bancario no modifica los ingresos, egresos ni saldos del Libro Mensual.
