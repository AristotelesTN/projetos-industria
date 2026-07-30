-- Campos da planilha Planejamento Estruturado (dados reais)
DO $$ BEGIN
  CREATE TYPE "TipoProjetoInvestimento" AS ENUM ('capex', 'opex', 'demanda');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SemaforoRag" AS ENUM ('ok', 'nok');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassificacaoProjeto" AS ENUM ('inovacao', 'melhoria');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "inicio_real" DATE;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "fim_real" DATE;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "fonte_importacao" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "codigo_externo" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "tipo_investimento" "TipoProjetoInvestimento";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "facilitador" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "responsavel_nome" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "fornecedor" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "setor" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "diretoria" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "classificacao" "ClassificacaoProjeto";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "em_uso" BOOLEAN;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "rag_comunicacao" "SemaforoRag";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "rag_custo" "SemaforoRag";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "rag_prazo" "SemaforoRag";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "rag_escopo" "SemaforoRag";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "ganho_quantitativo_texto" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "economia_estimada_ano" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "economia_real_ano" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "hh_engenheiro" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "hh_lider" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "hh_analista" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "retorno_hh_ano" DECIMAL(18,2);

CREATE INDEX IF NOT EXISTS "projetos_fonte_importacao_idx" ON "projetos"("fonte_importacao");
CREATE INDEX IF NOT EXISTS "projetos_status_idx" ON "projetos"("status");
