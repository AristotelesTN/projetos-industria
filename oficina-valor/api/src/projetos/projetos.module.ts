import { Module } from '@nestjs/common';
import { ProjetosController } from './projetos.controller';
import { ProjetosService } from './projetos.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [ProjetosController],
  providers: [ProjetosService],
  exports: [ProjetosService],
})
export class ProjetosModule {}
