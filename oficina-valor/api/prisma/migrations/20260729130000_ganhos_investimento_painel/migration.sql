-- Enums
DO $$ BEGIN
  CREATE TYPE "GanhoPrincipalTipo" AS ENUM (
    'qualitativo', 'horas_economizadas', 'financeiro', 'risco_mitigado', 'negocio'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CategoriaQualitativaGanho" AS ENUM (
    'estruturante', 'prover_informacoes', 'capacitacao', 'exploracao',
    'auditoria', 'obrigacao_legal', 'indefinido'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Projeto: potencial de ganhos + investimento detalhado
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "ganho_principal" "GanhoPrincipalTipo";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "ganho_qualitativo_escala" INTEGER;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "categoria_qualitativa" "CategoriaQualitativaGanho";
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "horas_economizadas_ano" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "ganho_financeiro_anual" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "risco_financeiro_mitigado_anual" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "ganho_negocio_anual" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "ganho_recorrente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "investimento_capex" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "investimento_opex" DECIMAL(18,2);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "investimento_capex_para_opex" DECIMAL(18,2);
