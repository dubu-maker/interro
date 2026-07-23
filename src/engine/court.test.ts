import { describe, expect, it } from 'vitest';
import {
  judgeCourt,
  type CourtContext,
  type CourtDefinition,
  type CourtEndingCopy,
  type CourtOutcome,
  type CourtSubmission,
} from './court';

const ending = (
  title: string,
  win: boolean,
): CourtEndingCopy => ({
  title,
  summary: `${title} 요약`,
  epilogue: `${title} 에필로그`,
  win,
});

const endings: Record<CourtOutcome, CourtEndingCopy> = {
  TRUTH_CONVICTION: ending('진실의 유죄', true),
  SELF_SURRENDER: ending('스스로 한 자백', true),
  WRONGFUL_CONVICTION: ending('오판', false),
  ACQUITTAL_INSUFFICIENT: ending('증거 불충분 무죄', false),
  RELATIVE_EXCEPTION: ending('친족 특례', false),
  CHARGE_MISMATCH: ending('죄명 불일치', false),
  UNRESOLVED: ending('미제', false),
};

const definition: CourtDefinition = {
  candidates: [
    {
      id: 'NONE',
      label: '불기소',
      description: '누구도 재판에 넘기지 않는다.',
    },
    {
      id: 'FATHER',
      label: '김만철',
      description: '자백한 차량 소유자',
    },
    {
      id: 'DAUGHTER',
      label: '김서연',
      description: '차량 소유자의 딸',
    },
    {
      id: 'BYSTANDER',
      label: '제3자',
      description: '사건 기록에 등장한 다른 인물',
    },
  ],
  charges: [
    {
      id: 'HIT_AND_RUN',
      label: '도주치상',
      description: '사고 후 구호 없이 도주했다.',
    },
    {
      id: 'HARBORING',
      label: '범인도피',
      description: '실제 운전자를 숨겼다.',
    },
    {
      id: 'DAMAGE',
      label: '재물손괴',
      description: '차량을 손상했다.',
    },
  ],
  issues: [
    {
      id: 'I_SEAT',
      label: '운전자 신체 조건',
      description: '시트 위치가 자백자와 맞지 않는다.',
      kind: 'PHYSICAL',
      acceptedArguments: [
        {
          contradictionId: 'M_SEAT',
          requiredEvidenceIds: ['E_SEAT', 'F_SEAT'],
        },
      ],
    },
    {
      id: 'I_ALIBI',
      label: '사고 시각 알리바이',
      description: '자백자는 사고 현장에 있을 수 없었다.',
      kind: 'PHYSICAL',
      acceptedArguments: [
        {
          contradictionId: 'M_ALIBI',
          requiredEvidenceIds: ['E_CARD', 'F_CCTV'],
        },
      ],
    },
    {
      id: 'I_ROUTE',
      label: '도주 동선',
      description: '자백자의 운전 습관과 맞지 않는다.',
      kind: 'SUPPORTING',
      acceptedArguments: [
        {
          contradictionId: 'M_ROUTE',
          requiredEvidenceIds: ['F_ROUTE'],
        },
      ],
    },
    {
      id: 'I_PROBE',
      label: '비공개 정보',
      description: '현장 세부를 알지 못했다.',
      kind: 'SUPPORTING',
      acceptedArguments: [
        {
          contradictionId: 'M_PROBE',
          requiredEvidenceIds: ['R_PROBE'],
        },
      ],
    },
  ],
  correctAccusedId: 'DAUGHTER',
  correctChargeId: 'HIT_AND_RUN',
  noProsecutionCandidateId: 'NONE',
  coverConfessorId: 'FATHER',
  relativeExceptionChargeId: 'HARBORING',
  minimumIssues: 3,
  requiredIssueKinds: ['PHYSICAL'],
  endings,
};

const context: CourtContext = {
  confirmedContradictionIds: ['M_SEAT', 'M_ROUTE', 'M_PROBE'],
  acquiredEvidenceIds: [
    'E_SEAT',
    'F_SEAT',
    'F_ROUTE',
    'R_PROBE',
  ],
  sincerity: false,
};

const validArguments = [
  {
    issueId: 'I_SEAT',
    contradictionId: 'M_SEAT',
    evidenceIds: ['E_SEAT', 'F_SEAT'],
  },
  {
    issueId: 'I_ROUTE',
    contradictionId: 'M_ROUTE',
    evidenceIds: ['F_ROUTE'],
  },
  {
    issueId: 'I_PROBE',
    contradictionId: 'M_PROBE',
    evidenceIds: ['R_PROBE'],
  },
] as const;

function submission(
  overrides: Partial<CourtSubmission> = {},
): CourtSubmission {
  return {
    candidateId: 'DAUGHTER',
    chargeId: 'HIT_AND_RUN',
    arguments: validArguments,
    ...overrides,
  };
}

