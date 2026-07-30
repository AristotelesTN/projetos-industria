import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DemandaOrigem,
  DemandaStatus,
  ProjetoStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProjetosService } from '../projetos/projetos.service';
import { AuthUser } from '../common/roles';

const FUNIL: DemandaStatus[] = [
  DemandaStatus.recebida,
  DemandaStatus.entrevista,
  DemandaStatus.ficha,
  DemandaStatus.priorizacao,
  DemandaStatus.decisao,
];

function clampScore(n: unknown): number | null {
  if (n == null || n === '') return null;
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return Math.max(1, Math.min(5, Math.round(v)));
}

function calcScore(input: {
  impacto: number | null;
  alinhamento: number | null;
  esforco: number | null;
  risco: number | null;
}) {
  const parts = [
    input.impacto,
    input.alinhamento,
    input.esforco == null ? null : 6 - input.esforco, // esforço alto reduz score
    input.risco == null ? null : 6 - input.risco,
  ].filter((x): x is number => x != null);
  if (!parts.length) return null;
  return Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
}

@Injectable()
export class DemandasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly projetos: ProjetosService,
  ) {}

  list(origem?: DemandaOrigem) {
    return this.prisma.demanda.findMany({
      where: origem ? { origem } : undefined,
      include: {
        projeto: { select: { id: true, nome: true, status: true } },
      },
      orderBy: [{ scoreTotal: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(id: string) {
    const d = await this.prisma.demanda.findUnique({
      where: { id },
      include: {
        projeto: { select: { id: true, nome: true, status: true } },
      },
    });
    if (!d) throw new NotFoundException('Demanda não encontrada');
    return d;
  }

  async create(
    input: {
      titulo: string;
      descricao: string;
      solicitanteNome: string;
      areaNome: string;
      origem?: DemandaOrigem;
      idAevo?: string | null;
    },
    user: AuthUser,
  ) {
    const origem = input.origem || DemandaOrigem.interna;
    if (origem === DemandaOrigem.aevo && !input.idAevo?.trim()) {
      throw new BadRequestException('Informe o ID AEVO');
    }
    const created = await this.prisma.demanda.create({
      data: {
        titulo: input.titulo.trim(),
        descricao: input.descricao.trim(),
        solicitanteNome: input.solicitanteNome.trim(),
        areaNome: input.areaNome.trim() || 'Geral',
        origem,
        idAevo: input.idAevo?.trim() || null,
      },
    });
    await this.auditoria.log({
      entidade: 'Demanda',
      entidadeId: created.id,
      acao: 'create',
      usuarioId: user.id,
      valorNovo: created,
    });
    return created;
  }

  async updateStatus(id: string, status: DemandaStatus, user: AuthUser) {
    const before = await this.get(id);
    if (
      status === DemandaStatus.ficha &&
      !before.entrevistaConcluida &&
      !before.entrevistaDispensaJustificativa
    ) {
      throw new BadRequestException(
        'Conclua a entrevista de ganhos ou registre dispensa antes de ir para Ficha',
      );
    }
    const updated = await this.prisma.demanda.update({
      where: { id },
      data: { status },
    });
    await this.auditoria.log({
      entidade: 'Demanda',
      entidadeId: id,
      acao: 'status_change',
      usuarioId: user.id,
      valorAnterior: { status: before.status },
      valorNovo: { status },
    });
    return updated;
  }

  async concluirEntrevista(
    id: string,
    input: {
      ganhosEstimadosResumo?: string | null;
      dispensaJustificativa?: string | null;
    },
    user: AuthUser,
  ) {
    const before = await this.get(id);
    const dispensa = input.dispensaJustificativa?.trim() || null;
    const updated = await this.prisma.demanda.update({
      where: { id },
      data: {
        entrevistaConcluida: !dispensa,
        entrevistaDispensaJustificativa: dispensa,
        ganhosEstimadosResumo: input.ganhosEstimadosResumo?.trim() || null,
        status:
          before.status === DemandaStatus.recebida ||
          before.status === DemandaStatus.entrevista
            ? DemandaStatus.ficha
            : before.status,
      },
    });
    await this.auditoria.log({
      entidade: 'Demanda',
      entidadeId: id,
      acao: 'entrevista',
      usuarioId: user.id,
      valorAnterior: {
        entrevistaConcluida: before.entrevistaConcluida,
      },
      valorNovo: {
        entrevistaConcluida: updated.entrevistaConcluida,
        dispensa,
      },
    });
    return updated;
  }

  async priorizar(
    id: string,
    input: {
      scoreImpacto?: number | null;
      scoreAlinhamento?: number | null;
      scoreEsforco?: number | null;
      scoreRisco?: number | null;
      justificativaPriorizacao?: string | null;
    },
    user: AuthUser,
  ) {
    const before = await this.get(id);
    const impacto = clampScore(input.scoreImpacto);
    const alinhamento = clampScore(input.scoreAlinhamento);
    const esforco = clampScore(input.scoreEsforco);
    const risco = clampScore(input.scoreRisco);
    const scoreTotal = calcScore({ impacto, alinhamento, esforco, risco });
    const updated = await this.prisma.demanda.update({
      where: { id },
      data: {
        scoreImpacto: impacto,
        scoreAlinhamento: alinhamento,
        scoreEsforco: esforco,
        scoreRisco: risco,
        scoreTotal,
        justificativaPriorizacao:
          input.justificativaPriorizacao?.trim() || null,
        status:
          FUNIL.indexOf(before.status) < FUNIL.indexOf(DemandaStatus.priorizacao)
            ? DemandaStatus.priorizacao
            : before.status === DemandaStatus.priorizacao
              ? DemandaStatus.decisao
              : before.status,
      },
    });
    await this.auditoria.log({
      entidade: 'Demanda',
      entidadeId: id,
      acao: 'priorizar',
      usuarioId: user.id,
      valorNovo: { scoreTotal, impacto, alinhamento, esforco, risco },
    });
    return updated;
  }

  async decidir(
    id: string,
    input: {
      decisao: 'aprovado' | 'reprovado';
      justificativa?: string | null;
      desenvolvimentoInterno?: boolean | null;
      investimentoEstimado?: number | null;
    },
    user: AuthUser,
  ) {
    const before = await this.get(id);
    if (input.decisao === 'reprovado' && !input.justificativa?.trim()) {
      throw new BadRequestException(
        'Justificativa obrigatória para reprovação',
      );
    }
    if (
      input.desenvolvimentoInterno === false &&
      (input.investimentoEstimado == null ||
        Number.isNaN(Number(input.investimentoEstimado)))
    ) {
      throw new BadRequestException(
        'Informe o investimento estimado para desenvolvimento externo',
      );
    }
    const updated = await this.prisma.demanda.update({
      where: { id },
      data: {
        decisaoGoNoGo: input.decisao,
        justificativaDecisao: input.justificativa?.trim() || null,
        desenvolvimentoInterno: input.desenvolvimentoInterno ?? null,
        investimentoEstimado:
          input.investimentoEstimado == null
            ? null
            : Number(input.investimentoEstimado),
        status:
          input.decisao === 'aprovado'
            ? DemandaStatus.aprovada
            : DemandaStatus.reprovada,
      },
    });
    await this.auditoria.log({
      entidade: 'Demanda',
      entidadeId: id,
      acao: 'decidir',
      usuarioId: user.id,
      valorAnterior: { status: before.status },
      valorNovo: {
        decisao: input.decisao,
        status: updated.status,
      },
    });
    return updated;
  }

  async criarProjeto(id: string, user: AuthUser) {
    const demanda = await this.get(id);
    if (demanda.projetoId) {
      throw new BadRequestException('Demanda já possui projeto vinculado');
    }
    if (demanda.status === DemandaStatus.reprovada) {
      throw new BadRequestException('Demanda reprovada não gera projeto');
    }
    if (
      !demanda.entrevistaConcluida &&
      !demanda.entrevistaDispensaJustificativa
    ) {
      throw new BadRequestException(
        'Conclua ou dispense a entrevista antes de criar a ficha/projeto',
      );
    }

    const investimento = Number(demanda.investimentoEstimado ?? 100000);
    const projeto = await this.projetos.createRapido(
      {
        nome: demanda.titulo,
        areaNome: demanda.areaNome,
        investimento,
        problema: [
          demanda.descricao,
          demanda.ganhosEstimadosResumo
            ? `Ganhos estimados: ${demanda.ganhosEstimadosResumo}`
            : null,
          demanda.origem === DemandaOrigem.aevo && demanda.idAevo
            ? `Origem AEVO: ${demanda.idAevo}`
            : `Origem: ${demanda.origem}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        valorMensalEsperado: Math.max(1000, Math.round(investimento / 24)),
        status:
          demanda.status === DemandaStatus.aprovada
            ? ProjetoStatus.aprovado
            : ProjetoStatus.conceito,
      },
      user,
    );

    const nextStatus =
      demanda.status === DemandaStatus.aprovada
        ? DemandaStatus.aprovada
        : DemandaStatus.ficha;

    const updated = await this.prisma.demanda.update({
      where: { id },
      data: {
        projetoId: projeto.id,
        status: nextStatus,
      },
      include: {
        projeto: { select: { id: true, nome: true, status: true } },
      },
    });

    if (demanda.justificativaDecisao) {
      await this.prisma.projeto.update({
        where: { id: projeto.id },
        data: { justificativaDecisao: demanda.justificativaDecisao },
      });
    }

    await this.auditoria.log({
      entidade: 'Demanda',
      entidadeId: id,
      acao: 'criar_projeto',
      usuarioId: user.id,
      valorNovo: { projetoId: projeto.id },
    });
    return updated;
  }
}
