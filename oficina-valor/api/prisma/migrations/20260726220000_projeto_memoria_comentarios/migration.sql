-- AlterTable
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "memoria_calculo_ganho" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "comentarios" TEXT;
