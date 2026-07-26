import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PapelCodigo } from '@prisma/client';
import { memoryStorage } from 'multer';
import { IntegracoesService } from './integracoes.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

@Controller('integracoes')
@UseGuards(DevAuthGuard, RolesGuard)
export class IntegracoesController {
  constructor(private readonly integracoes: IntegracoesService) {}

  @Post('legado')
  @Roles(PapelCodigo.ADMIN, PapelCodigo.VMO_LEAD)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  legado(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integracoes.importLegado(file.buffer, user);
  }
}
