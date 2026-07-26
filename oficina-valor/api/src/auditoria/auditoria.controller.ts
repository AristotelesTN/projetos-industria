import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';

@Controller('auditoria')
@UseGuards(DevAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  list(
    @Query('entidade') entidade?: string,
    @Query('periodoDe') periodoDe?: string,
    @Query('periodoAte') periodoAte?: string,
  ) {
    return this.auditoria.list({
      entidade,
      periodoDe: periodoDe ? new Date(periodoDe) : undefined,
      periodoAte: periodoAte ? new Date(periodoAte) : undefined,
    });
  }
}
