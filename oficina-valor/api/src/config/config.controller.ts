import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { PapelCodigo } from '@prisma/client';
import { IsNumber, IsObject, IsOptional } from 'class-validator';
import { ConfigService } from './config.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

class UpdateConfigDto {
  @IsOptional()
  @IsNumber()
  janelaSavingsPadrao?: number;

  @IsOptional()
  @IsNumber()
  limiarLeanInvestimento?: number;

  @IsOptional()
  @IsObject()
  pesosScoring?: Record<string, number>;
}

@Controller('config')
@UseGuards(DevAuthGuard, RolesGuard)
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Roles(
    PapelCodigo.ADMIN,
    PapelCodigo.VMO_LEAD,
    PapelCodigo.FINANCAS,
    PapelCodigo.DIRETORIA,
    PapelCodigo.SPONSOR,
    PapelCodigo.PM,
  )
  get() {
    return this.config.get();
  }

  @Patch()
  @Roles(PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD)
  update(@Body() dto: UpdateConfigDto, @CurrentUser() user: AuthUser) {
    return this.config.update(dto, user.id);
  }
}
