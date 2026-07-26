import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NaoModule } from '../nao/nao.module';

@Module({
  imports: [AnalyticsModule, NaoModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
