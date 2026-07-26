import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PapelCodigo } from '@prisma/client';
import { NaoService } from './nao.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';

@Controller('nao')
@UseGuards(DevAuthGuard, RolesGuard)
export class NaoController {
  constructor(private readonly nao: NaoService) {}

  @Get('snapshot')
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.DIRETORIA,
  )
  snapshot() {
    return this.nao.buildSnapshot();
  }

  @Post('sync')
  @Roles(PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD, PapelCodigo.FINANCAS)
  sync() {
    return this.nao.syncRemote();
  }
}
