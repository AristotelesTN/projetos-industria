import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { RelatoriosService } from './relatorios.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';

@Controller('relatorios')
@UseGuards(DevAuthGuard, RolesGuard)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('ganhos')
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
