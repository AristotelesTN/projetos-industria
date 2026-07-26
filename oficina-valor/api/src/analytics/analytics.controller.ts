import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';

@Controller()
@UseGuards(DevAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('projetos/:id/analytics')
  projeto(@Param('id') id: string) {
    return this.analytics.projetoAnalytics(id);
  }

  @Get('portfolio/resumo')
  portfolio() {
    return this.analytics.portfolioResumo();
  }
}
