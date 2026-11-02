# Stock for PYMEs

Plataforma **ROPO** (*Research Online, Purchase Offline*) de stock y reservas para
farmacias locales. La idea es que un cliente pueda consultar online la
disponibilidad de productos en las farmacias de su zona, reservarlos, y luego
recogerlos y pagarlos físicamente en la farmacia.

Este repositorio es un **monorepo** gestionado con *npm workspaces* que, por
ahora, contiene la API REST (backend).

## Introducción

El objetivo del proyecto es digitalizar el stock de pequeñas y medianas farmacias
(PYMEs) sin obligarlas a montar un e-commerce completo. El flujo ROPO permite:

1. Buscar productos y ver en qué farmacia cercana hay stock.
2. Reservar el producto online.
3. Recogerlo y pagarlo en la propia farmacia.

La API expone actualmente la gestión de **farmacias** (alta y listado) y define
los modelos base de **usuarios** con roles.

## Stack tecnológico

| Capa            | Tecnología                          |
| --------------- | ----------------------------------- |
| Lenguaje        | TypeScript                          |
| Runtime         | Node.js                             |
| API             | Express 5                           |
| Validación      | Zod                                 |
| ORM             | Prisma                              |
| Base de datos   | PostgreSQL 16                       |
| Contenedores    | Docker / Docker Compose             |
| Monorepo        | npm workspaces                      |

## Estructura del proyecto

```
stockForPymes/
├── apps/
│   ├── api/                     # Backend REST (Express + Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Modelos de datos
│   │   │   └── migrations/      # Migraciones SQL
│   │   └── src/
│   │       ├── app.ts           # Configuración de Express
│   │       ├── index.ts         # Punto de entrada
│   │       ├── lib/prisma.ts    # Cliente Prisma
│   │       ├── middleware/      # Middlewares (validación)
│   │       ├── routes/          # Rutas HTTP
│   │       └── schemas/         # Esquemas Zod
│   └── web/                     # Frontend (pendiente)
├── docker-compose.yml           # PostgreSQL para desarrollo
├── package.json                 # Workspaces y scripts raíz
└── tsconfig.base.json           # Configuración TS compartida
```

## Requisitos previos

- **Node.js** 20.6 o superior (incluye `npm`; se usa el flag nativo `--env-file`).
- **Docker** y **Docker Compose** (para la base de datos en desarrollo).
- **Git**.

## Puesta en marcha

### 1. Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd stockForPymes
```

### 2. Instalar dependencias

Desde la raíz del monorepo (instala las dependencias de todos los workspaces):

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un único archivo `.env` en la raíz del proyecto con el siguiente contenido
(ajusta los valores según necesites):

```dotenv
# PostgreSQL
POSTGRES_USER=stock
POSTGRES_PASSWORD=stock_dev_password
POSTGRES_DB=stock_for_pymes
POSTGRES_PORT=5432

# Prisma / API
DATABASE_URL=postgresql://stock:stock_dev_password@localhost:5432/stock_for_pymes?schema=public

# JWT
JWT_SECRET=cambia-esta-clave-por-una-larga-y-aleatoria
JWT_EXPIRES_IN=8h

# API
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Rate limiting (opcional, tienen defaults)
# AUTH_RATE_LIMIT_WINDOW_MS=900000
# AUTH_RATE_LIMIT_MAX=10
```

> `DATABASE_URL` debe coincidir con las credenciales y el puerto definidos para
> PostgreSQL. No subas el archivo `.env` al repositorio (ya está en `.gitignore`).

Los scripts `dev` y `start` de `apps/api` cargan automáticamente ese archivo con
el flag nativo **`--env-file`** de Node.js, de modo que `DATABASE_URL` está
disponible para Prisma sin necesidad de exportarla a mano. Docker Compose también
lee el `.env` de la raíz de forma automática.

### 4. Levantar la base de datos

Arranca PostgreSQL con Docker Compose:

```bash
npm run db:up
```

Comandos de apoyo:

```bash
npm run db:logs   # ver logs de PostgreSQL
npm run db:down   # detener la base de datos
```

### 5. Aplicar las migraciones de Prisma

Genera el cliente de Prisma y crea las tablas en la base de datos:

```bash
npm run db:migrate
```

Esto ejecuta las migraciones existentes, crea el cliente `@prisma/client` y deja
la base de datos lista.

### 6. Arrancar la API en desarrollo

Desde la raíz:

```bash
npm run dev:api
```

La API quedará disponible en `http://localhost:3000`. Puedes comprobar que
funciona con:

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "service": "api" }
```

## Endpoints de la API

Base: `http://localhost:3000/api`

