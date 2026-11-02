# Plan de sprints — Frontend (Stock for PYMEs)

Continuación del plan backend. El frontend se construye **después** de que existan
los endpoints que consume. Stack: **React + Vite + TypeScript + React Router**.

## Requisitos previos

- Backend con auth, catálogo, inventario, búsqueda, reservas y eventos (Sprints 2–6).
- Contrato API en `docs/openapi.yaml`.
- Variables: `VITE_API_URL` (p. ej. `http://localhost:3000`).

## Estructura objetivo

```
apps/web/
├── src/
│   ├── main.tsx
│   ├── App.tsx                 # rutas
│   ├── lib/
│   │   ├── api.ts              # cliente fetch + token
│   │   └── auth-storage.ts     # persistencia del JWT
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── CartContext.tsx
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── PharmacyMap.tsx
│   │   └── PharmacyDetailModal.tsx
│   └── pages/
│       ├── HomePage.tsx
│       ├── PharmaciesPage.tsx
│       ├── CartPage.tsx
│       ├── ReservationsPage.tsx
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       ├── InventoryPage.tsx
│       ├── LivePage.tsx
│       └── AdminPharmaciesPage.tsx

```

---

## Sprint 9 — Fundaciones y autenticación

**Objetivo:** app navegable con login/registro y sesión persistente.

**Tareas:**
- Crear `apps/web` con Vite + React + TypeScript (workspace `@stock-pymes/web`).
- Instalar `react-router-dom`.
- `lib/api.ts`: wrapper de `fetch` que añade `Authorization: Bearer <token>` y normaliza errores.
- `lib/auth-storage.ts`: guardar/leer/borrar el JWT (localStorage).
- `AuthContext`: estado `user`, `login`, `logout`, `loading`.
- Páginas `LoginPage` y `RegisterPage` conectadas a `POST /api/auth/login` y `/register`.
- `Layout` con navegación según rol; `ProtectedRoute` por rol.
- Configurar CORS en backend para el origen del frontend.

**API usada:** `POST /api/auth/register`, `POST /api/auth/login`.

**Criterio de hecho:** registro y login funcionan; al recargar se mantiene la sesión; las rutas protegidas redirigen a login.

---

## Sprint 10 — Home, buscador y comparador

**Objetivo:** buscar productos y comparar precios entre farmacias.

**Tareas:**
- `HomePage`: barra de búsqueda destacada + filtros (categoría, CP, precio).
- Tabla comparativa: Producto | Farmacia | Precio | Stock | Acción.
- Orden por precio (`price_asc` / `price_desc`).
- Estados de carga / vacío / error.
- `CartContext`: guardar líneas del carrito; botón "Reservar" añade 1 unidad.
- Validar que solo `CLIENT` puede añadir; mensaje si no hay sesión.

**API usada:** `GET /api/search`, `GET /api/products`.

**Criterio de hecho:** búsqueda con filtros devuelve resultados ordenados; añadir al carrito funciona y persiste en la sesión.

---

## Sprint 11 — Farmacias y mapa

**Objetivo:** localizar farmacias y ver su detalle.

**Tareas:**
- `PharmaciesPage`: listado filtrable por CP.
- `PharmacyMap` con **Leaflet + OpenStreetMap** (marcadores por `lat/lng`).
- `PharmacyDetailModal`: dirección, teléfono, productos disponibles, acción "Ver stock".
- Sincronizar selección lista ↔ mapa.

**API usada:** `GET /api/pharmacies`, `GET /api/pharmacies/:id`.

**Criterio de hecho:** el mapa muestra marcadores; al pulsar una farmacia se ve su detalle.

---

## Sprint 12 — Carrito y reservas

**Objetivo:** completar el flujo ROPO (reservar y recoger en tienda).

**Tareas:**
- `CartPage`: líneas, cantidades, total estimado, aviso **"expira en 30 min"** (o el TTL decidido).
- Confirmar reserva → `POST /api/reservations/groups`; vaciar carrito; redirigir.
- `ReservationsPage`: tarjetas con estado (ACTIVA / RECOGIDA / EXPIRADA), cuenta atrás y cancelar.
- Cancelar → `POST /api/reservations/groups/:id/cancel`.
- Manejo de error de stock insuficiente (409).

**API usada:** reservas (grupos, cancel, pickup).

**Criterio de hecho:** se puede reservar, ver la cuenta atrás y cancelar; el estado se actualiza sin recargar.

---

## Sprint 13 — Panel de farmacia

**Objetivo:** que la farmacia gestione stock y vea actividad en vivo.

**Tareas:**
- `InventoryPage`: tabla producto | EAN | stock | precio | acciones; alta/edición vía `PUT /api/inventory`.
- Resaltado de **stock bajo**.
- `LivePage`: consumo de `GET /api/events/pharmacy` (SSE) y log de eventos.
- `ProtectedRoute` para rol `PHARMACY`.

**API usada:** `GET/PUT /api/inventory`, `GET /api/events/pharmacy`.

**Criterio de hecho:** editar stock/precio se refleja al instante; los eventos aparecen en vivo.

---

## Sprint 14 — Admin, QA y despliegue

**Objetivo:** moderación de farmacias y puesta en producción.

**Tareas:**
- `AdminPharmaciesPage`: listado y acciones (según decisión PENDING/APPROVED).
- QA manual de los 5 flujos; responsive y accesibilidad básica.
- Manejo global de errores y estados de carga.
- Build de producción y deploy en **Vercel**; configurar `VITE_API_URL` y CORS del backend.
- Documentar los flujos en `docs/`.

**API usada:** `GET/POST/PATCH /api/pharmacies` (rol ADMIN).

**Criterio de hecho:** build sin errores; app desplegada; los flujos principales funcionan en producción.

---

## Convenciones transversales

- **Cliente API único** (`lib/api.ts`): un solo sitio para token, base URL y errores.
- **Estados explícitos** en cada vista: `loading`, `error`, `empty`, `data`.
- **Rutas protegidas** por rol, no solo por sesión.
- **Tipos compartidos** en `packages/shared` cuando se repitan entre API y web.
- **Componentes pequeños** y reutilizables; lógica de datos en contextos/hooks.
- **Nombres de rama:** `feature/web-auth`, `feature/web-search`, etc.

## Dependencias entre sprints

```
Sprint 9 (auth) ─▶ Sprint 10 (búsqueda) ─▶ Sprint 12 (reservas)
                        └─▶ Sprint 11 (mapa) ─┘
Sprint 13 (panel farmacia) depende de Sprint 3 (inventario) + Sprint 6 (SSE)
Sprint 14 (admin/deploy) al final
```

## Definition of Done (cada sprint)

- Build y lint sin errores.
- Flujo principal probado a mano.
- Manejo de carga, vacío y error.
- Responsive básico.
- Commit en inglés y merge a `develop`.
