import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrigemCusto, PapelCodigo } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthUser, hasAnyRole } from '../common/roles';
import { monthStart } from '../common/dates';

@Injectable()
export class CustosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async adicionar(
    projetoId: string,
    input: {
      periodoReferencia: string;
      valor: number;
      centroCustoCodigo?: string;
      origem?: OrigemCusto;
    },
    user: AuthUser,
  ) {
    if (!hasAnyRole(user, [PapelCodigo.FINANCAS, PapelCodigo.ADMIN])) {
      throw new ForbiddenException();
    }
    let centroCustoId: string | undefined;
    if (input.centroCustoCodigo) {
      const cc = await this.prisma.centroCusto.upsert({
        where: { codigo: input.centroCustoCodigo },
        update: {},
        create: {
          codigo: input.centroCustoCodigo,
          nome: input.centroCustoCodigo,
        },
      });
      centroCustoId = cc.id;
    }
    const custo = await this.prisma.custoRealizado.create({
      data: {
        projetoId,
        centroCustoId,
        periodoReferencia: monthStart(input.periodoReferencia),
        valor: input.valor,
        origem: input.origem ?? OrigemCusto.manual,
        importadoPorId: user.id,
      },
    });
    await this.auditoria.log({
      entidade: 'CustoRealizado',
      entidadeId: custo.id,
      acao: 'create',
      usuarioId: user.id,
      valorNovo: custo,
    });
    return custo;
  }

  async importCsv(buffer: Buffer, user: AuthUser) {
    if (!hasAnyRole(user, [PapelCodigo.FINANCAS, PapelCodigo.ADMIN])) {
      throw new ForbiddenException();
    }
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{
      projeto_ref: string;
      centro_custo?: string;
      periodo: string;
      valor: string;
    }>;

    const results = [];
    for (const row of rows) {
      const projeto = await this.prisma.projeto.findFirst({
        where: {
          OR: [{ id: row.projeto_ref }, { nome: row.projeto_ref }],
        },
      });
      if (!projeto) continue;
      const created = await this.adicionar(
        projeto.id,
        {
          periodoReferencia: row.periodo,
          valor: Number(row.valor),
          centroCustoCodigo: row.centro_custo,
          origem: OrigemCusto.erp_import,
        },
        user,
      );
      results.push(created);
    }
    return { importados: results.length, itens: results };
  }
}
