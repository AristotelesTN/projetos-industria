import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PapelCodigo } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';

@Controller()
@UseGuards(DevAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('projetos/:id/analytics')
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.SPONSOR,
    PapelCodigo.PM,
    PapelCodigo.DIRETORIA,
  )
  projeto(@Param('id') id: string) {
    return this.analytics.projetoAnalytics(id);
  }

  @Get('portfolio/resumo')
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.DIRETORIA,
  )
  portfolio() {
    return this.analytics.portfolioResumo();
  }
}
