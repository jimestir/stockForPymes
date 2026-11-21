FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/

RUN npm ci --workspace=@stock-pymes/api

COPY apps/api apps/api

RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @stock-pymes/api

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/

# Prisma CLI is required at runtime to apply committed migrations before startup.
RUN npm ci --workspace=@stock-pymes/api && npm cache clean --force

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma node_modules/@prisma

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:deploy -w @stock-pymes/api && node apps/api/dist/index.js"]
