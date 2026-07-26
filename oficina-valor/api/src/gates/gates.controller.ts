import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { GateDecisaoTipo, GateTipo, PapelCodigo } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { GatesService } from './gates.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

class GateDto {
  @IsEnum(GateTipo)
  gate!: GateTipo;

  @IsEnum(GateDecisaoTipo)
  decisao!: GateDecisaoTipo;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  @IsString()
  ataUrl?: string;
}

@Controller('projetos/:id/gates')
@UseGuards(DevAuthGuard, RolesGuard)
export class GatesController {
  constructor(private readonly gates: GatesService) {}

  @Post()
  @Roles(
    PapelCodigo.VMO_LEAD,
    PapelCodigo.SPONSOR,
    PapelCodigo.DIRETORIA,
    PapelCodigo.ADMIN,
  )
  decidir(
    @Param('id') id: string,
    @Body() dto: GateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gates.decidir(id, dto, user);
  }
}
