import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DemandaOrigem, DemandaStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DemandasService } from './demandas.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/roles';

class CreateDemandaDto {
  @IsString()
  @MinLength(2)
  titulo!: string;

  @IsString()
  @MinLength(2)
  descricao!: string;

  @IsString()
  @MinLength(2)
  solicitanteNome!: string;

  @IsString()
  areaNome!: string;

  @IsOptional()
  @IsEnum(DemandaOrigem)
  origem?: DemandaOrigem;

  @IsOptional()
  @IsString()
  idAevo?: string | null;
}

class StatusDto {
  @IsEnum(DemandaStatus)
  status!: DemandaStatus;
}

class EntrevistaDto {
  @IsOptional()
  @IsString()
  ganhosEstimadosResumo?: string | null;

  @IsOptional()
  @IsString()
  dispensaJustificativa?: string | null;
}

class PriorizarDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreImpacto?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreAlinhamento?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreEsforco?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreRisco?: number | null;

  @IsOptional()
  @IsString()
  justificativaPriorizacao?: string | null;
}

class DecidirDto {
  @IsIn(['aprovado', 'reprovado'])
  decisao!: 'aprovado' | 'reprovado';

  @IsOptional()
  @IsString()
  justificativa?: string | null;

  @IsOptional()
  @IsBoolean()
  desenvolvimentoInterno?: boolean | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  investimentoEstimado?: number | null;
}

@Controller('demandas')
@UseGuards(DevAuthGuard, RolesGuard)
export class DemandasController {
  constructor(private readonly demandas: DemandasService) {}

  @Get()
  list(@Query('origem') origem?: DemandaOrigem) {
    return this.demandas.list(origem);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.demandas.get(id);
  }

  @Post()
  create(@Body() dto: CreateDemandaDto, @CurrentUser() user: AuthUser) {
    return this.demandas.create(dto, user);
  }

  @Patch(':id/status')
  status(
    @Param('id') id: string,
    @Body() dto: StatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.demandas.updateStatus(id, dto.status, user);
  }

  @Post(':id/entrevista')
  entrevista(
    @Param('id') id: string,
    @Body() dto: EntrevistaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.demandas.concluirEntrevista(id, dto, user);
  }

  @Post(':id/priorizar')
  priorizar(
    @Param('id') id: string,
    @Body() dto: PriorizarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.demandas.priorizar(id, dto, user);
  }

  @Post(':id/decidir')
  decidir(
    @Param('id') id: string,
    @Body() dto: DecidirDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.demandas.decidir(id, dto, user);
  }

  @Post(':id/criar-projeto')
  criarProjeto(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.demandas.criarProjeto(id, user);
  }
}
