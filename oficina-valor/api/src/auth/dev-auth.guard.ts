import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

/**
 * Aceita Bearer JWT ou header X-Dev-User (e-mail) quando AUTH_MODE=dev.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = await this.jwt.verifyAsync<{ email: string }>(token);
        const user = await this.auth.findByEmail(payload.email);
        if (!user) throw new UnauthorizedException();
        req.user = user;
        return true;
      } catch {
        // Em dev, JWT expirado/stale → tenta X-Dev-User antes de falhar
        if ((process.env.AUTH_MODE ?? 'dev') === 'dev') {
          const email = req.headers['x-dev-user'] as string | undefined;
          if (email) {
            const user = await this.auth.findByEmail(email);
            if (user) {
              req.user = user;
              return true;
            }
          }
        }
        throw new UnauthorizedException('Token inválido');
      }
    }

    if ((process.env.AUTH_MODE ?? 'dev') === 'dev') {
      const email = req.headers['x-dev-user'] as string | undefined;
      if (email) {
        const user = await this.auth.findByEmail(email);
        if (!user) throw new UnauthorizedException('X-Dev-User inválido');
        req.user = user;
        return true;
      }
    }

    throw new UnauthorizedException('Autenticação obrigatória');
  }
}
