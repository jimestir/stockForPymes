# Stock for PYMEs

Plataforma **ROPO** (*Research Online, Purchase Offline*) de stock y reservas para farmacias locales. La idea es que un cliente pueda consultar online la disponibilidad de productos en las farmacias de su zona, reservarlos y luego recogerlos y pagarlos físicamente en la farmacia.

Este repositorio es un **monorepo** gestionado con *npm workspaces* que, por ahora, contiene la API REST (backend). El desarrollo del frontend está pendiente.

## Introducción

El objetivo del proyecto es digitalizar el stock de pequeñas y medianas farmacias (PYMEs) sin obligarlas a montar un e-commerce completo. El flujo ROPO permite:

1. Buscar productos y ver en qué farmacia cercana hay stock.
2. Reservar el producto online.
3. Recogerlo y pagarlo en la propia farmacia.

La API expone actualmente la gestión de **farmacias** (alta y listado) y define los modelos base de **usuarios** con roles.

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
│   │       ├── middleware/      # Middlewares de validación
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
| GET | `/api/pharmacies` | Obtiene el listado de farmacias |
| POST | `/api/pharmacies` | Registra una nueva farmacia |

### Ejemplo: crear una farmacia

Petición:

```http
POST /api/pharmacies
Content-Type: application/json
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

Se aplicarán principalmente a las operaciones de consulta y registro de farmacias, comprobando tanto las respuestas correctas como el tratamiento de datos no válidos.

### Pruebas de integración

Permiten verificar la comunicación entre los distintos componentes del sistema, especialmente entre Express, Prisma y PostgreSQL.

Se utilizarán para comprobar que las peticiones realizadas a la API producen los resultados esperados en la base de datos.

## Tipos de pruebas previstos

| Tipo de prueba | Objetivo | Aplicación |
|---|---|---|
| Unitarias | Comprobar componentes de forma aislada. | Funciones y validaciones individuales. |
| Integración | Verificar la comunicación entre componentes. | API, Prisma y PostgreSQL. |
| Sistema | Comprobar el funcionamiento global de la aplicación. | Endpoints y servicios disponibles. |
| Aceptación | Verificar que el comportamiento responde a los requisitos. | Operaciones de gestión de farmacias. |
| Seguridad | Detectar entradas no válidas y posibles vulnerabilidades. | Validación de peticiones y respuestas HTTP. |

## Casos de prueba previstos

Los siguientes casos servirán como base para el banco de pruebas. Los resultados obtenidos y las evidencias deberán completarse después de ejecutar cada prueba.

| ID | Caso de prueba | Resultado esperado |
|---|---|---|
| CP01 | Consultar el estado de la API. | Respuesta HTTP 200 y estado `ok`. |
| CP02 | Consultar el listado de farmacias. | Respuesta HTTP 200 y listado en formato JSON. |
| CP03 | Registrar una farmacia con datos válidos. | Respuesta HTTP 201 y datos de la farmacia creada. |
| CP04 | Registrar una farmacia sin un campo obligatorio. | La petición debe ser rechazada por la validación. |
| CP05 | Acceder a una ruta inexistente. | Respuesta HTTP 404. |

**Nota:** estos son casos previstos, no resultados de pruebas ya ejecutadas. Los resultados reales y las evidencias se incorporarán durante la fase de ejecución.

## Scripts disponibles

En la raíz del monorepo:

| Script | Descripción |
|---|---|
| `npm run dev:api` | Ejecuta la API en modo desarrollo. |
| `npm run db:up` | Levanta PostgreSQL con Docker Compose. |
| `npm run db:down` | Detiene los servicios de Docker Compose. |
| `npm run db:logs` | Muestra los registros de PostgreSQL. |
| `npm run db:migrate` | Aplica las migraciones de Prisma. |

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
| `role` | Rol del usuario, por defecto `CLIENT`. |
| `pharmacyId` | Identificador de farmacia asociado (opcional). |
| `createdAt` | Fecha de creación. |
| `updatedAt` | Fecha de actualización. |

La relación entre `User` y `Pharmacy` es opcional. Una farmacia puede estar asociada a varios usuarios.

## Licencia

Este proyecto se distribuye bajo la licencia **GPL**.