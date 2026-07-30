import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { MedicaoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async ganhosExcel(filtros?: { categoria?: string }) {
    const medicoes = await this.prisma.medicao.findMany({
      where: {
        status: MedicaoStatus.validada,
        deletedAt: null,
        beneficio: filtros?.categoria
          ? { categoria: filtros.categoria as never }
          : undefined,
      },
      include: {
        beneficio: {
          include: {
            centroCusto: true,
            businessCase: { include: { projeto: { include: { area: true } } } },
          },
        },
        validacao: true,
      },
      orderBy: { periodoReferencia: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ganhos');
    ws.columns = [
      { header: 'Projeto', key: 'projeto', width: 30 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Benefício', key: 'beneficio', width: 28 },
      { header: 'Categoria', key: 'categoria', width: 14 },
      { header: 'Centro Custo', key: 'cc', width: 14 },
      { header: 'Período', key: 'periodo', width: 12 },
      { header: 'Valor (R$)', key: 'valor', width: 14 },
      { header: 'Validado em', key: 'validadoEm', width: 20 },
    ];
    for (const m of medicoes) {
      ws.addRow({
        projeto: m.beneficio.businessCase.projeto.nome,
        area: m.beneficio.businessCase.projeto.area.nome,
        beneficio: m.beneficio.nome,
        categoria: m.beneficio.categoria,
        cc: m.beneficio.centroCusto?.codigo ?? '',
        periodo: m.periodoReferencia.toISOString().slice(0, 10),
        valor: Number(m.valorRealizado),
        validadoEm: m.validacao?.validadaEm?.toISOString() ?? '',
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
