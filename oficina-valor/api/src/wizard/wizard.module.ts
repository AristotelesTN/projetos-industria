import { Module } from '@nestjs/common';
import { WizardController } from './wizard.controller';
import { WizardService } from './wizard.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [WizardController],
  providers: [WizardService],
  exports: [WizardService],
})
export class WizardModule {}
