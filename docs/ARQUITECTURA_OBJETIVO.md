# Arquitectura objetivo de gonzalocoop

## Componentes

### 1. Frontend

Responsabilidad:

- interfaz de cooperadoras;
- libro mensual;
- resumen anual;
- panel de auditoría;
- formularios;
- reportes y exportaciones.

El frontend no debe contener secretos ni conectarse directamente a PostgreSQL.

### 2. Backend/API

Responsabilidad:

- autenticar al usuario;
- determinar identidad y rol;
- autorizar cada operación;
- validar datos de entrada;
- ejecutar operaciones de negocio;
- registrar auditoría;
- comunicarse con PostgreSQL.

Endpoints conceptuales:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me
GET    /api/cooperadora
POST   /api/cooperadora
GET    /api/cooperadora/:id/ejercicio/:anio
GET    /api/rubros
POST   /api/rubros
PATCH  /api/rubros/:id
GET    /api/parametros
PATCH  /api/parametros
POST   /api/periodos/:anio/:mes
POST   /api/periodos/:id/cerrar
POST   /api/movimientos
GET    /api/movimientos
GET    /api/auditoria/cooperadoras
GET    /api/auditoria/cooperadoras/:id
```

Los nombres son una propuesta inicial y deben ajustarse durante la implementación.

### 3. PostgreSQL

Debe contener los datos institucionales y garantizar las reglas que no pueden quedar únicamente en JavaScript.

Tablas principales:

```text
usuarios
roles
usuario_roles
cooperadoras
perfiles
rubros
periodos
movimientos
parametros_control
auditoria_eventos
```

## Separación de responsabilidades

```text
React/TanStack
    |
    | HTTP/JSON
    v
API
    |
    +--> autenticación
    +--> autorización
    +--> validación
    +--> auditoría
    |
    v
PostgreSQL
    |
    +--> constraints
    +--> índices
    +--> triggers críticos
    +--> transacciones
```

## Regla de oro

El navegador nunca debe recibir credenciales de PostgreSQL y nunca debe poder saltarse la autorización del backend modificando JavaScript.

## Compatibilidad con la aplicación actual

La lógica de cálculo de `src/lib/libro.ts` puede permanecer en TypeScript mientras se construye la API. Las funciones que actualmente hacen consultas directas a Supabase deberán migrarse gradualmente a un cliente de API.

Esto permite una migración incremental y reduce el riesgo de romper el sistema.
