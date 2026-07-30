import { Module } from '@nestjs/common';
import { IntegracoesController } from './integracoes.controller';
import { IntegracoesService } from './integracoes.service';
import { ProjetosModule } from '../projetos/projetos.module';

@Module({
  imports: [ProjetosModule],
  controllers: [IntegracoesController],
  providers: [IntegracoesService],
})
export class IntegracoesModule {}
