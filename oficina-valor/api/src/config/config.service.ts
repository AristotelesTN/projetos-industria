import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class ConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async get() {
    let cfg = await this.prisma.configVmo.findFirst();
    if (!cfg) {
      cfg = await this.prisma.configVmo.create({ data: {} });
    }
    return cfg;
  }

  async update(
    data: {
      janelaSavingsPadrao?: number;
      limiarLeanInvestimento?: number;
      pesosScoring?: Record<string, number>;
    },
    usuarioId: string,
  ) {
    const current = await this.get();
    const updated = await this.prisma.configVmo.update({
      where: { id: current.id },
      data: {
        janelaSavingsPadrao: data.janelaSavingsPadrao,
        limiarLeanInvestimento: data.limiarLeanInvestimento,
        pesosScoring:
          data.pesosScoring === undefined
            ? undefined
            : (data.pesosScoring as Prisma.InputJsonValue),
      },
    });
    await this.auditoria.log({
      entidade: 'ConfigVmo',
      entidadeId: updated.id,
      acao: 'update',
      usuarioId,
      valorAnterior: current,
      valorNovo: updated,
    });
    return updated;
  }
}
