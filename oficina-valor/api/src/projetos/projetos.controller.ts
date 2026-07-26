import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  BeneficioCategoria,
  PapelCodigo,
} from '@prisma/client';
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
import { CurrentUser, Roles } from '../common/decorators';
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

@Controller('projetos')
@UseGuards(DevAuthGuard, RolesGuard)
export class ProjetosController {
  constructor(private readonly projetos: ProjetosService) {}

  @Get()
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.SPONSOR,
    PapelCodigo.PM,
    PapelCodigo.DIRETORIA,
  )
  list(@CurrentUser() user: AuthUser) {
    return this.projetos.list(user);
  }

  @Get(':id')
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.SPONSOR,
    PapelCodigo.PM,
    PapelCodigo.DIRETORIA,
  )
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projetos.get(id, user);
  }

  @Post()
  @Roles(PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD, PapelCodigo.PM)
  create(@Body() dto: CreateProjetoDto, @CurrentUser() user: AuthUser) {
    return this.projetos.create(dto, user);
  }

  @Post(':id/submeter')
  @Roles(PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD, PapelCodigo.PM)
  submeter(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projetos.submeterBusinessCase(id, user);
  }

  @Post(':id/premissas')
  @Roles(PapelCodigo.FINANCAS, PapelCodigo.ADMIN)
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
  @Roles(PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD)
  reatribuir(
    @Param('id') id: string,
    @Body() dto: ReatribuirDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projetos.reatribuirPm(id, dto.novoPmId, user, dto.motivo);
  }
}
