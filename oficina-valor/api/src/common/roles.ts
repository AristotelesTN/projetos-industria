import { PapelCodigo } from '@prisma/client';

export const ALL_ROLES = Object.values(PapelCodigo);

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  papeis: PapelCodigo[];
};

export function hasAnyRole(user: AuthUser, roles: PapelCodigo[]): boolean {
  return user.papeis.some((p) => roles.includes(p));
}
