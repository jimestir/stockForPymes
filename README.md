# Stock for PYMEs

Plataforma **ROPO** (*Research Online, Purchase Offline*) de stock y reservas para farmacias locales. La idea es que un cliente pueda consultar online la disponibilidad de productos en las farmacias de su zona, reservarlos y luego recogerlos y pagarlos físicamente en la farmacia.

Este repositorio es un **monorepo** gestionado con *npm workspaces* que, por ahora, contiene la API REST (backend). El desarrollo del frontend está pendiente.

## Introducción

El objetivo del proyecto es digitalizar el stock de pequeñas y medianas farmacias (PYMEs) sin obligarlas a montar un e-commerce completo. El flujo ROPO permite:

1. Buscar productos y ver en qué farmacia cercana hay stock.
2. Reservar el producto online.
3. Recogerlo y pagarlo en la propia farmacia.

La API expone actualmente la gestión de **farmacias** (alta y listado) y la **autenticación de usuarios** con roles (`CLIENT`, `PHARMACY` y `ADMIN`).

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Runtime | Node.js |
| API | Express 5 |
| Validación | Zod |
| ORM | Prisma |
| Base de datos | PostgreSQL 16 |
| Contenedores | Docker / Docker Compose |
| Monorepo | npm workspaces |

## Estructura del proyecto

```text
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
│   │       ├── middleware/      # Middlewares de validación y autenticación
│   │       ├── routes/          # Rutas HTTP
│   │       └── schemas/         # Esquemas Zod
│   └── web/                     # Frontend (pendiente)
├── docker-compose.yml           # PostgreSQL para desarrollo
├── package.json                 # Workspaces y scripts raíz
└── tsconfig.base.json           # Configuración TypeScript compartida
```

## Requisitos previos

- **Node.js:** versión 20.6 o superior.
- **npm:** gestor de paquetes incluido con Node.js.
- **Docker Desktop** y **Docker Compose:** para la base de datos.
- **Git:** para el control de versiones.

## Puesta en marcha

### 1. Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd stockForPymes
```

### 2. Instalar dependencias

Desde la raíz del monorepo:

```bash
npm install
```

### 3. Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto con el siguiente contenido:

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

`DATABASE_URL` debe coincidir con las credenciales y el puerto definidos para PostgreSQL.

El archivo `.env` no debe subirse al repositorio, ya que está incluido en `.gitignore`.

Los scripts de desarrollo de `apps/api` cargan las variables de entorno desde el archivo `.env` de la raíz mediante el parámetro `--env-file` de Node.js. Docker Compose también lee automáticamente ese archivo.

### 4. Levantar la base de datos

Iniciar PostgreSQL con Docker Compose:

```bash
npm run db:up
```

Comandos adicionales:

```bash
npm run db:logs
```

Muestra los registros de PostgreSQL.

```bash
npm run db:down
```

Detiene los servicios de Docker Compose.

### 5. Aplicar las migraciones de Prisma

Ejecutar:

```bash
npm run db:migrate
```

Este comando aplica las migraciones existentes, actualiza la estructura de la base de datos y genera Prisma Client.

### 6. Arrancar la API en desarrollo

Desde la raíz del proyecto:

```bash
npm run dev:api
```

La API estará disponible en:

`http://localhost:3000`

Para comprobar que funciona, acceder a:

`http://localhost:3000/api/health`

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "api"
}
```

## Endpoints de la API

Base de la API:

`http://localhost:3000/api`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Comprueba el estado del servicio |
| POST | `/api/auth/register` | Registro de usuario (`CLIENT` o `PHARMACY`) |
| POST | `/api/auth/login` | Login y emisión del JWT |
| GET | `/api/auth/me` | Usuario autenticado (requiere `Bearer`) |
| GET | `/api/pharmacies` | Obtiene el listado de farmacias |
| POST | `/api/pharmacies` | Registra una nueva farmacia (requiere rol `ADMIN`) |

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

Para registrarse como `PHARMACY` hay que enviar además el `pharmacyId` de una farmacia existente. El rol `ADMIN` no se puede crear desde el registro.

Login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "cliente@example.com", "password": "secreto123" }'
```

Ambos devuelven `{ "token": "...", "user": { ... } }`. El token se envía en las rutas protegidas:

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

Los endpoints `/api/auth/register` y `/api/auth/login` tienen rate limiting: tras superar el límite responden `429` con cabeceras `RateLimit-*`.

### Crear el usuario administrador

```bash
npm run db:admin
```

Crea (o promociona) un usuario `ADMIN` de forma idempotente. Por defecto: `admin@stockpymes.local` / `Admin1234!`. Se puede personalizar con las variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME`. **Cambia la contraseña en producción.**

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

Cuerpo JSON:

```json
{
  "name": "Farmacia Central",
  "address": "Calle Mayor 1",
  "cp": "28001",
  "lat": 40.4168,
  "lng": -3.7038,
  "phone": "910000000"
}
```

Campos requeridos:

- `name`
- `address`
- `cp`

Campos opcionales:

- `lat`
- `lng`
- `phone`

Si la creación se realiza correctamente, la API devuelve el código HTTP `201 Created` junto con los datos de la farmacia registrada.

## Estrategia de pruebas

