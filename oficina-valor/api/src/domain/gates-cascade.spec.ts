import { BeneficioStatus, MedicaoStatus, ProjetoStatus } from '@prisma/client';

/** Espelha regras RF-10b usadas em GatesService (teste de especificação). */
function applyKill(state: {
  projetoStatus: ProjetoStatus;
  beneficios: { status: BeneficioStatus }[];
  medicoes: { status: MedicaoStatus }[];
}) {
  state.projetoStatus = ProjetoStatus.morto;
  state.beneficios = state.beneficios.map((b) =>
    b.status === BeneficioStatus.em_captura ||
    b.status === BeneficioStatus.planejado
      ? { status: BeneficioStatus.cancelado }
      : b,
  );
  const arquivaveis: MedicaoStatus[] = [
    MedicaoStatus.rascunho,
    MedicaoStatus.pendente_validacao,
    MedicaoStatus.rejeitada,
  ];
  state.medicoes = state.medicoes.map((m) =>
    arquivaveis.includes(m.status)
      ? { status: MedicaoStatus.arquivada }
      : m,
  );
  return state;
}

describe('cascata Kill/Hold', () => {
  it('Kill cancela captura e arquiva pendentes; validados permanecem', () => {
    const result = applyKill({
      projetoStatus: ProjetoStatus.execucao,
      beneficios: [
        { status: BeneficioStatus.em_captura },
        { status: BeneficioStatus.incorporado },
      ],
      medicoes: [
        { status: MedicaoStatus.pendente_validacao },
        { status: MedicaoStatus.validada },
      ],
    });
    expect(result.projetoStatus).toBe(ProjetoStatus.morto);
    expect(result.beneficios[0].status).toBe(BeneficioStatus.cancelado);
    expect(result.beneficios[1].status).toBe(BeneficioStatus.incorporado);
    expect(result.medicoes[0].status).toBe(MedicaoStatus.arquivada);
    expect(result.medicoes[1].status).toBe(MedicaoStatus.validada);
  });
});
