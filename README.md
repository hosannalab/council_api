# Council API

Backend NestJS + Prisma + PostgreSQL para la plataforma Council.

Documentación de dominio y plan: ver `../docs/` en la carpeta contenedora.

## Requisitos

- Node.js 22+
- PostgreSQL (nube o local)

## Configuración

```bash
cp .env.example .env
# Editar DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (mín. 32 chars)
npm install
npm run prisma:generate
npm run prisma:migrate    # crea tablas
npm run prisma:seed       # datos demo
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`
- Health: `GET /api/v1/health`

## Usuarios demo (seed)

| Email | Contraseña | Rol |
|-------|------------|-----|
| `superadmin@council.local` | `Admin123!` | Super Admin |
| `admin@demo-concilio.local` | `Admin123!` | Council Admin |

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run start:dev` | Desarrollo con hot reload |
| `npm run build` | Compilar |
| `npm test` | Tests unitarios |
| `npm run prisma:migrate` | Migración dev |
| `npm run prisma:migrate:deploy` | Migración en CI/prod |
| `npm run prisma:seed` | Semilla |

## Auth

- `POST /api/v1/auth/login` — login (rate limited)
- `POST /api/v1/auth/refresh` — renovar tokens
- `POST /api/v1/auth/logout` — cerrar sesión (Bearer)
- `GET /api/v1/auth/me` — perfil + permisos (Bearer)

Sesión única: un nuevo login invalida la sesión anterior.

## RBAC

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/permissions` | `roles:read` |
| GET/POST/PATCH/DELETE | `/roles` | `roles:read` / `roles:write` |
| GET/POST/PATCH | `/users` | `users:read` / `users:write` |

Los roles del sistema (`Super Admin`, `Council Admin`) no se pueden modificar ni eliminar.

## Iglesias

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/churches` | `churches:read` |
| POST/PATCH | `/churches` | `churches:write` |
| PATCH | `/churches/:id/deactivate` | `churches:write` |

Filtros: `search`, `status`, `city`, `currentPastorId`, paginación.

## Ministros

| Método | Ruta | Permiso |
|--------|------|---------|
| GET/POST/PATCH | `/ministers` | `ministers:read` / `ministers:write` |
| POST | `/ministers/:id/assignments` | `ministers:write` |
| GET/POST | `/ministers/:id/comments` | `ministers:read` / `ministers:write` |

Un ministro solo puede tener **una asignación activa** (`endedAt` null). Pastores actualizan `church.currentPastorId`.

## Miembros

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/members/scope` | `members:read` |
| GET/POST/PATCH | `/members` | `members:read` / `members:write` |
| POST | `/members/:id/transfer` | `members:write` |

Miembros no se eliminan; `PATCH .../deactivate`. Historial automático en cada evento (`GET .../history`).

## Finanzas

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/finance/scope` | `finance:read` |
| GET | `/finance/summary` | `finance:read` |
| GET/POST/PATCH | `/finance/categories` | `finance:read` / `finance:write` |
| GET/POST/PATCH | `/finance/transactions` | `finance:read` / `finance:write` |

Los egresos (`EXPENSE`) requieren `justification`. Pastor ve solo su iglesia asignada; concilio ve consolidado.

## Bautismos

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/baptisms/scope` | `baptisms:read` |
| GET/POST/PATCH | `/baptisms` | `baptisms:read` / `baptisms:write` |

## Presentaciones de niños

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/dedications/scope` | `dedications:read` |
| GET/POST/PATCH | `/dedications` | `dedications:read` / `dedications:write` |

Pastor limitado a su iglesia asignada; concilio ve todo el tenant.
