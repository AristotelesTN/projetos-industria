import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ProjetosModule } from './projetos/projetos.module';
import { BeneficiosModule } from './beneficios/beneficios.module';
import { MedicoesModule } from './medicoes/medicoes.module';
import { GatesModule } from './gates/gates.module';
import { CustosModule } from './custos/custos.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { IntegracoesModule } from './integracoes/integracoes.module';
import { NaoModule } from './nao/nao.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { WizardModule } from './wizard/wizard.module';
import { AgentsModule } from './agents/agents.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConfigModule,
    ProjetosModule,
    BeneficiosModule,
    MedicoesModule,
    GatesModule,
    CustosModule,
    AnalyticsModule,
    AuditoriaModule,
    IntegracoesModule,
    NaoModule,
    RelatoriosModule,
    WizardModule,
    AgentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
