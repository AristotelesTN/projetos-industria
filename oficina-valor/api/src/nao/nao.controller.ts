import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { NaoService } from './nao.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';

@Controller('nao')
@UseGuards(DevAuthGuard, RolesGuard)
export class NaoController {
  constructor(private readonly nao: NaoService) {}

  @Get('snapshot')
  snapshot() {
    return this.nao.buildSnapshot();
  }

  @Post('sync')
  sync() {
    return this.nao.syncRemote();
  }
}
