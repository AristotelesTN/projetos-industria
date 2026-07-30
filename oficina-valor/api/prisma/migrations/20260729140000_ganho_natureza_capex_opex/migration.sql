-- Timestamp de aplicação da transformação CAPEX → OPEX pós-implementação
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "capex_para_opex_aplicado_em" TIMESTAMP(3);
