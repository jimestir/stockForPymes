-- Enable trigram matching for case-insensitive 'contains' queries (ILIKE '%texto%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
