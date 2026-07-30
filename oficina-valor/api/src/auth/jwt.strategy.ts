import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { PapelCodigo } from '@prisma/client';

type JwtPayload = {
  sub: string;
  email: string;
  papeis: PapelCodigo[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-oficina-valor-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.auth.findByEmail(payload.email);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
