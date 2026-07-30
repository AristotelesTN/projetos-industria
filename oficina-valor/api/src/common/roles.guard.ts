import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser, isGerente } from './roles';

/** Qualquer usuário autenticado com o papel Gerente de Portfólio. */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Não autenticado');
    if (!isGerente(user)) {
      throw new ForbiddenException('Somente Gerente de Portfólio');
    }
    return true;
  }
}
