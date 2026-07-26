import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { BeneficioCategoria } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { ProjetosService } from '../projetos/projetos.service';
import { AuthUser } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegracoesService {
  constructor(
    private readonly projetos: ProjetosService,
    private readonly prisma: PrismaService,
  ) {}

  async importLegado(buffer: Buffer, user: AuthUser) {
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{
      projeto: string;
      area: string;
      problema: string;
      investimento: string;
      prazo_meses: string;
      beneficio: string;
      categoria: string;
      valor_mensal: string;
      centro_custo?: string;
      sponsor_email: string;
      pm_email: string;
      owner_email: string;
    }>;

    if (!rows.length) {
      throw new UnprocessableEntityException('CSV vazio');
    }

    const byProjeto = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byProjeto.get(r.projeto) ?? [];
      list.push(r);
      byProjeto.set(r.projeto, list);
    }

    const created = [];
    for (const [nome, bens] of byProjeto) {
      const first = bens[0];
      const sponsor = await this.prisma.usuario.findUnique({
        where: { email: first.sponsor_email },
      });
      const pm = await this.prisma.usuario.findUnique({
        where: { email: first.pm_email },
      });
      if (!sponsor || !pm) continue;

      const projeto = await this.projetos.create(
        {
          nome,
          areaNome: first.area,
          sponsorId: sponsor.id,
          pmId: pm.id,
          investimento: Number(first.investimento),
          prazoMeses: Number(first.prazo_meses),
          problema: first.problema,
          beneficios: await Promise.all(
            bens.map(async (b) => {
              const owner = await this.prisma.usuario.findUnique({
                where: { email: b.owner_email },
              });
              return {
                nome: b.beneficio,
                categoria: b.categoria as BeneficioCategoria,
                centroCustoCodigo: b.centro_custo,
                valorMensalEsperado: Number(b.valor_mensal),
                benefitOwnerId: owner?.id ?? pm.id,
              };
            }),
          ),
        },
        user,
      );
      created.push(projeto);
    }
    return { importados: created.length, projetos: created };
  }
}
