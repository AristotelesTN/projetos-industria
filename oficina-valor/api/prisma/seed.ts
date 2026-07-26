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

async function upsertUser(email: string, nome: string, papel: PapelCodigo) {
  const user = await prisma.usuario.upsert({
    where: { email },
    update: { nome, ativo: true },
    create: { email, nome },
  });
  const role = await prisma.papel.upsert({
    where: { codigo: papel },
    update: {},
    create: { codigo: papel, nome: papel },
  });
  await prisma.papelUsuario.upsert({
    where: {
      usuarioId_papelId: { usuarioId: user.id, papelId: role.id },
    },
    update: {},
    create: { usuarioId: user.id, papelId: role.id },
  });
  return user;
}

async function main() {
  const existing = await prisma.projeto.count();
  if (existing >= 10) {
    console.log('Seed já aplicado (%d projetos)', existing);
    return;
  }

  for (const p of Object.values(PapelCodigo)) {
    await prisma.papel.upsert({
      where: { codigo: p },
      update: {},
      create: { codigo: p, nome: p },
    });
  }

  const admin = await upsertUser('admin@oficina.local', 'Admin Sistema', PapelCodigo.ADMIN);
  const vmo = await upsertUser('vmo@oficina.local', 'Ana VMO', PapelCodigo.VMO_LEAD);
  const fin = await upsertUser('fin@oficina.local', 'Carlos Finanças', PapelCodigo.FINANCAS);
  const sponsor = await upsertUser(
    'sponsor@oficina.local',
    'Sofia Sponsor',
    PapelCodigo.SPONSOR,
  );
  const pm = await upsertUser('pm@oficina.local', 'Paulo PM', PapelCodigo.PM);
  const dir = await upsertUser(
    'diretoria@oficina.local',
    'Diana Diretoria',
    PapelCodigo.DIRETORIA,
  );
  void admin;
  void dir;

  await prisma.configVmo.create({
    data: {},
  }).catch(() => undefined);

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
        sponsorId: sponsor.id,
        pmId: pm.id,
        status: ProjetoStatus.execucao,
        investimentoAprovado: p.hard * 8,
        inicioPrevisto: inicio,
        fimPrevisto: addMonths(inicio, 12),
        premissasOkFinancas: true,
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
        benefitOwnerId: sponsor.id,
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
        aprovadaPorId: vmo.id,
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
          benefitOwnerId: sponsor.id,
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
          aprovadaPorId: vmo.id,
        },
      });
    }

    await prisma.gateDecisao.create({
      data: {
        projetoId: projeto.id,
        gate: GateTipo.G2,
        decisao: GateDecisaoTipo.go,
        decididaPorId: vmo.id,
        comentario: 'Aprovado no seed',
      },
    });

    // 3 meses de medições validadas (jan-mar) — PM registra, Fin valida
    for (let m = 0; m < 3; m++) {
      const periodo = addMonths(inicio, m);
      const med = await prisma.medicao.create({
        data: {
          beneficioId: hard.id,
          periodoReferencia: periodo,
          valorRealizado: p.hard * (0.85 + m * 0.05),
          status: MedicaoStatus.validada,
          registradaPorId: pm.id,
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
          validadaPorId: fin.id,
          decisao: 'aprovada',
          comentario: 'Homologado seed',
        },
      });
    }

    // uma medição pendente no mês atual do seed (abril)
    const pend = await prisma.medicao.create({
      data: {
        beneficioId: hard.id,
        periodoReferencia: addMonths(inicio, 3),
        valorRealizado: p.hard,
        status: MedicaoStatus.pendente_validacao,
        registradaPorId: pm.id,
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
        importadoPorId: fin.id,
      },
    });
  }

  console.log('Seed OK: 10 projetos, usuários e ciclo mensal');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
