# Contrato inicial de la API institucional

Este contrato define la futura API de `gonzalocoop` para que el frontend pueda dejar de depender de Supabase y conectarse al PostgreSQL del Ministerio.

La aplicación continúa utilizando Supabase durante esta etapa. Este archivo no cambia el funcionamiento actual.

## Principios

- El navegador nunca recibe credenciales de PostgreSQL.
- La API autentica al usuario en cada operación protegida.
- La API determina el rol y la cooperadora autorizada.
- Las operaciones contables críticas se ejecutan dentro de una transacción.
- Los cierres, ajustes y operaciones sensibles generan auditoría.
- Los importes se manejan como valores decimales; no se debe depender de cálculos monetarios con `float` en PostgreSQL.

## Autenticación

`POST /api/auth/login`

```json
{
  "email": "usuario@ejemplo.gob.ar",
  "password": "..."
}
```

Respuesta esperada:

```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.gob.ar",
    "nombre": "Nombre Apellido"
  },
  "role": "cooperadora"
}
```

La implementación definitiva de autenticación será definida con el Ministerio. No se debe asumir que continuará Google/Lovable/Supabase Auth.

## Contexto del usuario

`GET /api/me`

Devuelve usuario, rol, cooperadora asociada y permisos efectivos.

## Cooperadoras

`GET /api/cooperadoras`

- Auditor: puede consultar las cooperadoras permitidas.
- Usuario de cooperadora: recibe únicamente su cooperadora.

`GET /api/cooperadoras/:id`

Devuelve los datos de una cooperadora si el usuario tiene autorización.

`POST /api/cooperadoras`

Crea una cooperadora. La autorización debe verificarse en servidor.

## Ejercicio y períodos

`GET /api/cooperadoras/:id/ejercicio/:anio`

Devuelve períodos, saldo inicial, movimientos y parámetros necesarios para mostrar el libro.

`POST /api/cooperadoras/:id/periodos/:periodoId/cerrar`

Cierra un período.

El servidor debe verificar fecha límite, estado actual, permisos y consistencia del saldo antes de confirmar la operación.

## Rubros

`GET /api/cooperadoras/:id/rubros`

`POST /api/cooperadoras/:id/rubros`

`PATCH /api/rubros/:id`

## Movimientos

`POST /api/movimientos`

Payload equivalente al modelo actual:

```json
{
  "cooperadora_id": "uuid",
  "periodo_id": "uuid",
  "fecha": "2026-09-15",
  "tipo": "egreso",
  "rubro_id": "uuid",
  "concepto": "Compra de útiles",
  "monto": 150000,
  "medio_pago": "transferencia",
  "comprobante": "0001-00001234",
  "proveedor_cuit": "20123456789",
  "proveedor_razon_social": "Proveedor SA",
  "tipo_factura": "B",
  "observaciones": null,
  "ajusta_movimiento_id": null,
  "motivo_ajuste": null
}
```

Antes de confirmar un egreso, el backend debe validar como mínimo:

1. usuario autenticado;
2. permiso sobre la cooperadora;
3. período existente y abierto;
4. fecha perteneciente al período;
5. monto mayor que cero;
6. comprobante y datos del proveedor según las reglas vigentes;
7. saldo disponible suficiente;
8. reglas de tope de egreso;
9. consistencia de ajustes.

La inserción y actualización del saldo deben formar parte de la misma transacción.

## Auditoría

`GET /api/auditoria/cooperadoras`

`GET /api/auditoria/cooperadoras/:id`

`GET /api/auditoria/eventos`

Las consultas de auditoría nunca deben permitir que el navegador modifique directamente los registros históricos.

## Parámetros de control

`GET /api/parametros-control`

`PATCH /api/parametros-control`

Solo usuarios con rol institucional autorizado pueden modificar parámetros de control.

## Migración

El adaptador frontend futuro tendrá una interfaz equivalente a estas operaciones. Mientras `DATA_BACKEND` permanezca en `supabase`, ninguna pantalla utilizará estos endpoints.

La migración se realizará en este orden:

1. implementar API;
2. probar API contra PostgreSQL institucional;
3. implementar autenticación institucional;
4. crear adaptador `ministerio-api`;
5. ejecutar pruebas funcionales comparando resultados con Supabase;
6. cambiar `DATA_BACKEND` a `ministerio-api`;
7. retirar Supabase del frontend;
8. eliminar la dependencia de Supabase cuando el Ministerio confirme la operación estable.
