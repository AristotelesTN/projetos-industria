import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { PapelCodigo } from '@prisma/client';
import { Response } from 'express';
import { RelatoriosService } from './relatorios.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';

@Controller('relatorios')
@UseGuards(DevAuthGuard, RolesGuard)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('ganhos')
  @Roles(
    PapelCodigo.FINANCAS,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.DIRETORIA,
    PapelCodigo.ADMIN,
  )
  async ganhos(
    @Res() res: Response,
    @Query('categoria') categoria?: string,
  ) {
    const buf = await this.relatorios.ganhosExcel({ categoria });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ganhos-oficina-valor.xlsx"',
    );
    res.send(buf);
  }
}
