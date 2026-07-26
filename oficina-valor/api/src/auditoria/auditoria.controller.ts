import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PapelCodigo } from '@prisma/client';
import { AuditoriaService } from './auditoria.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';

@Controller('auditoria')
@UseGuards(DevAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.DIRETORIA,
  )
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
