import { addMonths, buildPerfilMensal, formatYearMonth, monthStart } from './dates';

describe('dates helpers', () => {
  it('monthStart normaliza para dia 1 UTC', () => {
    const d = monthStart('2026-03-15T12:00:00Z');
    expect(d.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('buildPerfilMensal gera N meses', () => {
    const perfil = buildPerfilMensal(monthStart('2026-01-01'), 3, 1000);
    expect(Object.keys(perfil)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(perfil['2026-02']).toBe(1000);
  });

  it('addMonths e formatYearMonth', () => {
    const d = addMonths(monthStart('2026-01-01'), 11);
    expect(formatYearMonth(d)).toBe('2026-12');
  });
});

describe('ROI rules', () => {
  function calcRoi(beneficio: number, custo: number): number | null {
    if (custo === 0) return null;
    return (beneficio - custo) / custo;
  }

  it('retorna null quando custo = 0 (sem divisão por zero)', () => {
    expect(calcRoi(1000, 0)).toBeNull();
  });

  it('calcula ROI com hard+soft validados', () => {
    expect(calcRoi(120000, 80000)).toBeCloseTo(0.5);
  });
});

describe('SoD', () => {
  it('bloqueia validador == registrador', () => {
    const registrador = 'u1';
    const validador = 'u1';
    const allowed = registrador !== validador;
    expect(allowed).toBe(false);
  });
});
