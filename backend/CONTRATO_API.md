# Contrato de API del Ministerio

## Principios

La implementación definitiva de autenticación será definida con el Ministerio. No se debe asumir que continuará Google/Lovable/Supabase Auth.

La aplicación web no se conecta directamente a PostgreSQL. La comunicación será siempre a través de la API institucional.

## Autenticación

### `POST /api/auth/login`

Inicia sesión con las credenciales institucionales.

Respuesta esperada:
```json
{
  "user": { "id": "...", "email": "...", "nombre": "..." },
  "role": "cooperadora"
}
```

Roles previstos: `cooperadora`, `auditor`.

### `POST /api/auth/logout`

Cierra la sesión institucional. El frontend acepta también un `404` durante la etapa de transición para no bloquear el cierre de sesión si el backend todavía no implementó este endpoint.

### `GET /api/me`

Devuelve usuario, rol, cooperadora asociada y permisos efectivos.

## Usuario y cooperadora

### `GET /api/cooperadoras`

Lista cooperadoras disponibles según permisos del usuario.

### `GET /api/cooperadoras/:id`

Obtiene una cooperadora.

### `POST /api/cooperadoras`

Crea una cooperadora.

## Ejercicio

### `GET /api/cooperadoras/:id/ejercicio/:anio`

Devuelve períodos y movimientos del ejercicio.

### `POST /api/cooperadoras/:id/periodos/:periodoId/cerrar`

Cierra un período.

## Rubros

### `GET /api/cooperadoras/:id/rubros`

Obtiene los rubros de una cooperadora.

### `POST /api/cooperadoras/:id/rubros`

Crea un rubro.

### `PATCH /api/rubros/:id`

Modifica un rubro, incluyendo su estado activo/inactivo.

## Movimientos

### `POST /api/movimientos`

Registra un movimiento.

Validaciones mínimas:
- autenticación;
- permisos;
- período abierto;
- fecha perteneciente al período;
- importe mayor a cero;
- reglas de comprobante/proveedor;
- saldo suficiente cuando corresponda;
- tope de egreso;
- consistencia de ajustes contables;
- inserción y actualización de saldo dentro de una misma transacción.

## Auditoría

### `GET /api/auditoria/cooperadoras`

Lista cooperadoras para auditoría.

### `GET /api/auditoria/cooperadoras/:id`

Obtiene información de una cooperadora para auditoría.

### `GET /api/auditoria/eventos`

Obtiene eventos de auditoría según permisos.

### `POST /api/auditoria/auditores`

Otorga el rol de auditor a un usuario autorizado.

Body:
```json
{ "email": "usuario@dominio.gob.ar" }
```

### `POST /api/auditoria/reclamar-rol`

Permite ejecutar el mecanismo institucional definido para reclamar/habilitar el rol de auditor.

## Parámetros de control

### `GET /api/parametros-control`

Obtiene los parámetros vigentes.

### `PATCH /api/parametros-control`

Actualiza los parámetros de control según permisos institucionales.

## Cierre de período

El frontend utiliza el endpoint institucional:
`POST /api/cooperadoras/:id/periodos/:periodoId/cerrar`.

## Orden de migración

1. Implementar la API institucional.
2. Probar la API contra PostgreSQL del Ministerio.
3. Definir e implementar autenticación institucional.
4. Implementar los adaptadores `ministerio-api` del frontend.
5. Comparar resultados funcionales con el modo actual.
6. Activar `DATA_BACKEND=ministerio-api` en un entorno de prueba.
7. Validar todas las funciones.
8. Retirar progresivamente la dependencia de Supabase del frontend.
9. Eliminar Supabase una vez estable la solución institucional.
