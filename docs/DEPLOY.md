# Guía de despliegue — Stock for PYMEs

## Arquitectura actual

```text
Cliente web (pendiente) -> API en Render -> PostgreSQL en Render
```

Este repositorio todavía no contiene el frontend. Por ello, este sprint prepara
el backend y la base de datos; el despliegue en Vercel queda para cuando exista
`apps/web`.

## 1. Preparar el repositorio

El Blueprint de Render está en `render.yaml`. Antes de desplegar, el código de
esta rama debe estar disponible en el repositorio remoto que se conecte a
Render.

No se deben subir archivos `.env`: Render genera `JWT_SECRET` y enlaza
`DATABASE_URL` automáticamente con la base de datos declarada en el Blueprint.

## 2. Crear API y PostgreSQL en Render

1. Entrar en [Render](https://render.com) e iniciar sesión con GitHub.
2. Seleccionar **New > Blueprint** y elegir el repositorio.
3. Elegir la rama que contiene `render.yaml`.
4. Render creará `stock-for-pymes-db` y `stock-for-pymes-api`.
5. En el servicio web, establecer `CORS_ORIGIN` con la URL final del frontend,
   sin barra final. Mientras no haya frontend puede usarse temporalmente
   `http://localhost:5173`.
6. Ejecutar **Manual Deploy > Deploy latest commit**.

En el arranque del contenedor se ejecuta `prisma migrate deploy`; si una
migración falla, la API no se inicia y el error aparece en los logs de Render.

## 3. Variables de entorno de producción

| Variable | Origen o valor | Nota |
| --- | --- | --- |
| `DATABASE_URL` | Base de datos de Render | Configurada por el Blueprint |
| `JWT_SECRET` | Generada por Render | No sustituir por una clave de desarrollo |
| `JWT_EXPIRES_IN` | `8h` | Duración del token |
| `API_PORT` | `3000` | Puerto expuesto por el contenedor |
| `API_HOST` | `0.0.0.0` | Requerido para aceptar tráfico externo |
| `NODE_ENV` | `production` | Evita cargar el archivo `.env` local |
| `CORS_ORIGIN` | URL del frontend | Se configura manualmente |

## 4. Comprobaciones tras desplegar

Sustituir `<api-url>` por la URL asignada por Render:

```bash
curl https://<api-url>/api/health
```

La respuesta esperada es:

```json
{ "status": "ok", "service": "api" }
```

Después, desde la consola de Render, ejecutar el seed una sola vez si se
necesitan datos de demostración:

```bash
npx tsx apps/api/prisma/seed.ts
```

## 5. Validación local de la imagen

Construir la imagen desde la raíz del repositorio:

```bash
docker build -f apps/api/Dockerfile -t stock-for-pymes-api .
```

Con PostgreSQL local levantado, en Docker Desktop se puede iniciar la imagen
usando `host.docker.internal` en lugar de `localhost` dentro de `DATABASE_URL`:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://stock:stock_dev_password@host.docker.internal:5432/stock_for_pymes?schema=public" \
  -e JWT_SECRET="local-test-secret-at-least-16-chars" \
  -e JWT_EXPIRES_IN="8h" \
  -e API_HOST="0.0.0.0" \
  -e API_PORT="3000" \
  -e NODE_ENV="production" \
  -e CORS_ORIGIN="http://localhost:5173" \
  stock-for-pymes-api
```

En otra terminal:

```bash
curl http://localhost:3000/api/health
```

## 6. Pendiente al integrar Sprint 6

- Probar el endpoint SSE a través de Render.
- Confirmar que la conexión SSE no queda bloqueada por el proxy.
- Añadir una comprobación del flujo de eventos a la validación final.
