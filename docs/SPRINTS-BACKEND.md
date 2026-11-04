# Plan de sprints — Stock for PYMEs (backend-first)

Mapa de trabajo para recrear el proyecto. Cada sprint define primero su parte de
base de datos y después la API que la usa.

## Estado actual

- **Sprint 0 — Fundaciones** ✅ (monorepo, Express, health, Docker/PostgreSQL, Prisma, config)
- **Sprint 1 — Modelo de datos** ✅ (schema completo, migración `init`, cliente)
- **Sprint 2 — Autenticación** ✅ (rama `feature/auth-jwt`, pendiente de merge)

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

## Sprint 3 — Catálogo e inventario

**Base de datos:** `Category`, `Product` ya existen. Falta:
- `Product.ean` (el prototipo lo usa en L6/L7 y no está en el schema) → migración nueva.
- `CHECK (stock >= 0)` y `CHECK (price >= 0)` → migración SQL manual (Prisma no los soporta).
- Seed inicial (categorías, productos, farmacias demo).

**API:**
- `GET /api/products` (filtro `q`, `categoryId`)
- `GET /api/inventory` y `PUT /api/inventory` (upsert stock/precio) — solo rol PHARMACY sobre **su** farmacia
- Uso de `Inventory.version` para *optimistic locking*

**Criterio de hecho:** una farmacia no puede tocar el inventario de otra; no se puede dejar stock negativo.

---

## Sprint 4 — Buscador / comparador

**Base de datos:** sin tablas nuevas. Aquí se explotan los **índices** (`products.name`, `pharmacies.cp`, `inventory(pharmacyId)`) y el `@@unique([pharmacyId, productId])`.

**API:**
- `GET /api/search?q=&cp=&pharmacyId=&categoryId=&sort=price_asc|price_desc`
- JOIN `Inventory → Product/Pharmacy`, orden por precio, stock > 0

**Criterio de hecho:** devuelve filas comparativas por farmacia y responde rápido con índices.

---

## Sprint 5 — Reservas y concurrencia (el núcleo ROPO)

**Base de datos:** `ReservationGroup` + `Reservation` ya existen. Falta:
- `CHECK (quantity > 0)`
- Índices `[status, expiresAt]` (ya están)
- **Decisión pendiente:** TTL de **30 min** (prototipo) vs **24 h** (código original). Hay que elegir uno.

**API:**
- `POST /api/reservations/groups` (carrito de una farmacia)
- `GET /api/reservations/groups`
- `POST /api/reservations/groups/:id/pickup` (total/parcial, restaura stock de los no recogidos)
- `POST /api/reservations/groups/:id/cancel`
- Job de expiración (cada 60 s) que marca `EXPIRED` y devuelve stock

**Concurrencia (clave):** transacción + `SELECT … FOR UPDATE` sobre `inventory`, validar stock, descontar, insertar reserva, `COMMIT`.

**Criterio de hecho:** dos reservas simultáneas no dejan stock negativo; cancelar/expirar restaura stock.

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

1. **TTL de reservas:** 30 min o 24 h.
2. **`Product.ean`:** el prototipo lo pide, el schema no lo tiene.
3. **Aprobación de farmacias (PENDING/APPROVED):** aparece en el prototipo L8 pero no en el schema ni en la API.
4. **Express 5 vs 4:** ✅ decidido — se mantiene Express 5.
5. **CHECK constraints:** se harán en migraciones SQL manuales.

## Recomendación inmediata

**Sprint 2 cerrado** ✅ (auth, rutas protegidas y rate limiting). Tras el merge a
`develop`, empezar el **Sprint 3**. Antes de implementarlo, hacer una **migración
pequeña** que resuelva `ean` + los `CHECK`. Así cada sprint entra con su base de
datos ya lista.
