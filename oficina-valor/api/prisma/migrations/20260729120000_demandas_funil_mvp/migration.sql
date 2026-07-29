-- AlterTable projetos
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "acompanhamento_pos_pendente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "finalizado_em" TIMESTAMP(3);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "justificativa_decisao" TEXT;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DemandaOrigem" AS ENUM ('interna', 'aevo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DemandaStatus" AS ENUM (
    'recebida', 'entrevista', 'ficha', 'priorizacao', 'decisao', 'aprovada', 'reprovada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "demandas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "solicitante_nome" TEXT NOT NULL,
    "area_nome" TEXT NOT NULL,
    "origem" "DemandaOrigem" NOT NULL DEFAULT 'interna',
    "id_aevo" TEXT,
    "status" "DemandaStatus" NOT NULL DEFAULT 'recebida',
    "entrevista_concluida" BOOLEAN NOT NULL DEFAULT false,
    "entrevista_dispensa_justificativa" TEXT,
    "ganhos_estimados_resumo" TEXT,
    "score_impacto" INTEGER,
    "score_alinhamento" INTEGER,
    "score_esforco" INTEGER,
    "score_risco" INTEGER,
    "score_total" DECIMAL(8,2),
    "justificativa_priorizacao" TEXT,
    "desenvolvimento_interno" BOOLEAN,
    "investimento_estimado" DECIMAL(18,2),
    "decisao_go_nogo" TEXT,
    "justificativa_decisao" TEXT,
    "projeto_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "demandas_projeto_id_key" ON "demandas"("projeto_id");
CREATE INDEX IF NOT EXISTS "demandas_status_idx" ON "demandas"("status");
CREATE INDEX IF NOT EXISTS "demandas_origem_idx" ON "demandas"("origem");

DO $$ BEGIN
  ALTER TABLE "demandas" ADD CONSTRAINT "demandas_projeto_id_fkey"
    FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
