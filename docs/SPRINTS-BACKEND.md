# Plan de sprints — Stock for PYMEs (backend-first)

Mapa de trabajo del proyecto. Cada sprint define primero su parte de
base de datos y después la API que la usa.

## Estado actual

- **Sprint 0 — Fundaciones** ✅ (monorepo, Express, health, Docker/PostgreSQL, Prisma, config)
- **Sprint 1 — Modelo de datos** ✅ (schema completo, migración `init`, cliente)
- **Sprint 2 — Autenticación** ✅ (integrado en `develop`)
- **Sprint 3 — Catálogo e inventario** ✅ (integrado en `develop`)
- **Sprint 4 — Buscador / comparador** ✅ (rama `feature/searchandpurchase`)
- **Sprint 5 — Reservas y concurrencia** ✅ (rama `feat/reservations`)

---

## Sprint 2 — Autenticación y seguridad ✅

**Base de datos:** cambios aplicados en esta rama:
- `enum UserRole` (`CLIENT`, `PHARMACY`, `ADMIN`); `User.role` pasa de `String` a
  `UserRole` (migración `20261101113856_user_role_enum`).
- `User.phone` (`String?`, migración `20261101114643_add_user_phone`).

**API:**
- `POST /api/auth/register` (CLIENT; PHARMACY vinculada a una farmacia existente;
  ADMIN no es autoregistrable)
- `POST /api/auth/login` → JWT (HS256, 8 h)
- `GET /api/auth/me` → usuario autenticado (`requireAuth`)
- `POST /api/pharmacies` protegido con `requireAuth` + `requireRole('ADMIN')`
- Middleware `requireAuth` + `requireRole`
- Rate limiting en `/register` y `/login` con `express-rate-limit` (responde 429)
- Helpers: hash con `bcryptjs` (10 rounds), firma/verificación con `jsonwebtoken`
  y validación del payload con Zod
- Usuario admin inicial: `npm run db:admin` (`prisma/seed-admin.ts`); credenciales
  configurables con `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME`

**Criterio de hecho:** ✅ verificado — registro y login funcionan; `GET /api/auth/me`
responde 401 sin token y `POST /api/pharmacies` responde 403 con rol CLIENT y 201
con rol ADMIN.

---

## Sprint 3 — Catálogo e inventario ✅

**Base de datos:** modelos nuevos (migración `20261104204039_catalog_inventory`):
- `Category` (`name` único) y `Product` (`categoryId?` opcional, índices en `name` y
  `categoryId`).
- `Inventory`: stock y precio por farmacia+producto, con
  `UNIQUE (pharmacyId, productId)` e `Inventory.version`.
- `CHECK (stock >= 0)` y `CHECK (price >= 0)` añadidos a mano en el SQL de la
  migración (Prisma no los genera).
- No se añadió `Product.ean`: el frontend consume `productId`. Queda como
  decisión pendiente si se necesita.

**API:**
- `GET /api/products` (público; filtros `q` y `categoryId`)
- `GET /api/inventory` y `PUT /api/inventory`:
  - `GET`: rol `PHARMACY` (su propia farmacia) o `ADMIN` (`?pharmacyId=`).
  - `PUT`: solo `PHARMACY`; el `pharmacyId` sale del JWT, nunca del body.
  - `upsert` por `(pharmacyId, productId)`; `version` se incrementa en cada update.
- Seed idempotente: `npm run db:seed` (categorías, productos, farmacias e inventario
  de demo).

**Criterio de hecho:** ✅ verificado — sin token `401`, rol `CLIENT` `403`, una
farmacia no ve ni escribe el inventario de otra, `stock: -1` da `400` por Zod y
`23514` (CHECK) si se intenta saltar la API.

---

## Sprint 4 — Buscador / comparador ✅

**Base de datos:** sin tablas nuevas. Se explotan los índices existentes
(`products.categoryId`, `inventory(pharmacyId)` y `@@unique([pharmacyId, productId])`)
y se añaden dos índices nuevos:

- `pharmacies.cp` (B-tree) para el filtro por código postal
  (migración `20261109230000_add_pharmacy_cp_index`).
- `products.name` con **GIN + `pg_trgm`** para acelerar búsquedas
  `ILIKE '%texto%'` (migración `20261109233000_add_product_name_trgm_index`).

