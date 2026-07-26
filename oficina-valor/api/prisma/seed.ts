import {
  BeneficioCategoria,
  GateDecisaoTipo,
  GateTipo,
  MedicaoStatus,
  PapelCodigo,
  PrismaClient,
  ProjetoStatus,
} from '@prisma/client';
import { buildPerfilMensal, monthStart, addMonths } from '../src/common/dates';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.projeto.count();
  if (existing >= 10) {
    console.log('Seed já aplicado (%d projetos)', existing);
    return;
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

  const portfolio = await prisma.portfolio.create({
    data: { nome: 'Portfólio Manufatura 2026' },
  });

  const areas = ['Produção', 'Manutenção', 'Supply Chain', 'TI', 'Qualidade'];
  const areaIds: Record<string, string> = {};
  for (const nome of areas) {
    const a = await prisma.area.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    areaIds[nome] = a.id;
  }

  const projetosSeed = [
    { nome: 'Redução de Scrap Linha A', area: 'Produção', hard: 25000, soft: 5000 },
    { nome: 'OEE Prensa 2', area: 'Produção', hard: 18000, soft: 4000 },
    { nome: 'Contrato Energia 2026', area: 'Manutenção', hard: 40000, soft: 0 },
    { nome: 'TMS Frete Nacional', area: 'Supply Chain', hard: 22000, soft: 8000 },
    { nome: 'WMS Slotting', area: 'Supply Chain', hard: 15000, soft: 6000 },
    { nome: 'Automação NFe', area: 'TI', hard: 9000, soft: 3000 },
    { nome: 'MES Alertas Qualidade', area: 'Qualidade', hard: 12000, soft: 7000 },
    { nome: 'TPM Fase 1', area: 'Manutenção', hard: 10000, soft: 9000 },
    { nome: 'Redução Retrabalho Pintura', area: 'Produção', hard: 16000, soft: 2000 },
    { nome: 'Portal Fornecedores', area: 'Supply Chain', hard: 11000, soft: 5000 },
  ];

  const inicio = monthStart('2026-01-01');

  for (const [idx, p] of projetosSeed.entries()) {
    const cc = await prisma.centroCusto.upsert({
      where: { codigo: `CC-${1000 + idx}` },
      update: {},
      create: { codigo: `CC-${1000 + idx}`, nome: `Centro ${p.nome}` },
    });

    const projeto = await prisma.projeto.create({
      data: {
        nome: p.nome,
        portfolioId: portfolio.id,
        areaId: areaIds[p.area],
        sponsorId: gerente.id,
        pmId: gerente.id,
        status: ProjetoStatus.execucao,
        investimentoAprovado: p.hard * 8,
        inicioPrevisto: inicio,
        fimPrevisto: addMonths(inicio, 12),
        premissasOkFinancas: true,
        wizardBaselineCompleto: true,
        businessCase: {
          create: {
            problema: `Problema de valor: ${p.nome}`,
            investimento: p.hard * 8,
            prazoMeses: 12,
            submetido: true,
          },
        },
      },
      include: { businessCase: true },
    });

    const hard = await prisma.beneficio.create({
      data: {
        businessCaseId: projeto.businessCase!.id,
        nome: `Hard — ${p.nome}`,
        categoria: BeneficioCategoria.hard,
        centroCustoId: cc.id,
        valorMensalEsperado: p.hard,
        inicioCaptura: inicio,
        janelaMeses: 12,
        benefitOwnerId: gerente.id,
        status: 'em_captura',
      },
    });
    await prisma.baseline.create({
      data: {
        beneficioId: hard.id,
        valorTotalBaseline: p.hard * 12,
        perfilMensal: buildPerfilMensal(inicio, 12, p.hard),
        versao: 1,
        vigente: true,
        congeladaEm: new Date('2026-01-15'),
        aprovadaPorId: gerente.id,
      },
    });

    if (p.soft > 0) {
      const soft = await prisma.beneficio.create({
        data: {
          businessCaseId: projeto.businessCase!.id,
          nome: `Soft — ${p.nome}`,
          categoria: BeneficioCategoria.soft,
          valorMensalEsperado: p.soft,
          inicioCaptura: inicio,
          janelaMeses: 12,
          benefitOwnerId: gerente.id,
          status: 'em_captura',
        },
      });
      await prisma.baseline.create({
        data: {
          beneficioId: soft.id,
          valorTotalBaseline: p.soft * 12,
          perfilMensal: buildPerfilMensal(inicio, 12, p.soft),
          versao: 1,
          vigente: true,
          congeladaEm: new Date('2026-01-15'),
          aprovadaPorId: gerente.id,
        },
      });
    }

    await prisma.gateDecisao.create({
      data: {
        projetoId: projeto.id,
        gate: GateTipo.G2,
        decisao: GateDecisaoTipo.go,
        decididaPorId: gerente.id,
        comentario: 'Aprovado no seed',
      },
    });

    for (let m = 0; m < 3; m++) {
      const periodo = addMonths(inicio, m);
      const med = await prisma.medicao.create({
        data: {
          beneficioId: hard.id,
          periodoReferencia: periodo,
          valorRealizado: p.hard * (0.85 + m * 0.05),
          status: MedicaoStatus.validada,
          registradaPorId: gerente.id,
          comentario: 'Seed ciclo mensal',
        },
      });
      await prisma.evidencia.create({
        data: {
          medicaoId: med.id,
          nomeArquivo: `evidencia-${idx}-${m}.pdf`,
          caminho: `/uploads/seed-${idx}-${m}.pdf`,
          versao: 1,
          mimeType: 'application/pdf',
        },
      });
      await prisma.validacao.create({
        data: {
          medicaoId: med.id,
          validadaPorId: gerente.id,
          decisao: 'aprovada',
          comentario: 'Homologado pelo gerente de portfólio',
        },
      });
    }

    const pend = await prisma.medicao.create({
      data: {
        beneficioId: hard.id,
        periodoReferencia: addMonths(inicio, 3),
        valorRealizado: p.hard,
        status: MedicaoStatus.pendente_validacao,
        registradaPorId: gerente.id,
      },
    });
    await prisma.evidencia.create({
      data: {
        medicaoId: pend.id,
        nomeArquivo: `pendente-${idx}.pdf`,
        caminho: `/uploads/pend-${idx}.pdf`,
        versao: 1,
      },
    });

    await prisma.custoRealizado.create({
      data: {
        projetoId: projeto.id,
        centroCustoId: cc.id,
        periodoReferencia: inicio,
        valor: p.hard * 2,
        origem: 'manual',
        importadoPorId: gerente.id,
      },
    });
  }

  console.log('Seed OK: 10 projetos · usuário gerente@oficina.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
