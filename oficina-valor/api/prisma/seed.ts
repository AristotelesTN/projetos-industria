/**
 * Seed: usuário gerente + importação da planilha Planejamento Estruturado.
 * Remove dados mockados e carrega os projetos reais.
 */
import {
  ClassificacaoProjeto,
  GanhoPrincipalTipo,
  PapelCodigo,
  PapelEstrategicoFapd,
  PrismaClient,
  ProjetoStatus,
  SemaforoRag,
  TipoProjetoInvestimento,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const FONTE = 'planejamento_estruturado';

function cell(row: ExcelJS.Row, idx: number): unknown {
  const v = row.getCell(idx).value;
  if (v && typeof v === 'object' && 'result' in (v as object)) {
    return (v as { result?: unknown }).result;
  }
  if (v && typeof v === 'object' && 'text' in (v as object)) {
    return (v as { text?: unknown }).text;
  }
  if (v && typeof v === 'object' && 'richText' in (v as object)) {
    return ((v as { richText: Array<{ text: string }> }).richText || [])
      .map((t) => t.text)
      .join('');
  }
  return v;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseMoney(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/R\$\s?/gi, '').replace(/\s/g, '');
  // 1.600.000,00 or 1,600,000.00
  if (/,\d{2}$/.test(s) && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/,\d{2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === 'number') {
    // Excel serial
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v).trim();
  // "June 3, 2022"
  const m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon != null) {
      return new Date(Date.UTC(Number(m[3]), mon, Number(m[2])));
    }
  }
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) {
    const d = new Date(iso);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return null;
}

function mapStatus(raw: string | null): ProjetoStatus {
  const s = (raw || '').toLowerCase();
  if (s.includes('conclu')) return ProjetoStatus.encerrado;
  if (s.includes('suspens')) return ProjetoStatus.hold;
  if (s.includes('andamento')) return ProjetoStatus.execucao;
  if (s.includes('iniciar')) return ProjetoStatus.conceito;
  return ProjetoStatus.conceito;
}

function mapTipo(raw: string | null): TipoProjetoInvestimento | null {
  const s = (raw || '').trim().toUpperCase();
  if (s === 'CAPEX') return TipoProjetoInvestimento.capex;
  if (s === 'OPEX') return TipoProjetoInvestimento.opex;
  if (s === 'DEMANDA') return TipoProjetoInvestimento.demanda;
  return null;
}

function mapSemaforo(raw: string | null): SemaforoRag | null {
  const s = (raw || '').trim().toUpperCase();
  if (s === 'OK') return SemaforoRag.ok;
  if (s === 'NOK') return SemaforoRag.nok;
  return null;
}

function mapClassificacao(raw: string | null): ClassificacaoProjeto | null {
  const s = (raw || '').trim().toLowerCase();
  if (s.startsWith('inova')) return ClassificacaoProjeto.inovacao;
  if (s.startsWith('melhor')) return ClassificacaoProjeto.melhoria;
  return null;
}

function mapEmUso(raw: string | null): boolean | null {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'sim' || s === 'yes' || s === 'true') return true;
  if (s === 'não' || s === 'nao' || s === 'no' || s === 'false') return false;
  return null;
}

function mapPapel(portfolioNome: string): PapelEstrategicoFapd | null {
  const s = portfolioNome.toLowerCase();
  if (s.includes('estrutur')) return PapelEstrategicoFapd.estruturante;
  if (s.includes('ganho')) return PapelEstrategicoFapd.gerador;
  return null;
}

function slugEmail(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40);
  return `${base || 'user'}@oficina.local`;
}

async function wipeProjetos() {
  // Ordem respeitando FKs (sem onDelete Cascade na maioria).
  await prisma.validacao.deleteMany();
  await prisma.evidencia.deleteMany();
  await prisma.medicao.deleteMany();
  await prisma.baseline.deleteMany();
  await prisma.historicoResponsavel.deleteMany();
  await prisma.beneficio.deleteMany();
  await prisma.businessCase.deleteMany();
  await prisma.gateDecisao.deleteMany();
  await prisma.custoRealizado.deleteMany();
  await prisma.wizardSessao.deleteMany();
  await prisma.agentRecommendation.deleteMany();
  await prisma.agentActivity.deleteMany();
  await prisma.demanda.updateMany({ data: { projetoId: null } });
  await prisma.projeto.deleteMany();
  console.log('Projetos mockados / anteriores removidos');
}

