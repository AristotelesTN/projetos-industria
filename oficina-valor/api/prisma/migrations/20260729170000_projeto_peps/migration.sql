-- Elementos PEP (WBS) do SAP vinculados aos projetos
CREATE TABLE "projeto_peps" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "codigo_pep" TEXT NOT NULL,
    "carteira" TEXT NOT NULL,
    "descricao" TEXT,
    "orcamento" DECIMAL(18,2) NOT NULL,
    "disposto" DECIMAL(18,2) NOT NULL,
    "real" DECIMAL(18,2) NOT NULL,
    "comprometido" DECIMAL(18,2) NOT NULL,
    "disponivel" DECIMAL(18,2) NOT NULL,
    "importado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projeto_peps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projeto_peps_codigo_pep_key" ON "projeto_peps"("codigo_pep");
CREATE INDEX "projeto_peps_projeto_id_idx" ON "projeto_peps"("projeto_id");
ALTER TABLE "projeto_peps" ADD CONSTRAINT "projeto_peps_projeto_id_fkey"
    FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
