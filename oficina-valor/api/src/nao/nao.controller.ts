import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { NaoService } from './nao.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';

@Controller('nao')
@UseGuards(DevAuthGuard, RolesGuard)
export class NaoController {
  constructor(private readonly nao: NaoService) {}

  @Get('status')
  status() {
    return this.nao.status();
  }

  @Get('snapshot')
  snapshot() {
    return this.nao.buildSnapshot();
  }

  @Post('sync')
  sync() {
    return this.nao.syncLocal();
  }

  @Post('ask')
  ask(@Body() body: { question?: string }) {
    return this.nao.ask(body?.question || '');
  }

  @Post('story')
  story() {
    return this.nao.buildStory();
  }
}
