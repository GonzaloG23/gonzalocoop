# Migración de gonzalocoop al Ministerio de Educación de Tucumán

## Objetivo

La aplicación debe poder funcionar en infraestructura del Ministerio sin depender de Supabase ni de créditos de Lovable en producción.

La estrategia es conservar el frontend y la lógica de negocio que ya funciona y reemplazar progresivamente la infraestructura específica de Supabase.

## Estado actual

- Frontend: React + TanStack Router + Vite/TanStack Start.
- Datos: PostgreSQL de Supabase.
- Autenticación: Supabase Auth.
- Google OAuth: integración Lovable.
- Autorización: RLS + funciones PostgreSQL + roles `auditor` y `cooperadora`.
- Lógica de cálculo: principalmente TypeScript en `src/lib/libro.ts`.
- Libro contable: movimientos inalterables; las correcciones se realizan mediante ajustes.

## Arquitectura objetivo

```text
Navegador
   |
   | HTTPS
   v
Frontend gonzalocoop
   |
   | HTTPS / JSON
   v
Backend / API del Ministerio
   |
   +---- autenticación y autorización
   |
   +---- reglas de negocio
   |
   v
PostgreSQL del Ministerio
```

## Principio de migración

No se debe reescribir la aplicación completa.

### Se conserva

- estructura de cooperadoras;
- períodos mensuales;
- movimientos;
- rubros;
- parámetros de control;
- cálculos de saldos;
- alertas;
- cierre mensual;
- ajustes contables;
- reportes y exportaciones;
- identificadores UUID, cuando sea posible;
- campos de trazabilidad existentes.

### Se reemplaza

- `supabase.auth.*` por autenticación del backend;
- consultas directas `supabase.from(...)` por llamadas a la API;
- `supabase.rpc(...)` por endpoints/backend + PostgreSQL;
- RLS de Supabase por autorización en backend y controles PostgreSQL;
- Google/Lovable OAuth si el Ministerio utiliza un proveedor institucional propio.

## Usuarios y permisos

El modelo actual tiene dos roles principales:

- `cooperadora`: puede operar únicamente sobre su cooperadora;
- `auditor`: puede consultar las cooperadoras provinciales y realizar las funciones de auditoría permitidas.

El backend debe establecer el usuario autenticado en cada petición y comprobar el rol antes de acceder a datos sensibles.

## Trazabilidad

Se deben conservar:

- usuario que creó un movimiento (`creado_por`);
- fecha y hora (`creado_en`);
- usuario que cerró un período (`cerrado_por`);
- fecha y hora de cierre (`cerrado_en`);
- movimiento original de un ajuste (`ajusta_movimiento_id`);
- motivo del ajuste (`motivo_ajuste`).

Para producción ministerial se recomienda además una tabla `auditoria_eventos` para registrar acciones relevantes como inicio de sesión, alta de cooperadora, creación de movimiento, cierre, ajuste y cambios de parámetros.

## Reglas contables que deben permanecer en PostgreSQL/backend

1. No registrar movimientos en períodos cerrados.
2. El período debe pertenecer a la cooperadora del movimiento.
3. La fecha del movimiento debe corresponder al período.
4. Los egresos requieren comprobante.
5. Los egresos requieren CUIT de proveedor válido.
6. Los egresos requieren razón social/proveedor.
7. El tipo de factura debe ser B, C o ticket.
8. No permitir egresos superiores al saldo disponible.
9. Los movimientos existentes no se editan ni eliminan.
10. Los ajustes deben conservar el movimiento original y exigir motivo.

Estas reglas no deben depender únicamente de validaciones de la interfaz.

## Etapas

### Etapa 1 - Recuperación

Ejecutar la aplicación actual sin contratar Supabase ni créditos adicionales de Lovable.

### Etapa 2 - Preparación

Crear una capa de acceso a datos/API que permita dejar de utilizar Supabase directamente desde los componentes de React.

### Etapa 3 - Backend

Implementar API para autenticación, contexto, cooperadoras, períodos, movimientos, rubros, parámetros y auditoría.

### Etapa 4 - PostgreSQL Ministerio

Crear el esquema portable de PostgreSQL y trasladar las reglas críticas de integridad.

### Etapa 5 - Migración de datos

Migrar primero estructura, después datos históricos y finalmente usuarios.

### Etapa 6 - Pruebas

Comparar saldos, movimientos, cierres, alertas y reportes entre el sistema actual y el nuevo.

### Etapa 7 - Producción

Publicar frontend y backend en infraestructura autorizada por el Ministerio y configurar PostgreSQL institucional.

## Decisión importante

No se modifica `main` durante la preparación. El trabajo de migración se desarrolla en la rama `migracion-ministerio` hasta validarlo.
