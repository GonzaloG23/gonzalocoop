# Backend de gonzalocoop

Este directorio queda reservado para la futura API institucional.

## Objetivo

Desacoplar el frontend de Supabase para que la aplicación pueda utilizar PostgreSQL y autenticación proporcionados por el Ministerio.

## Reglas

- No guardar secretos en el frontend.
- No exponer credenciales de PostgreSQL al navegador.
- Toda operación debe identificar al usuario autenticado.
- Toda operación debe verificar rol y ámbito de la cooperadora.
- Las reglas contables críticas deben ejecutarse en una transacción.
- Las acciones relevantes deben quedar auditadas.

## Migración progresiva

Primero se implementarán endpoints equivalentes a las operaciones que hoy realiza `src/lib/libro.ts` mediante Supabase. Durante la transición, la aplicación actual seguirá funcionando con Supabase.

Una vez validada la API, los componentes React dejarán de importar el cliente Supabase directamente.
