import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/roles';
import { PapelCodigo } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { email },
      include: { papeis: { include: { papel: true } } },
    });
    if (!user || !user.ativo) return null;
    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      papeis: user.papeis.map((p) => p.papel.codigo),
    };
  }

  async loginDev(email: string) {
    const user = await this.findByEmail(email);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      papeis: user.papeis,
    });
    return { accessToken: token, user };
  }

  async listDevUsers() {
    const users = await this.prisma.usuario.findMany({
      where: { ativo: true },
      include: { papeis: { include: { papel: true } } },
      orderBy: { email: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      nome: u.nome,
      papeis: u.papeis.map((p) => p.papel.codigo as PapelCodigo),
    }));
  }
}
