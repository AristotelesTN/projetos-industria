import { PapelCodigo } from '@prisma/client';

/** Único papel do MVP: Gerente de Portfólio gerencia tudo. */
export const GERENTE = PapelCodigo.GERENTE_PORTFOLIO;

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  papeis: PapelCodigo[];
};

export function isGerente(user: AuthUser): boolean {
  return user.papeis.includes(GERENTE);
}
