-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PapelCodigo" AS ENUM ('GERENTE_PORTFOLIO');
CREATE TYPE "ProjetoStatus" AS ENUM ('conceito', 'aprovado', 'execucao', 'encerrado', 'sustentacao', 'morto', 'hold');
CREATE TYPE "BeneficioCategoria" AS ENUM ('hard', 'soft', 'avoidance', 'estrategico');
CREATE TYPE "BeneficioStatus" AS ENUM ('planejado', 'em_captura', 'incorporado', 'cancelado');
CREATE TYPE "MedicaoStatus" AS ENUM ('rascunho', 'pendente_validacao', 'validada', 'rejeitada', 'estornada', 'arquivada');
CREATE TYPE "GateTipo" AS ENUM ('G1', 'G2', 'G3', 'G4', 'G5');
CREATE TYPE "GateDecisaoTipo" AS ENUM ('go', 'kill', 'hold', 'recycle');
CREATE TYPE "ValidacaoDecisao" AS ENUM ('aprovada', 'rejeitada');
CREATE TYPE "OrigemCusto" AS ENUM ('erp_import', 'manual');

CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "papeis" (
    "id" TEXT NOT NULL,
    "codigo" "PapelCodigo" NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "papeis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "papel_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "papel_id" TEXT NOT NULL,
    CONSTRAINT "papel_usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "centros_custo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projetos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "sponsor_id" TEXT NOT NULL,
    "pm_id" TEXT NOT NULL,
    "status" "ProjetoStatus" NOT NULL DEFAULT 'conceito',
    "investimento_aprovado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inicio_previsto" DATE,
    "fim_previsto" DATE,
    "premissas_ok_financas" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_cases" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "investimento" DECIMAL(18,2) NOT NULL,
    "prazo_meses" INTEGER NOT NULL,
    "submetido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "beneficios" (
    "id" TEXT NOT NULL,
    "business_case_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "BeneficioCategoria" NOT NULL,
    "centro_custo_id" TEXT,
    "valor_mensal_esperado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "escala_estrategica" INTEGER,
    "inicio_captura" DATE,
    "janela_meses" INTEGER NOT NULL DEFAULT 12,
    "benefit_owner_id" TEXT NOT NULL,
    "status" "BeneficioStatus" NOT NULL DEFAULT 'planejado',
    "captura_pausada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "beneficios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "baselines" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "valor_total_baseline" DECIMAL(18,2) NOT NULL,
    "perfil_mensal" JSONB NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "taxa_cambio_congelada" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "congelada_em" TIMESTAMP(3),
    "aprovada_por_id" TEXT,
    "versao" INTEGER NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "baselines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medicoes" (
    "id" TEXT NOT NULL,
    "beneficio_id" TEXT NOT NULL,
    "periodo_referencia" DATE NOT NULL,
    "valor_realizado" DECIMAL(18,2) NOT NULL,
    "status" "MedicaoStatus" NOT NULL DEFAULT 'rascunho',
    "medicao_ajuste_id" TEXT,
    "registrada_por_id" TEXT NOT NULL,
    "registrada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "medicoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validacoes" (
    "id" TEXT NOT NULL,
    "medicao_id" TEXT NOT NULL,
    "validada_por_id" TEXT NOT NULL,
    "decisao" "ValidacaoDecisao" NOT NULL,
    "comentario" TEXT,
    "validada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "validacoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidencias" (
    "id" TEXT NOT NULL,
    "medicao_id" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gate_decisoes" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "gate" "GateTipo" NOT NULL,
    "decisao" "GateDecisaoTipo" NOT NULL,
    "decidida_por_id" TEXT NOT NULL,
    "decidida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,
    "ata_url" TEXT,
    CONSTRAINT "gate_decisoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "custos_realizados" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "centro_custo_id" TEXT,
    "periodo_referencia" DATE NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "origem" "OrigemCusto" NOT NULL DEFAULT 'manual',
    "importado_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custos_realizados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historico_responsaveis" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT,
    "beneficio_id" TEXT,
    "tipo" TEXT NOT NULL,
    "anterior_id" TEXT NOT NULL,
    "novo_id" TEXT NOT NULL,
    "alterado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    CONSTRAINT "historico_responsaveis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "periodos_fechados" (
    "id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "publicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_por_id" TEXT NOT NULL,
    CONSTRAINT "periodos_fechados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "config_vmo" (
    "id" TEXT NOT NULL,
    "janela_savings_padrao" INTEGER NOT NULL DEFAULT 12,
    "limiar_lean_investimento" DECIMAL(18,2) NOT NULL DEFAULT 50000,
    "pesos_scoring" JSONB NOT NULL DEFAULT '{"alinhamento":0.25,"roi":0.25,"risco":0.20,"urgencia":0.15,"capacidade":0.15}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "config_vmo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "usuario_id" TEXT,
    "valor_anterior" JSONB,
    "valor_novo" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "papeis_codigo_key" ON "papeis"("codigo");
CREATE UNIQUE INDEX "papel_usuario_usuario_id_papel_id_key" ON "papel_usuario"("usuario_id", "papel_id");
CREATE UNIQUE INDEX "areas_nome_key" ON "areas"("nome");
CREATE UNIQUE INDEX "centros_custo_codigo_key" ON "centros_custo"("codigo");
CREATE UNIQUE INDEX "business_cases_projeto_id_key" ON "business_cases"("projeto_id");
CREATE UNIQUE INDEX "baselines_beneficio_id_versao_key" ON "baselines"("beneficio_id", "versao");
CREATE UNIQUE INDEX "medicoes_beneficio_id_periodo_referencia_key" ON "medicoes"("beneficio_id", "periodo_referencia");
CREATE UNIQUE INDEX "validacoes_medicao_id_key" ON "validacoes"("medicao_id");
CREATE UNIQUE INDEX "periodos_fechados_periodo_key" ON "periodos_fechados"("periodo");
CREATE INDEX "auditoria_entidade_entidade_id_idx" ON "auditoria"("entidade", "entidade_id");
CREATE INDEX "auditoria_created_at_idx" ON "auditoria"("created_at");

ALTER TABLE "papel_usuario" ADD CONSTRAINT "papel_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "papel_usuario" ADD CONSTRAINT "papel_usuario_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papeis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_pm_id_fkey" FOREIGN KEY ("pm_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_cases" ADD CONSTRAINT "business_cases_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "beneficios" ADD CONSTRAINT "beneficios_business_case_id_fkey" FOREIGN KEY ("business_case_id") REFERENCES "business_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "beneficios" ADD CONSTRAINT "beneficios_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "beneficios" ADD CONSTRAINT "beneficios_benefit_owner_id_fkey" FOREIGN KEY ("benefit_owner_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_aprovada_por_id_fkey" FOREIGN KEY ("aprovada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medicoes" ADD CONSTRAINT "medicoes_medicao_ajuste_id_fkey" FOREIGN KEY ("medicao_ajuste_id") REFERENCES "medicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "validacoes" ADD CONSTRAINT "validacoes_medicao_id_fkey" FOREIGN KEY ("medicao_id") REFERENCES "medicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validacoes" ADD CONSTRAINT "validacoes_validada_por_id_fkey" FOREIGN KEY ("validada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_medicao_id_fkey" FOREIGN KEY ("medicao_id") REFERENCES "medicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gate_decisoes" ADD CONSTRAINT "gate_decisoes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gate_decisoes" ADD CONSTRAINT "gate_decisoes_decidida_por_id_fkey" FOREIGN KEY ("decidida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "custos_realizados" ADD CONSTRAINT "custos_realizados_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "custos_realizados" ADD CONSTRAINT "custos_realizados_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "custos_realizados" ADD CONSTRAINT "custos_realizados_importado_por_id_fkey" FOREIGN KEY ("importado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historico_responsaveis" ADD CONSTRAINT "historico_responsaveis_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "historico_responsaveis" ADD CONSTRAINT "historico_responsaveis_beneficio_id_fkey" FOREIGN KEY ("beneficio_id") REFERENCES "beneficios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "historico_responsaveis" ADD CONSTRAINT "historico_responsaveis_anterior_id_fkey" FOREIGN KEY ("anterior_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historico_responsaveis" ADD CONSTRAINT "historico_responsaveis_novo_id_fkey" FOREIGN KEY ("novo_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
