import { Module } from '@nestjs/common';
import { DemandasController } from './demandas.controller';
import { DemandasService } from './demandas.service';
import { ProjetosModule } from '../projetos/projetos.module';

@Module({
  imports: [ProjetosModule],
  controllers: [DemandasController],
  providers: [DemandasService],
  exports: [DemandasService],
})
export class DemandasModule {}