async function ensureUsuario(nome: string, fallbackId?: string) {
  if (!nome.trim() && fallbackId) {
    return fallbackId;
  }
  const email = slugEmail(nome.trim() || 'Sem Responsavel');
  const u = await prisma.usuario.upsert({
    where: { email },
    update: { nome: nome.trim() || 'Sem Responsável', ativo: true },
    create: {
      email,
      nome: nome.trim() || 'Sem Responsável',
    },
  });
  return u.id;
}

async function main() {
  const xlsxPath = path.join(
    __dirname,
    'data',
    'Planejamento_Estruturado.xlsx',
  );
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Planilha não encontrada: ${xlsxPath}`);
  }

  const papel = await prisma.papel.upsert({
    where: { codigo: PapelCodigo.GERENTE_PORTFOLIO },
    update: { nome: 'Gerente de Portfólio' },
    create: {
      codigo: PapelCodigo.GERENTE_PORTFOLIO,
      nome: 'Gerente de Portfólio',
    },
  });

  const gerente = await prisma.usuario.upsert({
    where: { email: 'gerente@oficina.local' },
    update: { nome: 'Gerente de Portfólio', ativo: true },
    create: {
      email: 'gerente@oficina.local',
      nome: 'Gerente de Portfólio',
    },
  });

  await prisma.papelUsuario.upsert({
    where: {
      usuarioId_papelId: { usuarioId: gerente.id, papelId: papel.id },
    },
    update: {},
    create: { usuarioId: gerente.id, papelId: papel.id },
  });

  await prisma.configVmo.create({ data: {} }).catch(() => undefined);

  const imported = await prisma.projeto.count({
    where: { fonteImportacao: FONTE },
  });
  const force = process.env.FORCE_SEED_REIMPORT === '1';
  if (imported >= 100 && !force) {
    console.log(
      'Planilha já importada (%d projetos). Use FORCE_SEED_REIMPORT=1 para reimportar.',
      imported,
    );
    return;
  }

  await wipeProjetos();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws =
    wb.getWorksheet('Planejamento') ||
    wb.worksheets[0];
  if (!ws) throw new Error('Aba Planejamento não encontrada');

  const portfolioIds = new Map<string, string>();
  const areaIds = new Map<string, string>();

  async function portfolioId(nome: string) {
    const key = nome.trim() || 'Sem portfólio';
    if (portfolioIds.has(key)) return portfolioIds.get(key)!;
    const existing = await prisma.portfolio.findFirst({ where: { nome: key } });
    const p =
      existing ??
      (await prisma.portfolio.create({ data: { nome: key } }));
    portfolioIds.set(key, p.id);
    return p.id;
  }

  async function areaId(nome: string) {
    const key = nome.trim() || 'Sem área';
    if (areaIds.has(key)) return areaIds.get(key)!;
    const a = await prisma.area.upsert({
      where: { nome: key },
      update: {},
      create: { nome: key },
    });
    areaIds.set(key, a.id);
    return a.id;
  }

  let created = 0;
  let skipped = 0;

  ws.eachRow((row, rowNumber) => {
    // headers on row 1 — processed below in async loop
    void rowNumber;
    void row;
  });

  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const nome = asStr(cell(row, 1));
    if (!nome) {
      skipped += 1;
      continue;
    }

    const tipoRaw = asStr(cell(row, 2));
    const portfolioNome = asStr(cell(row, 3)) || 'Sem portfólio';
    const statusRaw = asStr(cell(row, 4));
    const facilitador = asStr(cell(row, 5));
    const investimento = parseMoney(cell(row, 6)) ?? 0;
    const inicioPrevisto = parseDate(cell(row, 7));
    const fimPrevisto = parseDate(cell(row, 8));
    const ragComunicacao = mapSemaforo(asStr(cell(row, 9)));
    const ragCusto = mapSemaforo(asStr(cell(row, 10)));
    const ragPrazo = mapSemaforo(asStr(cell(row, 11)));
    const ragEscopo = mapSemaforo(asStr(cell(row, 12)));
    const ganhoQuantitativoTexto = asStr(cell(row, 13));
    const memoriaCalculoGanho = asStr(cell(row, 14));
    const fornecedor = asStr(cell(row, 15));
    const emUso = mapEmUso(asStr(cell(row, 16)));
    const responsavelNome = asStr(cell(row, 17));
    const areaNome = asStr(cell(row, 18)) || 'Sem área';
    const economiaEstimadaAno = parseMoney(cell(row, 19));
    const economiaRealAno = parseMoney(cell(row, 20));
    const setor = asStr(cell(row, 21));
    const diretoria = asStr(cell(row, 22));
    const inicioReal = parseDate(cell(row, 23));
    const hhEngenheiro = parseNum(cell(row, 24));
    const hhLider = parseNum(cell(row, 25));
    const hhAnalista = parseNum(cell(row, 26));
    const retornoHhAno = parseNum(cell(row, 27));
    const classificacao = mapClassificacao(asStr(cell(row, 28)));
    const riscoFin = parseMoney(cell(row, 29));
    const fimReal = parseDate(cell(row, 30));

    const tipoInvestimento = mapTipo(tipoRaw);
    const status = mapStatus(statusRaw);
    const sumHh =
      (hhEngenheiro || 0) + (hhLider || 0) + (hhAnalista || 0);
    const horasEconomizadasAno =
      retornoHhAno && retornoHhAno > 0
        ? retornoHhAno
        : sumHh > 0
          ? sumHh
          : null;

    let ganhoPrincipal: GanhoPrincipalTipo | null = null;
    if ((economiaEstimadaAno ?? 0) > 0 || (economiaRealAno ?? 0) > 0) {
      ganhoPrincipal = GanhoPrincipalTipo.financeiro;
    } else if ((riscoFin ?? 0) > 0) {
      ganhoPrincipal = GanhoPrincipalTipo.risco_mitigado;
    } else if (horasEconomizadasAno) {
      ganhoPrincipal = GanhoPrincipalTipo.horas_economizadas;
    } else if (
      portfolioNome.toLowerCase().includes('estrutur') ||
      ganhoQuantitativoTexto
    ) {
      ganhoPrincipal = GanhoPrincipalTipo.qualitativo;
    }

    const ganhoFinanceiroAnual =
      economiaEstimadaAno ?? economiaRealAno ?? null;

    let investimentoCapex: number | null = null;
    let investimentoOpex: number | null = null;
    if (tipoInvestimento === TipoProjetoInvestimento.opex) {
      investimentoOpex = investimento || null;
    } else if (investimento > 0) {
      investimentoCapex = investimento;
    }

    const pmId = await ensureUsuario(
      responsavelNome || facilitador || 'Gerente de Portfólio',
      gerente.id,
    );
    const sponsorId = await ensureUsuario(
      facilitador || responsavelNome || 'Gerente de Portfólio',
      gerente.id,
    );

    const projeto = await prisma.projeto.create({
      data: {
        nome,
        portfolioId: await portfolioId(portfolioNome),
        areaId: await areaId(areaNome),
        sponsorId,
        pmId,
        status,
        investimentoAprovado: investimento,
        inicioPrevisto,
        fimPrevisto,
        inicioReal,
        fimReal,
        fonteImportacao: FONTE,
        codigoExterno: `PE-${rowNumber}`,
        tipoInvestimento,
        facilitador,
        responsavelNome,
        fornecedor,
        setor,
        diretoria,
        classificacao,
        emUso,
        ragComunicacao,
        ragCusto,
        ragPrazo,
        ragEscopo,
        ganhoQuantitativoTexto,
        economiaEstimadaAno,
        economiaRealAno,
        hhEngenheiro,
        hhLider,
        hhAnalista,
        retornoHhAno,
        memoriaCalculoGanho,
        papelEstrategico: mapPapel(portfolioNome),
        ganhoPrincipal,
        ganhoFinanceiroAnual,
        riscoFinanceiroMitigadoAnual: riscoFin,
        horasEconomizadasAno,
        ganhoRecorrente: Boolean(
          ganhoPrincipal === GanhoPrincipalTipo.financeiro ||
            ganhoPrincipal === GanhoPrincipalTipo.horas_economizadas,
        ),
        investimentoCapex,
        investimentoOpex,
        finalizadoEm:
          status === ProjetoStatus.encerrado
            ? fimReal || fimPrevisto || new Date()
            : null,
        semGanhos: portfolioNome.toLowerCase().includes('estrutur')
          ? !(economiaEstimadaAno || economiaRealAno || horasEconomizadasAno)
          : false,
        businessCase: {
          create: {
            problema:
              ganhoQuantitativoTexto ||
              memoriaCalculoGanho ||
              `Projeto importado: ${nome}`,
            investimento,
            prazoMeses: 12,
            submetido: true,
          },
        },
      },
    });

    void projeto;
    created += 1;
  }

  console.log(
    `Importação concluída: ${created} projetos da planilha (${skipped} linhas vazias)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
