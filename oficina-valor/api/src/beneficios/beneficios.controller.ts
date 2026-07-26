import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { BeneficiosService } from './beneficios.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

class BaselineDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMensalEsperado?: number;

  @IsOptional()
  @IsNumber()
  janelaMeses?: number;
}

class OwnerDto {
  @IsUUID()
  novoOwnerId!: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

@Controller('beneficios')
@UseGuards(DevAuthGuard, RolesGuard)
export class BeneficiosController {
  constructor(private readonly beneficios: BeneficiosService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.beneficios.get(id);
  }

  @Post(':id/baseline')
  baseline(
    @Param('id') id: string,
    @Body() dto: BaselineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.beneficios.criarBaselineProposta(id, user, dto);
  }

  @Patch(':id/owner')
  owner(
    @Param('id') id: string,
    @Body() dto: OwnerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.beneficios.reatribuirOwner(
      id,
      dto.novoOwnerId,
      user,
      dto.motivo,
    );
  }
}
