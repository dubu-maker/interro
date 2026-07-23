import { describe, expect, it } from 'vitest';
import {
  canStartForensics,
  commitForensicSelection,
  createPsychologyTrialState,
  enterCourt,
  resolveConfrontation,
  resolveFinale,
  resolveProbe,
  resolveStatementCommitments,
  toggleForensicOption,
  type PsychologyTrialDefinition,
  type PsychologyTrialState,
} from './psychologyTrial';

const definition: PsychologyTrialDefinition = {
  minimumTurnsBeforeForensics: 3,
  forensicSelectionCount: 2,
  forensicOptions: [
    {
      id: 'F_SEAT',
      evidenceId: 'E_SEAT_TEST',
      label: '시트 재연',
      description: '운전석 위치를 재연한다.',
      resolution: 'COMBINATION',
      targetContradictionId: 'M_SEAT',
      requiredEvidenceIds: ['E_SEAT_INITIAL'],
      opportunityCost: '운전석 모순 경로를 포기한다.',
    },
    {
      id: 'F_CCTV',
      evidenceId: 'E_CCTV',
      label: '식당 CCTV',
      description: '결제 전후 동선을 확인한다.',
      resolution: 'COMBINATION',
      targetContradictionId: 'M_SEAT',
      requiredEvidenceIds: ['E_SEAT_INITIAL'],
      opportunityCost: '알리바이 모순 경로를 포기한다.',
    },
    {
      id: 'F_ROUTE',
      evidenceId: 'E_ROUTE',
      label: '도주 동선',
      description: '차량 이동 경로를 복원한다.',
      resolution: 'DIRECT',
      targetContradictionId: 'M_ROUTE',
      requiredEvidenceIds: [],
      opportunityCost: '도주 동선 모순 경로를 포기한다.',
    },
  ],
  probes: [
    {
      id: 'P_SCENE',
      evidenceId: 'E_SCENE',
      question: '현장에 무엇이 있었습니까?',
      reactionLine: '경황이 없어 기억나지 않습니다.',
      resultEvidenceId: 'R_PROBE',
      contradictionId: 'M_PROBE',
    },
  ],
  contradictions: [
    {
      id: 'M_SEAT',
      label: '시트 위치의 물리적 불가능',
      kind: 'PHYSICAL',
      requiredClaimIds: ['C_SEAT'],
      evidencePaths: [['E_SEAT_INITIAL', 'E_SEAT_TEST']],
      recordEvidenceId: 'R_SEAT',
      commitment: {
        claimIds: ['C_SEAT'],
        notice: '시트 주장을 재확인했다.',
      },
    },
    {
      id: 'M_ROUTE',
      label: '도주 동선 불일치',
      kind: 'SUPPORTING',
      requiredClaimIds: ['C_HOME'],
      evidencePaths: [['E_ROUTE']],
      recordEvidenceId: 'R_ROUTE',
      commitment: {
        claimIds: ['C_HOME'],
        notice: '귀가 동선을 재확인했다.',
      },
    },
    {
      id: 'M_PROBE',
      label: '비공개 정보 떠보기 실패',
      kind: 'SUPPORTING',
      requiredClaimIds: ['C_SCENE'],
      evidencePaths: [['R_PROBE']],
      recordEvidenceId: 'R_PROBE',
    },
  ],
  stageRules: [
    { stageId: 'PATCHING', minimumContradictions: 1 },
    { stageId: 'RIGID', minimumContradictions: 2 },
    {
      stageId: 'COLLAPSE',
      minimumContradictions: 3,
      minimumPhysicalContradictions: 1,
    },
  ],
  initialStageId: 'CONFESSION',
  finaleStageId: 'COLLAPSE',
  sincereStageId: 'SINCERE',
  finaleAnchorLine: '형사님은 자식 있습니까.',
  finaleChoices: [
    {
      id: 'EMPATHY',
      label: '아버지의 마음을 이해한다고 답한다.',
      responseLine: '그래도 아이가 책임질 기회는 남겨야 합니다.',
      sincerity: true,
    },
    {
      id: 'DUTY',
      label: '수사 원칙만 말한다.',
      responseLine: '사실대로 말씀하십시오.',
      sincerity: false,
    },
  ],
  autoEvidenceUnlocks: [
    {
      evidenceId: 'E_AUTO',
      minimumContradictions: 2,
      minimumPhysicalContradictions: 1,
    },
  ],
};

