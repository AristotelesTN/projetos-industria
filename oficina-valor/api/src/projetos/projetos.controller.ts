import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BeneficioCategoria, ProjetoStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjetosService } from './projetos.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

class BeneficioDto {
  @IsString()
  nome!: string;

  @IsEnum(BeneficioCategoria)
  categoria!: BeneficioCategoria;

  @IsOptional()
  @IsString()
  centroCustoCodigo?: string;

  @IsNumber()
  @Min(0)
  valorMensalEsperado!: number;

  @IsOptional()
  @IsNumber()
  escalaEstrategica?: number;

  @IsOptional()
  @IsString()
  inicioCaptura?: string;

  @IsOptional()
  @IsNumber()
  janelaMeses?: number;

  @IsUUID()
  benefitOwnerId!: string;
}

class CreateProjetoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  portfolioNome?: string;

  @IsString()
  areaNome!: string;

  @IsUUID()
  sponsorId!: string;

  @IsUUID()
  pmId!: string;

  @IsNumber()
  investimento!: number;

  @IsNumber()
  prazoMeses!: number;

  @IsString()
  problema!: string;

  @IsOptional()
  @IsString()
  inicioPrevisto?: string;

  @IsOptional()
  @IsString()
  fimPrevisto?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficioDto)
  beneficios!: BeneficioDto[];
}

class PremissasDto {
  @IsBoolean()
  ok!: boolean;

  @IsOptional()
  @IsString()
  comentario?: string;
}

class ReatribuirDto {
  @IsUUID()
  novoPmId!: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

class CreateRapidoDto {
  @IsString()
  nome!: string;

  @IsString()
  areaNome!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  investimento?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  prazoMeses?: number;

  @IsOptional()
  @IsString()
  problema?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMensalEsperado?: number;

  @IsOptional()
  @IsEnum(ProjetoStatus)
  status?: ProjetoStatus;
}

class StatusDto {
  @IsEnum(ProjetoStatus)
  status!: ProjetoStatus;
}

@Controller('projetos')
@UseGuards(DevAuthGuard, RolesGuard)
export class ProjetosController {
  constructor(private readonly projetos: ProjetosService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projetos.list(user);
  }

  @Post('rapido')
  createRapido(@Body() dto: CreateRapidoDto, @CurrentUser() user: AuthUser) {
    return this.projetos.createRapido(dto, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projetos.get(id, user);
  }

  @Post()
  create(@Body() dto: CreateProjetoDto, @CurrentUser() user: AuthUser) {
    return this.projetos.create(dto, user);
  }

  @Post(':id/submeter')
  submeter(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projetos.submeterBusinessCase(id, user);
  }

  @Post(':id/premissas')
  premissas(
    @Param('id') id: string,
    @Body() dto: PremissasDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projetos.preValidarPremissas(
      id,
      dto.ok,
      user,
      dto.comentario,
    );
  }

  @Patch(':id/pm')
  reatribuir(
    @Param('id') id: string,
    @Body() dto: ReatribuirDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projetos.reatribuirPm(id, dto.novoPmId, user, dto.motivo);
  }

  @Patch(':id/status')
  status(
    @Param('id') id: string,
    @Body() dto: StatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projetos.updateStatus(id, dto.status, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projetos.remove(id, user);
  }
}
