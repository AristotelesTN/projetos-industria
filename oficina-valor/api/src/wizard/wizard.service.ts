import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BeneficioCategoria,
  BeneficioStatus,
  MedicaoStatus,
  Prisma,
  WizardRamo,
  WizardStatus,
  WizardTipo,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser } from '../common/roles';
import { buildPerfilMensal, monthStart } from '../common/dates';

export type WizardCalcInput = {
  // produção
  volumeAntes?: number;
  volumeAgora?: number;
  margemContribuicao?: number;
  // custos
  gastoAntes?: number;
  gastoAgora?: number;
  custoUnitario?: number;
  fonteCusto?: string;
  // tempo
  tempoAntesMin?: number;
  tempoAgoraMin?: number;
  pessoas?: number;
  frequenciaSemanal?: number;
  custoHora?: number;
  // qualitativo
  escalaSatisfacao?: number;
  nps?: number;
  riscoProbAntes?: number;
  riscoImpactoAntes?: number;
  riscoProbDepois?: number;
  riscoImpactoDepois?: number;
  descricaoQualitativa?: string;
  janelaMeses?: number;
};

function calcMensal(ramo: WizardRamo, input: WizardCalcInput): {
  valorMensal: number;
  categoria: BeneficioCategoria;
  nome: string;
  detalhe: Record<string, unknown>;
} {
  const janela = input.janelaMeses ?? 12;
  switch (ramo) {
    case WizardRamo.producao: {
      const delta =
        Number(input.volumeAgora ?? 0) - Number(input.volumeAntes ?? 0);
      const margem = Number(input.margemContribuicao ?? 0);
      const valorMensal = Math.max(0, delta * margem);
      return {
        valorMensal,
        categoria: BeneficioCategoria.hard,
        nome: 'Ganho de produção',
        detalhe: { delta, margem, formula: 'Δ volume × margem', janela },
      };
    }
    case WizardRamo.reducao_custos: {
      const delta =
        Number(input.gastoAntes ?? 0) - Number(input.gastoAgora ?? 0);
      const valorMensal = Math.max(0, delta);
      return {
        valorMensal,
        categoria: BeneficioCategoria.hard,
        nome: 'Redução de custos/materiais',
        detalhe: {
          delta,
          fonteCusto: input.fonteCusto ?? 'não informada',
          custoUnitario: input.custoUnitario,
          formula: 'gasto antes − gasto agora',
          janela,
        },
      };
    }
    case WizardRamo.tempo_produtividade: {
      const deltaMin =
        Number(input.tempoAntesMin ?? 0) - Number(input.tempoAgoraMin ?? 0);
      const horasSemana =
        (deltaMin / 60) *
        Number(input.pessoas ?? 1) *
        Number(input.frequenciaSemanal ?? 1);
      const valorMensal = Math.max(
        0,
        horasSemana * 4.33 * Number(input.custoHora ?? 0),
      );
      return {
        valorMensal,
        categoria: BeneficioCategoria.soft,
        nome: 'Ganho de tempo/produtividade',
        detalhe: {
          deltaMin,
          horasSemana,
          formula: 'Δ tempo × pessoas × freq × custo-hora × 4,33',
          janela,
        },
      };
    }
    case WizardRamo.qualitativo_qualidade: {
      return {
        valorMensal: 0,
        categoria: BeneficioCategoria.estrategico,
        nome: 'Ganho qualitativo — Qualidade/NPS',
        detalhe: {
          escalaSatisfacao: input.escalaSatisfacao,
          nps: input.nps,
          descricao: input.descricaoQualitativa,
          janela,
        },
      };
    }
    case WizardRamo.qualitativo_risco: {
      const antes =
        Number(input.riscoProbAntes ?? 0) *
        Number(input.riscoImpactoAntes ?? 0);
      const depois =
        Number(input.riscoProbDepois ?? 0) *
        Number(input.riscoImpactoDepois ?? 0);
      const reducao = Math.max(0, antes - depois);
      const quantificavel = reducao > 0 && Number(input.riscoImpactoAntes) > 0;
      return {
        valorMensal: quantificavel ? reducao / 12 : 0,
        categoria: quantificavel
          ? BeneficioCategoria.avoidance
          : BeneficioCategoria.estrategico,
        nome: 'Mitigação de riscos',
        detalhe: {
          scoreAntes: antes,
          scoreDepois: depois,
          reducao,
          descricao: input.descricaoQualitativa,
          janela,
        },
      };
    }
    default:
      return {
        valorMensal: 0,
        categoria: BeneficioCategoria.soft,
        nome: 'Sem ganhos',
        detalhe: { janela },
      };
  }
}