| Método | Ruta                 | Descripción                                  |
| ------ | -------------------- | -------------------------------------------- |
| GET    | `/api/health`        | Estado del servicio                          |
| POST   | `/api/auth/register` | Registro de usuario (`CLIENT` o `PHARMACY`)  |
| POST   | `/api/auth/login`    | Login y emisión del JWT                      |
| GET    | `/api/auth/me`       | Usuario autenticado (requiere `Bearer`)      |
| GET    | `/api/pharmacies`    | Lista todas las farmacias                    |
| POST   | `/api/pharmacies`    | Crea una farmacia (requiere rol `ADMIN`)     |

### Autenticación

Registro de un cliente:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "password": "secreto123",
    "name": "Cliente Demo",
    "role": "CLIENT"
  }'
```

Para registrarse como `PHARMACY` hay que enviar además el `pharmacyId` de una
farmacia existente. El rol `ADMIN` no se puede crear desde el registro.

Login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "cliente@example.com", "password": "secreto123" }'
```

Ambos devuelven `{ "token": "...", "user": { ... } }`. El token se envía en las
rutas protegidas:

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

Los endpoints `/api/auth/register` y `/api/auth/login` tienen rate limiting:
tras superar el límite responden `429` con cabeceras `RateLimit-*`.

### Crear el usuario administrador

```bash
npm run db:admin
```

Crea (o promociona) un usuario `ADMIN` de forma idempotente. Por defecto:
`admin@stockpymes.local` / `Admin1234!`. Se puede personalizar con las variables
`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME`. **Cambia la contraseña en
producción.**

### Ejemplo: crear una farmacia

Requiere el token de un usuario `ADMIN`:

```bash
curl -X POST http://localhost:3000/api/pharmacies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-admin>" \
  -d '{
    "name": "Farmacia Central",
    "address": "Calle Mayor 1",
    "cp": "28001",
    "lat": 40.4168,
    "lng": -3.7038,
    "phone": "910000000"
  }'
```

Campos requeridos: `name`, `address`, `cp`. Opcionales: `lat`, `lng`, `phone`.

## Scripts disponibles

En la **raíz** del monorepo:

| Script           | Descripción                                |
| ---------------- | ------------------------------------------ |
| `npm run dev:api`| Ejecuta la API en modo desarrollo (watch)  |
| `npm run db:up`  | Levanta PostgreSQL con Docker Compose      |
| `npm run db:down`| Detiene PostgreSQL                         |
| `npm run db:logs`| Muestra los logs de PostgreSQL             |
| `npm run db:migrate` | Aplica las migraciones de Prisma       |
| `npm run db:admin`   | Crea/promociona el usuario administrador |

En `apps/api`:

| Script             | Descripción                             |
| ------------------ | --------------------------------------- |
| `npm run dev`      | API en modo desarrollo con recarga      |
| `npm run build`    | Compila TypeScript a `dist/`            |
| `npm start`        | Ejecuta la build de producción          |
| `npm run typecheck`| Comprueba tipos sin emitir              |
| `npm run clean`    | Elimina la carpeta `dist/`              |

## Modelo de datos

Definido en `apps/api/prisma/schema.prisma`:

- **Pharmacy**: `id`, `name`, `address`, `cp`, `lat?`, `lng?`, `phone?`,
  `createdAt`, `updatedAt`.
- **User**: `id`, `email` (único), `passwordHash`, `name`,
  `role` (`enum UserRole`: `CLIENT` | `PHARMACY` | `ADMIN`, por defecto `CLIENT`),
  `phone?`, `pharmacyId?` (relación opcional con una farmacia).

## Licencia

Este proyecto se distribuye bajo la licencia **GPL**.