function stateWith(
  overrides: Partial<PsychologyTrialState>,
): PsychologyTrialState {
  return { ...createPsychologyTrialState(definition), ...overrides };
}

describe('심리·법정 사건 상태 생성과 감식 선택', () => {
  it('첫 심문 세션과 초기 방어 단계에서 시작한다', () => {
    expect(createPsychologyTrialState(definition)).toEqual({
      phase: 'SESSION_ONE',
      selectedForensicOptionIds: [],
      presentedEvidenceIds: [],
      usedProbeIds: [],
      failedProbeIds: [],
      lockedContradictionIds: [],
      confirmedContradictionIds: [],
      unlockedAutomaticEvidenceIds: [],
      triggeredSpecialEventIds: [],
      stageId: 'CONFESSION',
      sincerity: false,
    });
  });

  it('최소 턴 이후 첫 세션에서만 감식을 시작할 수 있다', () => {
    const state = createPsychologyTrialState(definition);
    expect(canStartForensics(definition, state, 2)).toBe(false);
    expect(canStartForensics(definition, state, 3)).toBe(true);
    expect(
      canStartForensics(
        definition,
        { ...state, phase: 'SESSION_TWO' },
        10,
      ),
    ).toBe(false);
  });

  it('감식 선택을 토글하며 슬롯 수를 넘기지 않는다', () => {
    const initial = createPsychologyTrialState(definition);
    const one = toggleForensicOption(definition, initial, 'F_SEAT');
    const two = toggleForensicOption(definition, one, 'F_CCTV');

    expect(two.selectedForensicOptionIds).toEqual(['F_SEAT', 'F_CCTV']);
    expect(() =>
      toggleForensicOption(definition, two, 'F_ROUTE'),
    ).toThrow('최대 2개');
    expect(
      toggleForensicOption(definition, two, 'F_SEAT')
        .selectedForensicOptionIds,
    ).toEqual(['F_CCTV']);
    expect(initial.selectedForensicOptionIds).toEqual([]);
  });

  it('정확한 수의 감식만 확정하고 선택 증거와 두 번째 세션을 반환한다', () => {
    const initial = createPsychologyTrialState(definition);
    const one = toggleForensicOption(definition, initial, 'F_SEAT');
    expect(() => commitForensicSelection(definition, one, 3)).toThrow(
      '정확히 2개',
    );

    const two = toggleForensicOption(definition, one, 'F_ROUTE');
    expect(() => commitForensicSelection(definition, two, 2)).toThrow(
      '심문 3턴 이후',
    );
    const result = commitForensicSelection(definition, two, 3);
    expect(result.evidenceIds).toEqual(['E_SEAT_TEST', 'E_ROUTE']);
    expect(result.state.phase).toBe('SESSION_TWO');
  });

  it('알 수 없는 감식과 첫 세션 이후 선택을 거절한다', () => {
    const initial = createPsychologyTrialState(definition);
    expect(() =>
      toggleForensicOption(definition, initial, 'NO_OPTION'),
    ).toThrow('알 수 없는 감식');
    expect(() =>
      toggleForensicOption(
        definition,
        { ...initial, phase: 'SESSION_TWO' },
        'F_SEAT',
      ),
    ).toThrow('선택할 수 없는 단계');
  });
});

