import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WizardRamo, WizardTipo } from '@prisma/client';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/roles';
import { WizardCalcInput, WizardService } from './wizard.service';

@Controller()
@UseGuards(DevAuthGuard, RolesGuard)
export class WizardController {
  constructor(private readonly wizard: WizardService) {}

  @Get('projetos/:id/wizards')
  list(@Param('id') id: string) {
    return this.wizard.listByProjeto(id);
  }

  @Get('wizards/nao-adotados')
  naoAdotados() {
    return this.wizard.naoAdotados();
  }

  @Get('wizards/:id')
  get(@Param('id') id: string) {
    return this.wizard.get(id);
  }

  @Post('projetos/:id/wizards')
  start(
    @Param('id') id: string,
    @Body()
    body: {
      tipo: WizardTipo;
      respondenteNome?: string;
      conheceProjeto?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.wizard.start(id, body.tipo, user, body);
  }

  @Post('wizards/:id/encaminhar')
  encaminhar(
    @Param('id') id: string,
    @Body() body: { encaminhadoPara: string; respondenteNome?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.wizard.encaminhar(id, user, body);
  }

  @Post('wizards/:id/complete')
  complete(
    @Param('id') id: string,
    @Body()
    body: {
      adotado?: boolean;
      causaNaoAdocao?: string;
      ramo?: WizardRamo;
      cicloRetry?: number;
      calc?: WizardCalcInput;
      forcarSemGanhos?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.wizard.complete(id, user, body);
  }
}
