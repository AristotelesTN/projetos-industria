import {
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BeneficioStatus,
  GateDecisaoTipo,
  GateTipo,
  MedicaoStatus,
  ProjetoStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser } from '../common/roles';

@Injectable()
export class GatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async decidir(
    projetoId: string,
    input: {
      gate: GateTipo;
      decisao: GateDecisaoTipo;
      comentario?: string;
      ataUrl?: string;
    },
    user: AuthUser,
  ) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      include: {
        businessCase: {
          include: {
            beneficios: { include: { baselines: true } },
          },
        },
      },
    });
    if (!projeto) throw new UnprocessableEntityException('Projeto inexistente');

    if (input.gate === GateTipo.G2 && input.decisao === GateDecisaoTipo.go) {
      if (!projeto.businessCase?.submetido) {
        throw new UnprocessableEntityException(
          'Business case precisa estar submetido',
        );
      }
      if (!projeto.premissasOkFinancas) {
        throw new UnprocessableEntityException(
          'Premissas financeiras precisam ser OK (Finanças)',
        );
      }
      if (!projeto.wizardBaselineCompleto) {
        throw new UnprocessableEntityException(
          'Complete o Wizard de Análise de Ganhos (baseline) antes do G2',
        );
      }
    }

    const gate = await this.prisma.$transaction(async (tx) => {
      const g = await tx.gateDecisao.create({
        data: {
          projetoId,
          gate: input.gate,
          decisao: input.decisao,
          decididaPorId: user.id,
          comentario: input.comentario,
          ataUrl: input.ataUrl,
        },
      });

      if (input.decisao === GateDecisaoTipo.go) {
        let status: ProjetoStatus = projeto.status;
        if (input.gate === GateTipo.G1) status = ProjetoStatus.conceito;
        if (input.gate === GateTipo.G2) status = ProjetoStatus.execucao;
        if (input.gate === GateTipo.G3) status = ProjetoStatus.execucao;
        if (input.gate === GateTipo.G4) status = ProjetoStatus.encerrado;
        if (input.gate === GateTipo.G5) status = ProjetoStatus.sustentacao;

        await tx.projeto.update({
          where: { id: projetoId },
          data: { status },
        });

        if (input.gate === GateTipo.G2) {
          for (const b of projeto.businessCase?.beneficios ?? []) {
            const draft = b.baselines.sort((a, c) => c.versao - a.versao)[0];
            if (!draft) {
              throw new UnprocessableEntityException(
                `Benefício ${b.nome} sem baseline`,
              );
            }
            await tx.baseline.updateMany({
              where: { beneficioId: b.id, vigente: true },
              data: { vigente: false },
            });
            await tx.baseline.update({
              where: { id: draft.id },
              data: {
                vigente: true,
                congeladaEm: new Date(),
                aprovadaPorId: user.id,
              },
            });
            await tx.beneficio.update({
              where: { id: b.id },
              data: { status: BeneficioStatus.em_captura },
            });
          }
        }
      }

      if (input.decisao === GateDecisaoTipo.kill) {
        await tx.projeto.update({
          where: { id: projetoId },
          data: { status: ProjetoStatus.morto },
        });
        const beneficioIds =
          projeto.businessCase?.beneficios.map((b) => b.id) ?? [];
        if (beneficioIds.length) {
          await tx.beneficio.updateMany({
            where: {
              id: { in: beneficioIds },
              status: {
                in: [BeneficioStatus.planejado, BeneficioStatus.em_captura],
              },
            },
            data: { status: BeneficioStatus.cancelado },
          });
          await tx.medicao.updateMany({
            where: {
              beneficioId: { in: beneficioIds },
              status: {
                in: [
                  MedicaoStatus.rascunho,
                  MedicaoStatus.pendente_validacao,
                  MedicaoStatus.rejeitada,
                ],
              },
            },
            data: { status: MedicaoStatus.arquivada },
          });
        }
      }

      if (input.decisao === GateDecisaoTipo.hold) {
        await tx.projeto.update({
          where: { id: projetoId },
          data: { status: ProjetoStatus.hold },
        });
        const beneficioIds =
          projeto.businessCase?.beneficios.map((b) => b.id) ?? [];
        if (beneficioIds.length) {
          await tx.beneficio.updateMany({
            where: { id: { in: beneficioIds } },
            data: { capturaPausada: true },
          });
        }
      }

      if (input.decisao === GateDecisaoTipo.recycle) {
        await tx.projeto.update({
          where: { id: projetoId },
          data: {
            status: ProjetoStatus.conceito,
            premissasOkFinancas: false,
          },
        });
        if (projeto.businessCase) {
          await tx.businessCase.update({
            where: { id: projeto.businessCase.id },
            data: { submetido: false },
          });
        }
      }

      if (
        input.decisao === GateDecisaoTipo.go &&
        projeto.status === ProjetoStatus.hold
      ) {
        const beneficioIds =
          projeto.businessCase?.beneficios.map((b) => b.id) ?? [];
        if (beneficioIds.length) {
          await tx.beneficio.updateMany({
            where: { id: { in: beneficioIds } },
            data: { capturaPausada: false },
          });
        }
      }

      return g;
    });

    await this.auditoria.log({
      entidade: 'GateDecisao',
      entidadeId: gate.id,
      acao: `${input.gate}:${input.decisao}`,
      usuarioId: user.id,
      valorNovo: input,
    });

    return gate;
  }
}
