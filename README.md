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
├── docs/
│   ├── requests.http            # Pruebas de endpoints (REST Client)
│   └── SPRINTS-*.md             # Plan de sprints
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

### 7. Probar los endpoints

El repositorio incluye `docs/requests.http`, un archivo de pruebas de los
endpoints. Se usa con la extensión **REST Client** de VS Code; los pasos están
en [Prueba de endpoints con VS Code](#prueba-de-endpoints-con-vs-code).

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
| GET | `/api/products` | Catálogo de productos (filtros `q` y `categoryId`) |
| GET | `/api/inventory` | Inventario de la farmacia autenticada (rol `PHARMACY` o `ADMIN`) |
| PUT | `/api/inventory` | Crea o actualiza stock y precio (rol `PHARMACY`) |
| GET | `/api/search` | Buscador comparador de precios y stock (filtros `q`, `cp`, `pharmacyId`, `categoryId`, `sort`, `limit`, `offset`) |
| POST | `/api/reservations/groups` | Crea una reserva para una farmacia (rol `CLIENT`) |
| GET | `/api/reservations/groups` | Lista reservas del cliente, farmacia o admin |
| POST | `/api/reservations/groups/:id/pickup` | Recogida total o parcial (rol `PHARMACY` o `ADMIN`) |
| POST | `/api/reservations/groups/:id/cancel` | Cancela líneas o el grupo completo y restaura stock |

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

### Buscador y comparador de precios

`GET /api/search` devuelve una fila por producto y farmacia, uniendo el
inventario con el producto y la farmacia. Es un endpoint público.

Parámetros de consulta:

| Parámetro | Descripción |
|---|---|
| `q` | Texto a buscar en el nombre del producto (sin distinguir mayúsculas). |
| `cp` | Código postal de la farmacia. |
| `pharmacyId` | UUID de una farmacia concreta. |
| `categoryId` | UUID de una categoría. |
| `sort` | `price_asc` (por defecto) o `price_desc`. |
| `limit` | Número de resultados, entre 1 y 100 (por defecto 20). |
| `offset` | Número de resultados a omitir (por defecto 0). |

Ejemplo:

```bash
curl "http://localhost:3000/api/search?q=paracetamol&cp=28001&sort=price_asc&limit=10"
```

Respuesta:

```json
[
  {
    "productId": "33333333-3333-4333-8333-333333333333",
    "productName": "Paracetamol 500 mg",
    "pharmacyId": "11111111-1111-4111-8111-111111111111",
    "pharmacyName": "Farmacia Central",
    "cp": "28001",
    "stock": 40,
    "price": 4.95,
    "lat": 40.4168,
    "lng": -3.7038
  }
]
```

Los productos con stock cero también aparecen en el comparador, para que el
cliente vea que esa farmacia no tiene disponibilidad.

### Reservas

Las reservas agrupan los productos de una sola farmacia. Cada grupo caduca a los
**30 minutos**; al expirar, el stock reservado se devuelve automáticamente.

Crear una reserva (rol `CLIENT`):

```bash
curl -X POST http://localhost:3000/api/reservations/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-cliente>" \
  -d '{
    "pharmacyId": "11111111-1111-4111-8111-111111111111",
    "items": [
      { "productId": "22222222-2222-4222-8222-222222222222", "quantity": 2 }
    ]
  }'
```

La API descuenta el stock dentro de una transacción con bloqueo `FOR UPDATE`, de
modo que dos reservas simultáneas no pueden dejar stock negativo. Si no hay
stock suficiente responde `409`.

Recogida total o parcial (rol `PHARMACY` o `ADMIN`):

```bash
# Todas las líneas activas
curl -X POST http://localhost:3000/api/reservations/groups/<id>/pickup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-farmacia>" \
  -d '{ "all": true }'

# Solo algunas líneas; el resto se marca como no recogido y devuelve su stock
curl -X POST http://localhost:3000/api/reservations/groups/<id>/pickup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-farmacia>" \
  -d '{ "itemIds": ["<item-id>"] }'
```

Cancelar:

```bash
curl -X POST http://localhost:3000/api/reservations/groups/<id>/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{ "all": true }'
```

También se puede cancelar por líneas con `{ "itemIds": ["<item-id>"] }`.

## Estrategia de pruebas

La estrategia de pruebas tiene como objetivo comprobar el correcto funcionamiento de la API, validar los datos recibidos y verificar la comunicación con la base de datos PostgreSQL.

Se contemplan las siguientes técnicas:

### Pruebas de caja negra

Permiten comprobar el comportamiento de los endpoints a partir de sus entradas y salidas, sin necesidad de conocer su implementación interna.

Se aplicarán principalmente a las operaciones de consulta y registro de farmacias, así como a los flujos de registro, login y acceso a rutas protegidas, comprobando tanto las respuestas correctas como el tratamiento de datos no válidos.

### Pruebas de integración

Permiten verificar la comunicación entre los distintos componentes del sistema, especialmente entre Express, Prisma y PostgreSQL.

Se utilizarán para comprobar que las peticiones realizadas a la API producen los resultados esperados en la base de datos.

### Pruebas automatizadas (Vitest + Supertest)

El API incluye pruebas automatizadas con **Vitest** y **Supertest**. Desde la
raíz del monorepo:

```bash
npm test
```

Para ejecutarlas en modo watch desde `apps/api`:

```bash
npm run test:watch -w @stock-pymes/api
```

Las pruebas cubren el contrato HTTP del buscador (filtros, orden, paginación,
UUID inválidos y errores), el montaje real de la ruta en la aplicación y el
mapeo del adaptador Prisma. No necesitan una base de datos levantada porque el
adaptador se prueba con el cliente Prisma simulado.

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

### Prueba de endpoints con VS Code

El repositorio incluye `docs/requests.http`, un archivo de pruebas de los
endpoints de la API. Se utiliza con la extensión **REST Client** de VS Code:

1. Instala la extensión **REST Client** (Huachao Mao) desde el marketplace.
2. Abre `docs/requests.http` en VS Code.
3. Ejecuta las peticiones en orden con el enlace **Send Request** que aparece
   encima de cada bloque. Empieza siempre por el `login`, porque el resto usa
   el token que devuelve.

Incluye los flujos de `ADMIN`, `PHARMACY` y `CLIENT`, con los tokens encadenados,
las pruebas de permisos (401 y 403) y la de stock negativo (400). Sirve además
para reproducir los casos de prueba `CP01`–`CP10` de la sección anterior.

> Las credenciales del archivo son de desarrollo. No las uses en producción.

## Scripts disponibles

En la raíz del monorepo:

| Script | Descripción |
|---|---|
| `npm run dev:api` | Ejecuta la API en modo desarrollo (watch). |
| `npm test` | Ejecuta las pruebas automatizadas del API con Vitest. |
| `npm run db:up` | Levanta PostgreSQL con Docker Compose. |
| `npm run db:down` | Detiene los servicios de Docker Compose. |
| `npm run db:logs` | Muestra los registros de PostgreSQL. |
| `npm run db:migrate` | Aplica las migraciones de Prisma. |
| `npm run db:admin` | Crea o promociona el usuario administrador. |
| `npm run db:seed` | Carga categorías, productos, farmacias e inventario de demo. |

En `apps/api`:

| Script | Descripción |
|---|---|
| `npm run dev` | Ejecuta la API en desarrollo con recarga automática. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la versión compilada. |
| `npm run typecheck` | Comprueba los tipos del código y de las pruebas sin generar archivos. |
| `npm test` | Ejecuta las pruebas con Vitest. |
| `npm run test:watch` | Ejecuta las pruebas en modo watch. |
| `npm run clean` | Elimina la carpeta `dist/`. |
| `npm run db:seed` | Carga los datos de demo. |

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

### Category

Categorías del catálogo.

| Campo | Descripción |
|---|---|
| `id` | Identificador UUID. |
| `name` | Nombre único de la categoría. |
| `createdAt` | Fecha de creación. |

### Product

Catálogo global de productos. No guarda stock: el stock vive por farmacia.

| Campo | Descripción |
|---|---|
| `id` | Identificador UUID. |
| `name` | Nombre del producto. |
| `description` | Descripción (opcional). |
| `categoryId` | Categoría asociada (opcional). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Fecha de actualización. |

### Inventory

Stock y precio de un producto en una farmacia concreta. Es la fuente de verdad.

| Campo | Descripción |
|---|---|
| `id` | Identificador UUID. |
| `pharmacyId` | Farmacia a la que pertenece la fila. |
| `productId` | Producto. |
| `stock` | Unidades disponibles (no puede ser negativo). |
| `price` | Precio con dos decimales (no puede ser negativo). |
| `version` | Se incrementa en cada actualización (base del bloqueo optimista). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Fecha de actualización. |

Restricciones: `UNIQUE (pharmacyId, productId)` y los `CHECK (stock >= 0)` / `CHECK (price >= 0)` aplicados en la migración SQL. Una farmacia solo puede modificar su propio inventario: el `pharmacyId` se toma del JWT, nunca del cuerpo de la petición.

## Licencia

Este proyecto se distribuye bajo la licencia **GPL**.