describe('법정 판정 우선순위', () => {
  it('불기소를 가장 먼저 미제 사건으로 판정한다', () => {
    const verdict = judgeCourt(
      definition,
      submission({
        candidateId: 'NONE',
        chargeId: 'HIT_AND_RUN',
      }),
      context,
    );
    expect(verdict.outcome).toBe('UNRESOLVED');
    expect(verdict.win).toBe(false);
  });

  it('보호 자백자에게 친족 특례 죄명을 적용하면 별도 결말이 나온다', () => {
    const verdict = judgeCourt(
      definition,
      submission({
        candidateId: 'FATHER',
        chargeId: 'HARBORING',
      }),
      context,
    );
    expect(verdict.outcome).toBe('RELATIVE_EXCEPTION');
  });

  it('보호 자백자를 도주 운전자로 기소하면 오판이다', () => {
    const verdict = judgeCourt(
      definition,
      submission({
        candidateId: 'FATHER',
        chargeId: 'HIT_AND_RUN',
      }),
      context,
    );
    expect(verdict.outcome).toBe('WRONGFUL_CONVICTION');
  });

  it('제3자를 기소하면 증거와 죄명에 앞서 오인 기소로 판정한다', () => {
    const verdict = judgeCourt(
      definition,
      submission({
        candidateId: 'BYSTANDER',
        chargeId: 'DAMAGE',
        arguments: [],
      }),
      context,
    );
    expect(verdict.outcome).toBe('WRONGFUL_CONVICTION');
  });

  it('진범을 골라도 죄명이 틀리면 죄명 불일치다', () => {
    const verdict = judgeCourt(
      definition,
      submission({ chargeId: 'DAMAGE' }),
      context,
    );
    expect(verdict.outcome).toBe('CHARGE_MISMATCH');
  });

  it('알 수 없는 기소 대상은 데이터 오류로 거절한다', () => {
    expect(() =>
      judgeCourt(
        definition,
        submission({ candidateId: 'NO_PERSON' }),
        context,
      ),
    ).toThrow('알 수 없는 기소 대상');
  });
});

describe('법정 논거 검증과 승리 분기', () => {
  it('확정 모순·입수 증거·허용 조합을 모두 갖춘 서로 다른 이슈만 센다', () => {
    const verdict = judgeCourt(definition, submission(), context);
    expect(verdict.outcome).toBe('TRUTH_CONVICTION');
    expect(verdict.win).toBe(true);
    expect(verdict.satisfiedIssueIds).toEqual([
      'I_SEAT',
      'I_ROUTE',
      'I_PROBE',
    ]);
    expect(verdict.rejectedArgumentIndexes).toEqual([]);
    expect(verdict.copy.title).toBe('진실의 유죄');
  });

  it('같은 이슈를 여러 번 내도 최소 이슈 수를 부풀리지 못한다', () => {
    const duplicated = [
      validArguments[0],
      validArguments[0],
      validArguments[1],
    ];
    const verdict = judgeCourt(
      definition,
      submission({ arguments: duplicated }),
      context,
    );
    expect(verdict.satisfiedIssueIds).toEqual(['I_SEAT', 'I_ROUTE']);
    expect(verdict.outcome).toBe('ACQUITTAL_INSUFFICIENT');
  });

  it('확정되지 않은 모순은 증거가 있어도 논거가 되지 않는다', () => {
    const verdict = judgeCourt(
      definition,
      submission({
        arguments: [
          validArguments[0],
          validArguments[1],
          {
            issueId: 'I_ALIBI',
            contradictionId: 'M_ALIBI',
            evidenceIds: ['E_CARD', 'F_CCTV'],
          },
        ],
      }),
      {
        ...context,
        acquiredEvidenceIds: [
          ...context.acquiredEvidenceIds,
          'E_CARD',
          'F_CCTV',
        ],
      },
    );
    expect(verdict.rejectedArgumentIndexes).toEqual([2]);
    expect(verdict.outcome).toBe('ACQUITTAL_INSUFFICIENT');
  });

  it('입수하지 않은 증거, 빠진 증거, 허용되지 않은 여분 증거를 거절한다', () => {
    const badArguments = [
      {
        issueId: 'I_SEAT',
        contradictionId: 'M_SEAT',
        evidenceIds: ['E_SEAT'],
      },
      {
        issueId: 'I_ROUTE',
        contradictionId: 'M_ROUTE',
        evidenceIds: ['F_ROUTE', 'E_SEAT'],
      },
      {
        issueId: 'I_PROBE',
        contradictionId: 'M_PROBE',
        evidenceIds: ['R_NOT_ACQUIRED'],
      },
    ];
    const verdict = judgeCourt(
      definition,
      submission({ arguments: badArguments }),
      context,
    );
    expect(verdict.satisfiedIssueIds).toEqual([]);
    expect(verdict.rejectedArgumentIndexes).toEqual([0, 1, 2]);
    expect(verdict.outcome).toBe('ACQUITTAL_INSUFFICIENT');
  });

  it('최소 수를 채워도 필수 물리 이슈가 없으면 증거 불충분이다', () => {
    const supportingDefinition: CourtDefinition = {
      ...definition,
      minimumIssues: 2,
    };
    const verdict = judgeCourt(
      supportingDefinition,
      submission({
        arguments: [validArguments[1], validArguments[2]],
      }),
      context,
    );
    expect(verdict.satisfiedIssueIds).toEqual(['I_ROUTE', 'I_PROBE']);
    expect(verdict.outcome).toBe('ACQUITTAL_INSUFFICIENT');
  });

  it('논거 충족 후 sincerity가 있으면 자수 결말을 우선한다', () => {
    const verdict = judgeCourt(definition, submission(), {
      ...context,
      sincerity: true,
    });
    expect(verdict.outcome).toBe('SELF_SURRENDER');
    expect(verdict.win).toBe(true);
    expect(verdict.copy.epilogue).toContain('스스로 한 자백');
  });
});