describe('추궁·떠보기와 심리 단계', () => {
  it('claim과 한 evidence path가 모두 갖춰져야 모순을 확정한다', () => {
    let state = stateWith({ phase: 'SESSION_TWO' });
    let result = resolveConfrontation(definition, state, {
      presentedEvidenceId: 'E_SEAT_INITIAL',
      recordedClaimIds: ['C_SEAT'],
    });
    expect(result.newlyConfirmedContradictionIds).toEqual([]);
    expect(result.impact).toBe('COMMITMENT_LOCKED');
    expect(result.newlyLockedContradictionIds).toEqual(['M_SEAT']);
    expect(result.state.lockedContradictionIds).toEqual(['M_SEAT']);

    result = resolveConfrontation(definition, result.state, {
      presentedEvidenceId: 'E_SEAT_TEST',
      recordedClaimIds: ['C_SEAT'],
    });
    expect(result.newlyConfirmedContradictionIds).toEqual(['M_SEAT']);
    expect(result.impact).toBe('CONFIRMED');
    expect(result.state.lockedContradictionIds).toEqual([]);
    expect(result.recordEvidenceIds).toEqual(['R_SEAT']);
    expect(result.state.stageId).toBe('PATCHING');
    expect(result.state.presentedEvidenceIds).toEqual([
      'E_SEAT_INITIAL',
      'E_SEAT_TEST',
    ]);
  });

  it('관련 없는 증거는 고착이나 확정 없이 효과 없음으로 판정한다', () => {
    const result = resolveConfrontation(
      definition,
      stateWith({ phase: 'SESSION_TWO' }),
      {
        presentedEvidenceId: 'E_UNRELATED',
        recordedClaimIds: ['C_SEAT'],
      },
    );

    expect(result.impact).toBe('NO_EFFECT');
    expect(result.newlyLockedContradictionIds).toEqual([]);
    expect(result.newlyConfirmedContradictionIds).toEqual([]);
  });

  it('질문으로 주장을 재확인하면 물증 전 잠긴 모순을 만든다', () => {
    const result = resolveStatementCommitments(
      definition,
      stateWith({ phase: 'SESSION_TWO' }),
      ['C_HOME'],
      ['C_HOME'],
    );

    expect(result.impact).toBe('COMMITMENT_LOCKED');
    expect(result.state.lockedContradictionIds).toEqual(['M_ROUTE']);
    expect(result.state.confirmedContradictionIds).toEqual([]);
    expect(result.automaticEvidenceIds).toEqual([]);
  });

  it('특수 증거는 모순 수와 무관하게 저작 사건과 피날레를 연다', () => {
    const specialDefinition: PsychologyTrialDefinition = {
      ...definition,
      automaticFinaleAtStage: false,
      specialConfrontations: [
        {
          id: 'SPECIAL_DRIVER',
          evidenceId: 'E_SPECIAL',
          targetStageId: 'COLLAPSE',
          targetPhase: 'FINALE',
          notice: '보호 대상 특정',
          reactionLine: '이름은 빼 주십시오.',
        },
      ],
    };
    const result = resolveConfrontation(
      specialDefinition,
      stateWith({ phase: 'SESSION_TWO' }),
      {
        presentedEvidenceId: 'E_SPECIAL',
        recordedClaimIds: [],
      },
    );

    expect(result.impact).toBe('SPECIAL_EVENT');
    expect(result.specialEvent?.id).toBe('SPECIAL_DRIVER');
    expect(result.state).toMatchObject({
      phase: 'FINALE',
      stageId: 'COLLAPSE',
      triggeredSpecialEventIds: ['SPECIAL_DRIVER'],
      confirmedContradictionIds: [],
    });

    const replay = resolveConfrontation(
      specialDefinition,
      { ...result.state, phase: 'SESSION_TWO' },
      {
        presentedEvidenceId: 'E_SPECIAL',
        recordedClaimIds: [],
      },
    );
    expect(replay.impact).toBe('NO_EFFECT');
    expect(replay.specialEvent).toBeUndefined();
  });

  it('같은 모순과 제시 증거를 중복 기록하지 않는다', () => {
    const initial = stateWith({
      phase: 'SESSION_TWO',
      presentedEvidenceIds: ['E_SEAT_INITIAL'],
    });
    const first = resolveConfrontation(definition, initial, {
      presentedEvidenceId: 'E_SEAT_TEST',
      recordedClaimIds: ['C_SEAT'],
    });
    const second = resolveConfrontation(definition, first.state, {
      presentedEvidenceId: 'E_SEAT_TEST',
      recordedClaimIds: ['C_SEAT'],
    });

    expect(second.newlyConfirmedContradictionIds).toEqual([]);
    expect(second.recordEvidenceIds).toEqual([]);
    expect(second.state.confirmedContradictionIds).toEqual(['M_SEAT']);
    expect(second.state.presentedEvidenceIds).toEqual([
      'E_SEAT_INITIAL',
      'E_SEAT_TEST',
    ]);
  });

  it('충족한 마지막 단계 규칙과 자동 증거 해금을 적용한다', () => {
    const initial = stateWith({
      phase: 'SESSION_TWO',
      presentedEvidenceIds: ['E_SEAT_INITIAL', 'E_SEAT_TEST'],
      confirmedContradictionIds: ['M_SEAT'],
      stageId: 'PATCHING',
    });
    const result = resolveConfrontation(definition, initial, {
      presentedEvidenceId: 'E_ROUTE',
      recordedClaimIds: ['C_SEAT', 'C_HOME'],
    });

    expect(result.newlyConfirmedContradictionIds).toEqual(['M_ROUTE']);
    expect(result.state.stageId).toBe('RIGID');
    expect(result.automaticEvidenceIds).toEqual(['E_AUTO']);
    expect(result.unlockedEvidenceIds).toEqual(['R_ROUTE', 'E_AUTO']);
    expect(result.state.unlockedAutomaticEvidenceIds).toEqual(['E_AUTO']);
  });

  it('떠보기는 한 번만 사용하고 연결된 모순과 반응 기록을 확정한다', () => {
    const initial = stateWith({
      phase: 'SESSION_TWO',
      confirmedContradictionIds: ['M_SEAT', 'M_ROUTE'],
      stageId: 'RIGID',
      unlockedAutomaticEvidenceIds: ['E_AUTO'],
    });
    const result = resolveProbe(
      definition,
      initial,
      'P_SCENE',
      ['C_SCENE'],
    );

    expect(result.reactionLine).toContain('기억나지');
    expect(result.resultEvidenceId).toBe('R_PROBE');
    expect(result.newlyConfirmedContradictionIds).toEqual(['M_PROBE']);
    expect(result.recordEvidenceIds).toEqual(['R_PROBE']);
    expect(result.state.usedProbeIds).toEqual(['P_SCENE']);
    expect(result.state.failedProbeIds).toEqual(['P_SCENE']);
    expect(result.state.presentedEvidenceIds).toContain('E_SCENE');
    expect(result.state.stageId).toBe('COLLAPSE');
    expect(result.state.phase).toBe('FINALE');
    expect(() =>
      resolveProbe(definition, result.state, 'P_SCENE', ['C_SCENE']),
    ).toThrow('떠보기할 수 없는 단계');
  });

  it('이미 확정된 떠보기 모순은 중복하지 않아도 결과 기록은 돌려준다', () => {
    const initial = stateWith({
      phase: 'SESSION_TWO',
      confirmedContradictionIds: ['M_PROBE'],
    });
    const result = resolveProbe(definition, initial, 'P_SCENE', []);

    expect(result.newlyConfirmedContradictionIds).toEqual([]);
    expect(result.recordEvidenceIds).toEqual(['R_PROBE']);
  });

  it('필요한 진술이 기록되지 않았으면 떠보기 반응만 남기고 모순은 확정하지 않는다', () => {
    const initial = stateWith({ phase: 'SESSION_TWO' });
    const result = resolveProbe(definition, initial, 'P_SCENE', []);

    expect(result.newlyConfirmedContradictionIds).toEqual([]);
    expect(result.recordEvidenceIds).toEqual(['R_PROBE']);
    expect(result.state.confirmedContradictionIds).toEqual([]);
    expect(result.state.usedProbeIds).toEqual(['P_SCENE']);
  });

  it('피날레 선택으로 sincerity와 법정 단계를 결정한다', () => {
    const finale = stateWith({
      phase: 'FINALE',
      stageId: 'COLLAPSE',
    });
    const sincere = resolveFinale(definition, finale, 'EMPATHY');
    expect(sincere.state).toMatchObject({
      phase: 'COURT',
      stageId: 'SINCERE',
      sincerity: true,
    });
    expect(sincere.responseLine).toContain('책임질 기회');

    const procedural = resolveFinale(definition, finale, 'DUTY');
    expect(procedural.state).toMatchObject({
      phase: 'COURT',
      stageId: 'COLLAPSE',
      sincerity: false,
    });
  });

  it('두 번째 세션에서는 피날레 전에 법정으로 바로 이동할 수 있다', () => {
    const second = stateWith({ phase: 'SESSION_TWO' });
    expect(enterCourt(definition, second).phase).toBe('COURT');
    expect(enterCourt(definition, { ...second, phase: 'COURT' }).phase).toBe(
      'COURT',
    );
    expect(() =>
      enterCourt(definition, { ...second, phase: 'FINALE' }),
    ).toThrow('법정으로 이동할 수 없는 단계');
  });
});
