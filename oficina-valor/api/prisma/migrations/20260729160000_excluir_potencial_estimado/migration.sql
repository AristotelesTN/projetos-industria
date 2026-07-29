-- Excluir projetos suspensos/cancelados do potencial estimado
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "excluir_do_potencial_estimado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "projetos"
SET "excluir_do_potencial_estimado" = true
WHERE "status" IN ('hold', 'morto');
