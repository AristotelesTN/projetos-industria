/** Normaliza para o 1º dia do mês (UTC date-only). */
export function monthStart(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function formatYearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Distribui valor total igualmente em N meses (perfil mensal da baseline). */
export function buildPerfilMensal(
  inicio: Date,
  meses: number,
  valorMensal: number,
): Record<string, number> {
  const perfil: Record<string, number> = {};
  for (let i = 0; i < meses; i++) {
    const key = formatYearMonth(addMonths(inicio, i));
    perfil[key] = Number(valorMensal);
  }
  return perfil;
}
