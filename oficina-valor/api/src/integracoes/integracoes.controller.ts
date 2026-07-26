import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IntegracoesService } from './integracoes.service';
import { DevAuthGuard } from '../auth/dev-auth.guard';
import { CurrentUser } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { AuthUser } from '../common/roles';

@Controller('integracoes')
@UseGuards(DevAuthGuard, RolesGuard)
export class IntegracoesController {
  constructor(private readonly integracoes: IntegracoesService) {}

  @Post('legado')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  legado(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integracoes.importLegado(file.buffer, user);
  }
}
