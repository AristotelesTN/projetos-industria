import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { memoryStorage } from 'multer';
import { MedicoesService } from './medicoes.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

class CreateMedicaoDto {
  @IsString()
  periodoReferencia!: string;

  @IsNumber()
  valorRealizado!: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}

class ValidacaoDto {
  @IsIn(['aprovada', 'rejeitada'])
  decisao!: 'aprovada' | 'rejeitada';

  @IsOptional()
  @IsString()
  comentario?: string;
}

class EstornoDto {
  @IsString()
  justificativa!: string;
}

class FecharPeriodoDto {
  @IsString()
  periodo!: string;
}

@Controller()
@UseGuards(DevAuthGuard, RolesGuard)
export class MedicoesController {
  constructor(private readonly medicoes: MedicoesService) {}

  @Post('beneficios/:id/medicoes')
  criar(
    @Param('id') id: string,
    @Body() dto: CreateMedicaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.medicoes.criar(id, dto, user);
  }

  @Post('medicoes/:id/evidencias')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  evidencia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.medicoes.anexarEvidencia(id, file, user);
  }

  @Post('medicoes/:id/submeter')
  submeter(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.medicoes.submeter(id, user);
  }

  @Patch('medicoes/:id')
  submeterPatch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.medicoes.submeter(id, user);
  }

  @Post('medicoes/:id/validacao')
  validar(
    @Param('id') id: string,
    @Body() dto: ValidacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.medicoes.validar(id, dto.decisao, dto.comentario, user);
  }

  @Post('medicoes/:id/estorno')
  estorno(
    @Param('id') id: string,
    @Body() dto: EstornoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.medicoes.estornar(id, dto.justificativa, user);
  }

  @Get('medicoes/pendentes')
  fila() {
    return this.medicoes.filaPendentes();
  }

  @Post('periodos/fechar')
  fechar(@Body() dto: FecharPeriodoDto, @CurrentUser() user: AuthUser) {
    return this.medicoes.fecharPeriodo(dto.periodo, user);
  }
}
