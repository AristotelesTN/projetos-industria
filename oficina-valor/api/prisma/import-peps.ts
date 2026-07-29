/**
 * Importa PEPs do SAP (pep-sap.csv) → tabela projeto_peps.
 * Match por nome (fuzzy): vincula ao projeto existente.
 * Sem match: cria projeto novo em status conceito.
 *
 * Uso: ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' prisma/import-peps.ts
 */
import { PrismaClient, ProjetoStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestMatch(
  pepDesc: string,
  projetos: { id: string; nome: string }[],
): { id: string; nome: string; score: number } | null {
  const STOP = new Set([
    'fase',
    'para',
    'com',
    'dos',
    'das',
    'projeto',
    'sistema',
    'sist',
    'gerenc',
    'digital',
    'usando',
    'novo',
    'novos',
  ]);
  const pepNorm = normalize(pepDesc);
  if (pepNorm.length < 4) return null;
  const pepTokens = pepNorm
    .split(' ')
    .filter((t) => t.length > 2 && !STOP.has(t));

  let best: { id: string; nome: string; score: number } | null = null;

  for (const p of projetos) {
    const pNorm = normalize(p.nome);
    let score = 0;

    // Best: project name starts with truncated SAP description
    if (pNorm.startsWith(pepNorm) || (pNorm.length >= 8 && pepNorm.startsWith(pNorm))) {
      score = 1.0;
    } else if (
      pepNorm.length >= 10 &&
      (pNorm.includes(pepNorm) || pepNorm.includes(pNorm))
    ) {
      score = 0.92;
    } else if (pepTokens.length >= 2) {
      const pTokens = pNorm
        .split(' ')
        .filter((t) => t.length > 2 && !STOP.has(t));
      const common = pepTokens.filter((t) => pTokens.includes(t));
      if (common.length >= 2) {
        score = Math.min(0.85, common.length / pepTokens.length);
      }
    }

    if (score >= 0.7 && (!best || score > best.score)) {
      best = { id: p.id, nome: p.nome, score };
    }
  }
  return best;
}

interface CsvRow {
  carteira: string;
  pep: string;
  descricao: string;
  orcamento: number;
  disposto: number;
  real: number;
  comprometido: number;
  disponivel: number;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (vals[i] || '').trim()));
    return {
      carteira: row.carteira,
      pep: row.pep,
      descricao: row.descricao,
      orcamento: Number(row.orcamento) || 0,
      disposto: Number(row.disposto) || 0,
      real: Number(row.real) || 0,
      comprometido: Number(row.comprometido) || 0,
      disponivel: Number(row.disponivel) || 0,
    };
  });
}

const CARTEIRA_ANO: Record<string, string> = {
  '3102-22-19': '2022',
  '3102-23-19': '2023',
  '3102-24-19': '2024',
  '3102-25-19': '2025',
  '3102-26-19': '2026',
};

async function main() {
  const csvPath = path.resolve(__dirname, 'data/pep-sap.csv');
  const rows = parseCsv(csvPath);
  console.log(`Lidas ${rows.length} linhas do CSV`);

  // Reimport limpo: remove PEPs e projetos criados só pelo SAP
  const deletedPeps = await prisma.projetoPep.deleteMany();
  const deletedProj = await prisma.projeto.deleteMany({
    where: { fonteImportacao: 'pep_sap' },
  });
  console.log(
    `Limpeza: ${deletedPeps.count} PEPs e ${deletedProj.count} projetos pep_sap removidos`,
  );

  const projetos = await prisma.projeto.findMany({
    where: { NOT: { fonteImportacao: 'pep_sap' } },
    select: { id: true, nome: true },
  });
  console.log(`${projetos.length} projetos candidatos a match`);

  // Default IDs for creating new projects
  const defaultArea = await prisma.area.findFirst();
  const defaultPortfolio = await prisma.portfolio.findFirst();
  const defaultUser = await prisma.usuario.findFirst();
  if (!defaultArea || !defaultPortfolio || !defaultUser) {
    throw new Error('Precisa de ao menos 1 area, portfolio e usuario no banco');
  }

  let matched = 0;
  let created = 0;
  let skipped = 0;
  const matchLog: string[] = [];
  const noMatch: string[] = [];

  for (const row of rows) {
    // Skip if PEP already imported
    const existing = await prisma.projetoPep.findUnique({
      where: { codigoPep: row.pep },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const match = bestMatch(row.descricao, projetos);
    let projetoId: string;

    if (match) {
      projetoId = match.id;
      matched += 1;
      matchLog.push(
        `  ✓ PEP ${row.pep} "${row.descricao}" → "${match.nome}" (score ${match.score.toFixed(2)})`,
      );
    } else {
      const ano = CARTEIRA_ANO[row.carteira] || '';
      const nome = `${row.descricao}${ano ? ` (PEP ${ano})` : ''}`;
      const novo = await prisma.projeto.create({
        data: {
          nome,
          portfolioId: defaultPortfolio.id,
          areaId: defaultArea.id,
          sponsorId: defaultUser.id,
          pmId: defaultUser.id,
          status: ProjetoStatus.conceito,
          fonteImportacao: 'pep_sap',
          codigoExterno: row.pep,
        },
      });
      projetoId = novo.id;
      created += 1;
      noMatch.push(
        `  + PEP ${row.pep} "${row.descricao}" → NOVO projeto "${nome}"`,
      );
    }

    await prisma.projetoPep.create({
      data: {
        projetoId,
        codigoPep: row.pep,
        carteira: row.carteira,
        descricao: row.descricao,
        orcamento: row.orcamento,
        disposto: row.disposto,
        real: row.real,
        comprometido: row.comprometido,
        disponivel: row.disponivel,
      },
    });
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Matched: ${matched}`);
  console.log(`Criados: ${created}`);
  console.log(`Já existiam: ${skipped}`);
  if (matchLog.length) {
    console.log(`\nMatches:`);
    matchLog.forEach((l) => console.log(l));
  }
  if (noMatch.length) {
    console.log(`\nSem match (projetos criados):`);
    noMatch.forEach((l) => console.log(l));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