@Injectable()
export class WizardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  listByProjeto(projetoId: string) {
    return this.prisma.wizardSessao.findMany({
      where: { projetoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const s = await this.prisma.wizardSessao.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Wizard não encontrado');
    return s;
  }

  async start(
    projetoId: string,
    tipo: WizardTipo,
    user: AuthUser,
    body?: { respondenteNome?: string; conheceProjeto?: boolean },
  ) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      include: { businessCase: true },
    });
    if (!projeto) throw new NotFoundException('Projeto inexistente');
    if (!projeto.businessCase) {
      throw new UnprocessableEntityException('Projeto sem business case');
    }

    const sessao = await this.prisma.wizardSessao.create({
      data: {
        projetoId,
        tipo,
        respondenteId: user.id,
        respondenteNome: body?.respondenteNome ?? user.nome,
        conheceProjeto: body?.conheceProjeto ?? true,
        respostas: {
          passos: [],
        },
      },
    });

    await this.auditoria.log({
      entidade: 'WizardSessao',
      entidadeId: sessao.id,
      acao: 'start',
      usuarioId: user.id,
      valorNovo: { tipo, projetoId },
    });
    return sessao;
  }

  async encaminhar(
    id: string,
    user: AuthUser,
    body: { encaminhadoPara: string; respondenteNome?: string },
  ) {
    const s = await this.get(id);
    if (s.status !== WizardStatus.em_andamento) {
      throw new UnprocessableEntityException('Wizard já finalizado');
    }
    const updated = await this.prisma.wizardSessao.update({
      where: { id },
      data: {
        status: WizardStatus.encaminhado,
        conheceProjeto: false,
        encaminhadoPara: body.encaminhadoPara,
        respondenteNome: body.respondenteNome ?? body.encaminhadoPara,
        respostas: {
          ...(s.respostas as object),
          encaminhadoPor: user.email,
          encaminhadoEm: new Date().toISOString(),
        },
      },
    });
    await this.auditoria.log({
      entidade: 'WizardSessao',
      entidadeId: id,
      acao: 'encaminhar',
      usuarioId: user.id,
      valorNovo: body,
    });
    return updated;
  }

  async complete(
    id: string,
    user: AuthUser,
    body: {
      adotado?: boolean;
      causaNaoAdocao?: string;
      ramo?: WizardRamo;
      cicloRetry?: number;
      calc?: WizardCalcInput;
      forcarSemGanhos?: boolean;
    },
  ) {
    const s = await this.get(id);
    if (s.status === WizardStatus.concluido) {
      throw new UnprocessableEntityException('Wizard já concluído');
    }

    const projeto = await this.prisma.projeto.findUnique({
      where: { id: s.projetoId },
      include: {
        businessCase: { include: { beneficios: true } },
      },
    });
    if (!projeto?.businessCase) {
      throw new UnprocessableEntityException('Projeto sem business case');
    }

    // RF-26a — não adotado
    if (s.tipo === WizardTipo.realizacao && body.adotado === false) {
      if (!body.causaNaoAdocao?.trim()) {
        throw new UnprocessableEntityException(
          'Informe a causa do não-funcionamento',
        );
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.projeto.update({
          where: { id: projeto.id },
          data: {
            semGanhos: true,
            naoAdotado: true,
            causaNaoAdocao: body.causaNaoAdocao,
          },
        });
        return tx.wizardSessao.update({
          where: { id },
          data: {
            status: WizardStatus.concluido,
            adotado: false,
            causaNaoAdocao: body.causaNaoAdocao,
            ramo: WizardRamo.sem_ganhos,
            semGanhos: true,
            resultado: {
              flag: 'SEM_GANHOS_NAO_ADOTADO',
              causa: body.causaNaoAdocao,
            },
          },
        });
      });
      await this.auditoria.log({
        entidade: 'WizardSessao',
        entidadeId: id,
        acao: 'complete_nao_adotado',
        usuarioId: user.id,
        valorNovo: updated.resultado,
      });
      return updated;
    }

    const ramo = body.ramo ?? WizardRamo.sem_ganhos;
    const ciclo = body.cicloRetry ?? s.cicloRetry;

    // RF-26c — loop tentar novamente antes de SEM GANHOS
    if (ramo === WizardRamo.sem_ganhos && !body.forcarSemGanhos && ciclo < 1) {
      return this.prisma.wizardSessao.update({
        where: { id },
        data: {
          cicloRetry: 1,
          ramo: WizardRamo.sem_ganhos,
          respostas: {
            ...(s.respostas as object),
            retryPrompt:
              'Se tirarmos esse projeto da sua área, faria falta? Revise as categorias com exemplos.',
          },
        },
      });
    }

    if (ramo === WizardRamo.sem_ganhos) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.projeto.update({
          where: { id: projeto.id },
          data: {
            semGanhos: true,
            wizardBaselineCompleto:
              s.tipo === WizardTipo.baseline
                ? true
                : projeto.wizardBaselineCompleto,
          },
        });
        return tx.wizardSessao.update({
          where: { id },
          data: {
            status: WizardStatus.concluido,
            ramo,
            cicloRetry: ciclo,
            semGanhos: true,
            adotado: body.adotado ?? true,
            resultado: { flag: 'SEM_GANHOS', ciclo },
          },
        });
      });
      return updated;
    }

    if (ramo === WizardRamo.reducao_custos && !body.calc?.fonteCusto?.trim()) {
      throw new UnprocessableEntityException(
        'Informe a fonte do custo unitário (almoxarifado/compras)',
      );
    }

    const calc = calcMensal(ramo, body.calc ?? {});
    const janela = body.calc?.janelaMeses ?? 12;
    const inicio = monthStart(new Date());

    const result = await this.prisma.$transaction(async (tx) => {
      const beneficio = await tx.beneficio.create({
        data: {
          businessCaseId: projeto.businessCase!.id,
          nome: calc.nome,
          categoria: calc.categoria,
          valorMensalEsperado: calc.valorMensal,
          janelaMeses: janela,
          inicioCaptura: inicio,
          benefitOwnerId: user.id,
          status:
            s.tipo === WizardTipo.baseline
              ? BeneficioStatus.planejado
              : BeneficioStatus.em_captura,
          escalaEstrategica:
            calc.categoria === BeneficioCategoria.estrategico
              ? Number(body.calc?.escalaSatisfacao ?? body.calc?.nps ?? 5)
              : null,
        },
      });

      const baseline = await tx.baseline.create({
        data: {
          beneficioId: beneficio.id,
          valorTotalBaseline: calc.valorMensal * janela,
          perfilMensal: buildPerfilMensal(inicio, janela, calc.valorMensal),
          versao: 1,
          vigente: s.tipo === WizardTipo.baseline ? false : true,
          congeladaEm: s.tipo === WizardTipo.realizacao ? new Date() : null,
          aprovadaPorId: s.tipo === WizardTipo.realizacao ? user.id : null,
        },
      });

      let medicao = null;
      if (s.tipo === WizardTipo.realizacao && calc.valorMensal > 0) {
        medicao = await tx.medicao.create({
          data: {
            beneficioId: beneficio.id,
            periodoReferencia: inicio,
            valorRealizado: calc.valorMensal,
            status: MedicaoStatus.pendente_validacao,
            registradaPorId: user.id,
            comentario: `Wizard realização · ramo ${ramo}`,
          },
        });
      }

      await tx.projeto.update({
        where: { id: projeto.id },
        data: {
          wizardBaselineCompleto:
            s.tipo === WizardTipo.baseline
              ? true
              : projeto.wizardBaselineCompleto,
          semGanhos: false,
          naoAdotado: false,
          causaNaoAdocao: null,
        },
      });

      if (s.tipo === WizardTipo.baseline) {
        await tx.businessCase.update({
          where: { id: projeto.businessCase!.id },
          data: { submetido: true },
        });
      }

      const resultado = {
        beneficioId: beneficio.id,
        baselineId: baseline.id,
        medicaoId: medicao?.id ?? null,
        valorMensal: calc.valorMensal,
        categoria: calc.categoria,
        detalhe: calc.detalhe,
        roteamento:
          ramo === WizardRamo.producao
            ? 'pre_avaliacao_financas_margem'
            : ramo === WizardRamo.reducao_custos
              ? 'pre_avaliacao_almoxarifado'
              : 'validacao_financas',
      } as Prisma.InputJsonValue;

      const sessao = await tx.wizardSessao.update({
        where: { id },
        data: {
          status: WizardStatus.concluido,
          ramo,
          cicloRetry: ciclo,
          adotado: body.adotado ?? true,
          semGanhos: false,
          resultado,
          respostas: {
            ...(s.respostas as object),
            calc: body.calc ?? {},
          } as Prisma.InputJsonValue,
        },
      });

      return { sessao, beneficio, baseline, medicao };
    });

    await this.auditoria.log({
      entidade: 'WizardSessao',
      entidadeId: id,
      acao: 'complete',
      usuarioId: user.id,
      valorNovo: result.sessao.resultado,
    });

    return result;
  }

  naoAdotados() {
    return this.prisma.projeto.findMany({
      where: { naoAdotado: true },
      include: { area: true, portfolio: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
