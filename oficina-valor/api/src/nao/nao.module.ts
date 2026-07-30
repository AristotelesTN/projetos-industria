import { Module } from '@nestjs/common';
import { NaoController } from './nao.controller';
import { NaoService } from './nao.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [NaoController],
  providers: [NaoService],
  exports: [NaoService],
})
export class NaoModule {}
