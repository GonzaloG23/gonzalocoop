# Dependencias actuales de Supabase

## Objetivo

Documentar qué partes de `gonzalocoop` dependen actualmente de Supabase para poder reemplazarlas por una API propia + PostgreSQL del Ministerio sin reescribir la aplicación completa.

## Estado actual

La aplicación funciona actualmente contra el proyecto Supabase existente. Esta etapa es de recuperación/continuidad y no debe interpretarse como arquitectura final.

## Dependencias que debemos reemplazar

### 1. Autenticación

Actualmente se usa `supabase.auth` para:

- obtener el usuario actual (`getUser`, `getSession`);
- iniciar sesión con email/contraseña;
- registrar usuarios;
- cerrar sesión;
- OAuth con Google mediante la integración de Lovable.

**Migración prevista:** autenticación propia del backend del Ministerio, con sesión segura mediante cookie HTTP-only. El frontend no debe conocer credenciales de PostgreSQL.

### 2. Acceso a datos

El archivo `src/lib/libro.ts` concentra gran parte del acceso a:

- `perfiles`;
- `user_roles`;
- `cooperadoras`;
- `periodos`;
- `movimientos`;
- `rubros`;
- `parametros_control`.

Esto es favorable porque permite crear una capa de acceso a datos y sustituir Supabase por endpoints propios.

### 3. RPC / funciones de base de datos

La aplicación usa funciones PostgreSQL expuestas mediante Supabase RPC, principalmente para:

- crear cooperadora;
- reclamar rol de auditor;
- otorgar rol de auditor;
- consultar funciones de seguridad/rol.

**Migración prevista:** mover estas operaciones al backend y ejecutar SQL parametrizado o funciones PostgreSQL internas desde el servidor.

### 4. RLS y seguridad de Supabase

Actualmente parte de la autorización se apoya en Row Level Security (RLS), políticas y funciones `security definer`.

**Migración prevista:** conservar las reglas de negocio, pero trasladar la autorización al backend. PostgreSQL del Ministerio seguirá siendo inaccesible directamente desde el navegador.

### 5. Lovable Cloud Auth / Google

El login con Google utiliza la integración de Lovable. No debe formar parte de la arquitectura definitiva si el objetivo es que el Ministerio pueda alojar todo en su propia infraestructura.

**Migración prevista:** inicialmente mantener email/contraseña; evaluar SSO institucional del Ministerio como mejora posterior.

## Lo que NO queremos hacer

- No conectar el navegador directamente al PostgreSQL del Ministerio.
- No exponer usuario/contraseña de PostgreSQL en variables públicas del frontend.
- No depender de Lovable Cloud para ejecutar la aplicación final.
- No depender de Supabase para la operación final.
- No reescribir los cálculos de negocio que ya funcionan correctamente.

## Arquitectura objetivo

```text
Navegador
   |
   | HTTPS
   v
Frontend React/TanStack
   |
   | HTTPS + sesión
   v
API / Backend institucional
   |
   | conexión privada
   v
PostgreSQL del Ministerio
```

## Orden de migración recomendado

1. Mantener la aplicación actual funcionando.
2. Crear una interfaz de backend para separar la UI de Supabase.
3. Implementar esa interfaz inicialmente usando Supabase como adaptador.
4. Crear API propia para las mismas operaciones.
5. Implementar autenticación/sesiones en el backend.
6. Migrar el esquema y los datos a PostgreSQL institucional.
7. Cambiar el adaptador de datos de Supabase a API institucional.
8. Eliminar dependencias de Supabase/Lovable del frontend.
9. Probar seguridad, permisos, cierres y auditoría.
10. Recién entonces desplegar en infraestructura del Ministerio.

## Regla de seguridad

El código del navegador puede contener una clave pública de Supabase durante la etapa transitoria, pero nunca debe contener una `service_role` key, contraseña de PostgreSQL ni otro secreto de servidor.

La clave pública utilizada durante la recuperación actual debe considerarse temporal y ser rotada antes de la puesta en producción institucional.
