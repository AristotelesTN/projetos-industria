import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    entidade: string;
    entidadeId: string;
    acao: string;
    usuarioId?: string;
    valorAnterior?: unknown;
    valorNovo?: unknown;
  }) {
    return this.prisma.auditoria.create({
      data: {
        entidade: input.entidade,
        entidadeId: input.entidadeId,
        acao: input.acao,
        usuarioId: input.usuarioId,
        valorAnterior:
          input.valorAnterior === undefined
            ? undefined
            : (input.valorAnterior as Prisma.InputJsonValue),
        valorNovo:
          input.valorNovo === undefined
            ? undefined
            : (input.valorNovo as Prisma.InputJsonValue),
      },
    });
  }

  list(filtros: { entidade?: string; periodoDe?: Date; periodoAte?: Date }) {
    return this.prisma.auditoria.findMany({
      where: {
        entidade: filtros.entidade,
        createdAt: {
          gte: filtros.periodoDe,
          lte: filtros.periodoAte,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { usuario: { select: { id: true, nome: true, email: true } } },
    });
  }
}