**API:**
- `GET /api/search?q=&cp=&pharmacyId=&categoryId=&sort=price_asc|price_desc&limit=&offset=`
  - JOIN `Inventory → Product/Pharmacy`, orden por precio.
  - Incluye productos con `stock = 0` (`stock >= 0`), para que el cliente vea
    que esa farmacia no tiene disponibilidad.
  - `limit` entre 1 y 100 (por defecto 20) y `offset` >= 0 (por defecto 0).
  - Validación de UUID para `pharmacyId` y `categoryId`; 400 si son inválidos.
- Adaptador Prisma en `src/search/prisma-search-repository.ts`, separado del
  router mediante el puerto `SearchRepository`.
- Pruebas con Vitest + Supertest: contrato HTTP, montaje real de la ruta en la
  app y mapeo del adaptador (18 pruebas en total).

**Criterio de hecho:** ✅ verificado — devuelve filas comparativas por farmacia,
ordena por precio, pagina resultados y usa índices para `cp` y búsqueda por
texto (`pg_trgm`).

---

## Sprint 5 — Reservas y concurrencia (el núcleo ROPO) ✅

**Base de datos:** modelos `ReservationGroup` y `Reservation` (migración
`20261106204507_reservations`):
- Enums `ReservationStatus` (`PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`,
  `PICKED_UP`, `NOT_PICKED_UP`) y `ReservationGroupStatus` (`CONFIRMED`,
  `PARTIALLY_PICKED_UP`, `PICKED_UP`, `CANCELLED`, `EXPIRED`).
- `CHECK (quantity > 0)` en `reservations` (añadido en la migración).
- Índices `(pharmacyId, status)` y `(status, expiresAt)` en ambas tablas.

**API:**
- `POST /api/reservations/groups` (carrito de una farmacia, rol `CLIENT`)
- `GET /api/reservations/groups` (cliente: las suyas; farmacia: las de su
  farmacia; admin: todas)
- `POST /api/reservations/groups/:id/pickup` (total o parcial; restaura el stock
  de las líneas no recogidas; rol `PHARMACY` o `ADMIN`)
- `POST /api/reservations/groups/:id/cancel` (cancela líneas o el grupo completo)
- Job de expiración cada 60 s que marca `EXPIRED` y devuelve stock.
- TTL de reserva: **30 minutos**.

**Concurrencia (clave):** transacción + `SELECT … FOR UPDATE` sobre `inventory`,
validar stock, descontar, insertar reserva y `COMMIT`. Las líneas se bloquean en
orden estable por `productId` para evitar deadlocks.

**Criterio de hecho:** ✅ verificado — dos reservas simultáneas de la última
unidad devuelven `201` y `409`, el stock nunca queda negativo, y cancelar o
expirar restaura el stock.

---

## Sprint 6 — Eventos en vivo (SSE)

**API:**
- `GET /api/events/pharmacy` (stream `text/event-stream`) para el panel de farmacia
- Publicar `reservation.created` / `reservation.updated` cuando cambien stock o reservas

**Criterio de hecho:** el panel de farmacia ve cambios sin recargar.

---

## Sprint 7 — Calidad

- `vitest` + `supertest`: smoke test de health, auth, permisos, stock insuficiente (409), TTL
- Seed reproducible (`prisma/seed.ts`)
- Scripts `test`, `prisma:deploy`
- Opcional: CI (GitHub Actions)

---

## Sprint 8 — Despliegue

- Dockerfile de la API
- `render.yaml` (API + Postgres) y deploy del frontend en Vercel
- Variables de entorno de producción, `migrate deploy` en el arranque
- Documentación final (OpenAPI ya existe como contrato)

---

## Después del backend (frontend, por bloques)

- **Sprint 9:** auth + home/buscador
- **Sprint 10:** carrito + mis reservas (TTL visible)
- **Sprint 11:** panel farmacia (inventario, live)
- **Sprint 12:** admin + mapa (Leaflet/OSM) + QA

---

## Decisiones que debemos cerrar antes de sus sprints

1. **TTL de reservas:** ✅ decidido — 30 minutos.
2. **`Product.ean`:** el frontend lo necesita, el schema no lo tiene.
3. **Aprobación de farmacias (PENDING/APPROVED):** previsto en el diseño, pero no en el schema ni en la API.
4. **Express 5 vs 4:** ✅ decidido — se mantiene Express 5.
5. **CHECK constraints:** se harán en migraciones SQL manuales.

## Recomendación inmediata

**Sprints 2, 3, 4 y 5 cerrados** ✅. Tras el merge de `feat/reservations` a
`develop`, empezar el **Sprint 6 — Eventos en vivo (SSE)**. Antes de
implementarlo, cerrar las decisiones pendientes (`Product.ean` y aprobación de
farmacias).