La estrategia de pruebas tiene como objetivo comprobar el correcto funcionamiento de la API, validar los datos recibidos y verificar la comunicación con la base de datos PostgreSQL.

Se contemplan las siguientes técnicas:

### Pruebas de caja negra

Permiten comprobar el comportamiento de los endpoints a partir de sus entradas y salidas, sin necesidad de conocer su implementación interna.

Se aplicarán principalmente a las operaciones de consulta y registro de farmacias, así como a los flujos de registro, login y acceso a rutas protegidas, comprobando tanto las respuestas correctas como el tratamiento de datos no válidos.

### Pruebas de integración

Permiten verificar la comunicación entre los distintos componentes del sistema, especialmente entre Express, Prisma y PostgreSQL.

Se utilizarán para comprobar que las peticiones realizadas a la API producen los resultados esperados en la base de datos.

## Tipos de pruebas previstos

| Tipo de prueba | Objetivo | Aplicación |
|---|---|---|
| Unitarias | Comprobar componentes de forma aislada. | Funciones y validaciones individuales. |
| Integración | Verificar la comunicación entre componentes. | API, Prisma y PostgreSQL. |
| Sistema | Comprobar el funcionamiento global de la aplicación. | Endpoints y servicios disponibles. |
| Aceptación | Verificar que el comportamiento responde a los requisitos. | Operaciones de gestión de farmacias y autenticación. |
| Seguridad | Detectar entradas no válidas y posibles vulnerabilidades. | Validación de peticiones, autenticación y respuestas HTTP. |

## Casos de prueba previstos

Los siguientes casos servirán como base para el banco de pruebas. Los resultados obtenidos y las evidencias deberán completarse después de ejecutar cada prueba.

| ID | Caso de prueba | Resultado esperado |
|---|---|---|
| CP01 | Consultar el estado de la API. | Respuesta HTTP 200 y estado `ok`. |
| CP02 | Consultar el listado de farmacias. | Respuesta HTTP 200 y listado en formato JSON. |
| CP03 | Registrar una farmacia con datos válidos como `ADMIN`. | Respuesta HTTP 201 y datos de la farmacia creada. |
| CP04 | Registrar una farmacia sin un campo obligatorio. | Respuesta HTTP 400 por error de validación. |
| CP05 | Acceder a una ruta inexistente. | Respuesta HTTP 404. |
| CP06 | Registrar un usuario `CLIENT` con datos válidos. | Respuesta HTTP 201 con `token` y datos del usuario. |
| CP07 | Iniciar sesión con credenciales válidas. | Respuesta HTTP 200 con `token` y datos del usuario. |
| CP08 | Iniciar sesión con credenciales inválidas. | Respuesta HTTP 401. |
| CP09 | Acceder a `/api/auth/me` sin token. | Respuesta HTTP 401. |
| CP10 | Crear una farmacia con un rol distinto de `ADMIN`. | Respuesta HTTP 403. |

**Nota:** estos son casos previstos, no resultados de pruebas ya ejecutadas. Los resultados reales y las evidencias se incorporarán durante la fase de ejecución.

## Scripts disponibles

En la raíz del monorepo:

| Script | Descripción |
|---|---|
| `npm run dev:api` | Ejecuta la API en modo desarrollo (watch). |
| `npm run db:up` | Levanta PostgreSQL con Docker Compose. |
| `npm run db:down` | Detiene los servicios de Docker Compose. |
| `npm run db:logs` | Muestra los registros de PostgreSQL. |
| `npm run db:migrate` | Aplica las migraciones de Prisma. |
| `npm run db:admin` | Crea o promociona el usuario administrador. |

En `apps/api`:

| Script | Descripción |
|---|---|
| `npm run dev` | Ejecuta la API en desarrollo con recarga automática. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la versión compilada. |
| `npm run typecheck` | Comprueba los tipos sin generar archivos. |
| `npm run clean` | Elimina la carpeta `dist/`. |

## Modelo de datos

Definido en `apps/api/prisma/schema.prisma`.

### Pharmacy

Representa las farmacias registradas en la plataforma.

| Campo | Descripción |
|---|---|
| `id` | Identificador UUID. |
| `name` | Nombre de la farmacia. |
| `address` | Dirección. |
| `cp` | Código postal. |
| `lat` | Latitud (opcional). |
| `lng` | Longitud (opcional). |
| `phone` | Teléfono (opcional). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Fecha de actualización. |

### User

Representa a los usuarios de la plataforma.

| Campo | Descripción |
|---|---|
| `id` | Identificador UUID. |
| `email` | Correo electrónico único. |
| `passwordHash` | Contraseña almacenada mediante hash. |
| `name` | Nombre del usuario. |
| `phone` | Teléfono (opcional). |
| `role` | Rol del usuario: `CLIENT`, `PHARMACY` o `ADMIN`. Por defecto `CLIENT`. |
| `pharmacyId` | Identificador de farmacia asociado (opcional). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Fecha de actualización. |

La relación entre `User` y `Pharmacy` es opcional: una farmacia puede estar asociada a varios usuarios y un usuario puede no tener farmacia. En el registro, solo el rol `PHARMACY` requiere `pharmacyId`; el rol `ADMIN` se crea mediante el script `db:admin`.

## Licencia

Este proyecto se distribuye bajo la licencia **GPL**.