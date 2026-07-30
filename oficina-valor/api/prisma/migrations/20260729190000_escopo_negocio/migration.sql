-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EscopoNegocio" AS ENUM ('comercial', 'industrial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "projetos"
  ADD COLUMN IF NOT EXISTS "escopo_negocio" "EscopoNegocio" NOT NULL DEFAULT 'industrial';

-- Backfill comercial a partir de diretoria / setor / área
UPDATE "projetos" p
SET "escopo_negocio" = 'comercial'
FROM "areas" a
WHERE a.id = p.area_id
  AND (
    lower(coalesce(p.diretoria, '')) = 'comercial'
    OR lower(coalesce(p.setor, '')) = 'comercial'
    OR lower(coalesce(a.nome, '')) = 'comercial'
  );

UPDATE "projetos"
SET "escopo_negocio" = 'industrial'
WHERE "escopo_negocio" IS NULL OR "escopo_negocio" <> 'comercial';
