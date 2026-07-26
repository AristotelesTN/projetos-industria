import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AgentCodigo, AgentMode, AgentRecoStatus } from '@prisma/client';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/roles';
import { AgentsService } from './agents.service';

@Controller('agents')
@UseGuards(DevAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('overview')
  overview() {
    return this.agents.overview();
  }

  @Get('recommendations')
  recommendations(
    @Query('agent') agent?: AgentCodigo,
    @Query('status') status?: AgentRecoStatus,
  ) {
    return this.agents.listRecommendations({ agent, status });
  }

  @Get('activity')
  activity(
    @Query('agent') agent?: AgentCodigo,
    @Query('status') statusBadge?: string,
  ) {
    return this.agents.activity({ agent, statusBadge });
  }

  @Get('recommendations/:id')
  getOne(@Param('id') id: string) {
    return this.agents.getRecommendation(id);
  }

  @Post('scan')
  scan(@CurrentUser() user: AuthUser) {
    return this.agents.scan(user);
  }

  @Post('recommendations/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agents.accept(id, user);
  }

  @Post('recommendations/:id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agents.reject(id, user);
  }

  @Patch('mode')
  setMode(@Body() body: { mode: AgentMode }) {
    return this.agents.setMode(body.mode);
  }
}
