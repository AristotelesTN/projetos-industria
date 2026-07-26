import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PapelCodigo } from '@prisma/client';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { memoryStorage } from 'multer';
import { CustosService } from './custos.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

class CustoDto {
  @IsString()
  periodoReferencia!: string;

  @IsNumber()
  @Min(0)
  valor!: number;

  @IsOptional()
  @IsString()
  centroCustoCodigo?: string;
}

@Controller()
@UseGuards(DevAuthGuard, RolesGuard)
export class CustosController {
  constructor(private readonly custos: CustosService) {}

  @Post('projetos/:id/custos')
  @Roles(PapelCodigo.FINANCAS, PapelCodigo.ADMIN)
  add(
    @Param('id') id: string,
    @Body() dto: CustoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.custos.adicionar(id, dto, user);
  }

  @Post('integracoes/erp/custos')
  @Roles(PapelCodigo.FINANCAS, PapelCodigo.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.custos.importCsv(file.buffer, user);
  }
}
