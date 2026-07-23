import { describe, expect, it } from 'vitest';
import { createContractState } from '../../engine/contract';
import { judgeCourt, type CourtSubmission } from '../../engine/court';
import {
  commitForensicSelection,
  createPsychologyTrialState,
  resolveConfrontation,
  resolveFinale,
  resolveProbe,
  toggleForensicOption,
} from '../../engine/psychologyTrial';
import { kimMancheolContract } from './contract';
import { case2 } from './index';

function requireTrial() {
  const trial = case2.psychologyTrial;
  if (!trial) throw new Error('case2 심리 진행 규칙이 없습니다.');
  return trial;
}

function requireCourt() {
  const court = case2.court;
  if (!court) throw new Error('case2 법정 규칙이 없습니다.');
  return court;
}

describe('사건 2 콘텐츠', () => {
  it('현장 없이 심문에서 시작하고 초기 수사 파일 E01~E06을 지급한다', () => {
    expect(case2.id).toBe('case2');
    expect(case2.title).toBe('23:47 — 완벽한 자백');
    expect(case2.scene).toBeUndefined();
    expect(case2.initialEvidenceIds).toEqual([
      'E01',
      'E02',
      'E03',
      'E04',
      'E05',
      'E06',
    ]);
    expect(case2.initialSuspectIds).toEqual(['mancheol']);
    expect(case2.briefing).toContain('택시를 타고');
  });

  it('모든 증거 ID가 유일하고 감식·자동 영장·모순 기록을 포함한다', () => {
    const evidenceIds = case2.evidences.map((entry) => entry.id);
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);
    expect(evidenceIds).toEqual(
      expect.arrayContaining([
        'F01',
        'F02',
        'F03',
        'F04',
        'F05',
        'F06',
        'R_M6',
        'M1',
        'M2',
        'M3',
        'M4',
        'M6',
      ]),
    );
    expect(case2.evidences.every((entry) => entry.view.type !== 'scene')).toBe(
      true,
    );
    for (const evidence of case2.evidences) {
      if (evidence.view.type === 'document') {
        expect(evidence.view.title, evidence.id).toBeTruthy();
      }
    }
  });

  it('자수 조서의 네 진술을 모델 출력과 무관하게 0턴에 기록한다', () => {
    const state = createContractState(kimMancheolContract);
    expect(state.statements).toEqual([
      { claimId: 'C_I_DROVE', turn: 0, status: 'UNVERIFIED' },
      { claimId: 'C_RIDER_RIGHT', turn: 0, status: 'UNVERIFIED' },
      { claimId: 'C_HOME_DIRECT', turn: 0, status: 'UNVERIFIED' },
      { claimId: 'C_SOBER', turn: 0, status: 'UNVERIFIED' },
    ]);
  });

  it('붕괴 전 단계에는 딸의 운전·음주 진실을 허용하지 않는다', () => {
    const sealedClaimIds = new Set([
      'C_DAUGHTER_DROVE',
      'C_DAUGHTER_DRANK',
      'C_FALSE_CONFESSION_FOR_DAUGHTER',
    ]);
    const preSincereStages = kimMancheolContract.stages.filter(
      (stage) => stage.id !== 'ST_SINCERE',
    );

    for (const stage of preSincereStages) {
      expect(
        stage.allowedClaimIds.some((id) => sealedClaimIds.has(id)),
        `${stage.id}에서 딸의 진실이 노출됨`,
      ).toBe(false);
    }

    const sincere = kimMancheolContract.stages.find(
      (stage) => stage.id === 'ST_SINCERE',
    );
    expect(sincere?.allowedClaimIds).toEqual(
      expect.arrayContaining([...sealedClaimIds]),
    );
    expect(kimMancheolContract.sealedTerms).toEqual([
      '떡볶이',
      '빨간 국물',
    ]);

    const preSincerePromptSurface = [
      case2.suspects[0]?.persona ?? '',
      ...preSincereStages.map((stage) => stage.strategy),
    ].join('\n');
    expect(preSincerePromptSurface).not.toMatch(
      /김서연.{0,12}(?:운전|몰)|딸.{0,8}운전|음주.{0,8}딸/,
    );
  });

  it('계약의 단계·힌트·초기 진술이 존재하는 claim과 evidence만 참조한다', () => {
    const claimIds = new Set(
      kimMancheolContract.claims.map((claim) => claim.id),
    );
    const evidenceIds = new Set(case2.evidences.map((entry) => entry.id));
    const stageIds = new Set(
      kimMancheolContract.stages.map((stage) => stage.id),
    );
    const topicIds = new Set(
      (kimMancheolContract.claimTopics ?? []).map((topic) => topic.id),
    );

    for (const stage of kimMancheolContract.stages) {
      for (const claimId of stage.allowedClaimIds) {
        expect(claimIds.has(claimId), `${stage.id}: ${claimId}`).toBe(true);
      }
    }
    for (const claimId of kimMancheolContract.initialClaimIds ?? []) {
      expect(claimIds.has(claimId)).toBe(true);
    }
    for (const claim of kimMancheolContract.claims) {
      if (claim.topicId) {
        expect(topicIds.has(claim.topicId), `${claim.id}:${claim.topicId}`).toBe(
          true,
        );
        expect(claim.valueId, claim.id).toBeTruthy();
      }
    }
    for (const claimId of
      kimMancheolContract.position?.protectedClaimIds ?? []) {
      expect(claimIds.has(claimId), `보호 입장:${claimId}`).toBe(true);
    }
    for (const fact of
      kimMancheolContract.position?.undeniableFacts ?? []) {
      expect(claimIds.has(fact.claimId), `부인 불가:${fact.claimId}`).toBe(
        true,
      );
      for (const stageId of fact.stageIds) {
        expect(stageIds.has(stageId), `${fact.claimId}:${stageId}`).toBe(true);
      }
      for (const evidenceId of fact.evidenceIds ?? []) {
        expect(evidenceIds.has(evidenceId), `${fact.claimId}:${evidenceId}`).toBe(
          true,
        );
      }
    }
    for (const hint of kimMancheolContract.hints) {
      if (hint.targetClaimId) expect(claimIds.has(hint.targetClaimId)).toBe(true);
      if (hint.targetEvidenceId) {
        expect(evidenceIds.has(hint.targetEvidenceId)).toBe(true);
      }
    }
  });

  it('심리 진행과 법정 규칙의 모든 참조 ID가 실제 사건 데이터에 존재한다', () => {
    const trial = requireTrial();
    const court = requireCourt();
    const evidenceIds = new Set(case2.evidences.map((entry) => entry.id));
    const claimIds = new Set(
      kimMancheolContract.claims.map((entry) => entry.id),
    );
    const stageIds = new Set(
      kimMancheolContract.stages.map((entry) => entry.id),
    );
    const contradictionIds = new Set(
      trial.contradictions.map((entry) => entry.id),
    );

    for (const option of trial.forensicOptions) {
      expect(evidenceIds.has(option.evidenceId), option.id).toBe(true);
      if (option.targetContradictionId) {
        expect(
          contradictionIds.has(option.targetContradictionId),
          option.id,
        ).toBe(true);
      }
      for (const evidenceId of option.requiredEvidenceIds) {
        expect(evidenceIds.has(evidenceId), `${option.id}:${evidenceId}`).toBe(
          true,
        );
      }
    }
    for (const probe of trial.probes) {
      expect(evidenceIds.has(probe.evidenceId), probe.id).toBe(true);
      expect(evidenceIds.has(probe.resultEvidenceId), probe.id).toBe(true);
      expect(contradictionIds.has(probe.contradictionId), probe.id).toBe(true);
    }
    for (const contradiction of trial.contradictions) {
      expect(evidenceIds.has(contradiction.recordEvidenceId), contradiction.id).toBe(
        true,
      );
      for (const claimId of contradiction.requiredClaimIds) {
        expect(claimIds.has(claimId), `${contradiction.id}:${claimId}`).toBe(
          true,
        );
      }
      for (const claimId of contradiction.commitment?.claimIds ?? []) {
        expect(claimIds.has(claimId), `${contradiction.id}:${claimId}`).toBe(
          true,
        );
      }
      for (const path of contradiction.evidencePaths) {
        for (const evidenceId of path) {
          expect(
            evidenceIds.has(evidenceId),
            `${contradiction.id}:${evidenceId}`,
          ).toBe(true);
        }
      }
    }
    for (const stage of trial.stageRules) {
      expect(stageIds.has(stage.stageId), stage.stageId).toBe(true);
    }
    expect(stageIds.has(trial.initialStageId)).toBe(true);
    expect(stageIds.has(trial.finaleStageId)).toBe(true);
    expect(stageIds.has(trial.sincereStageId)).toBe(true);
    for (const unlock of trial.autoEvidenceUnlocks) {
      expect(evidenceIds.has(unlock.evidenceId), unlock.evidenceId).toBe(true);
    }
    for (const special of trial.specialConfrontations ?? []) {
      expect(evidenceIds.has(special.evidenceId), special.id).toBe(true);
      expect(stageIds.has(special.targetStageId), special.id).toBe(true);
      for (const claimId of special.recordClaimIds ?? []) {
        expect(claimIds.has(claimId), `${special.id}:${claimId}`).toBe(true);
      }
    }

    const candidateIds = new Set(court.candidates.map((entry) => entry.id));
    const chargeIds = new Set(court.charges.map((entry) => entry.id));
    expect(candidateIds.has(court.correctAccusedId)).toBe(true);
    expect(candidateIds.has(court.coverConfessorId)).toBe(true);
    expect(candidateIds.has(court.noProsecutionCandidateId)).toBe(true);
    expect(chargeIds.has(court.correctChargeId)).toBe(true);
    expect(chargeIds.has(court.relativeExceptionChargeId)).toBe(true);
    for (const issue of court.issues) {
      for (const argument of issue.acceptedArguments) {
        expect(
          contradictionIds.has(argument.contradictionId),
          `${issue.id}:${argument.contradictionId}`,
        ).toBe(true);
        for (const evidenceId of argument.requiredEvidenceIds) {
          expect(evidenceIds.has(evidenceId), `${issue.id}:${evidenceId}`).toBe(
            true,
          );
        }
      }
    }
    expect(Object.keys(court.endings)).toHaveLength(7);
  });

  it('감식 카드는 목표·확정 방식·필요 조합·포기 경로를 선택 전에 공개한다', () => {
    const options = new Map(
      requireTrial().forensicOptions.map((option) => [option.evidenceId, option]),
    );

    expect(options.get('F01')).toMatchObject({
      resolution: 'COMBINATION',
      targetContradictionId: 'M1',
      requiredEvidenceIds: ['E03'],
    });
    expect(options.get('F02')).toMatchObject({
      resolution: 'SUPPORT',
      requiredEvidenceIds: [],
    });
    expect(options.get('F02')?.targetContradictionId).toBeUndefined();
    expect(options.get('F03')).toMatchObject({
      resolution: 'COMBINATION',
      targetContradictionId: 'M2',
      requiredEvidenceIds: ['E06'],
    });
    expect(options.get('F04')).toMatchObject({
      resolution: 'DIRECT',
      targetContradictionId: 'M4',
    });
    expect(options.get('F05')).toMatchObject({
      resolution: 'DIRECT',
      targetContradictionId: 'M3',
    });
    for (const option of options.values()) {
      expect(option.opportunityCost, option.id).toBeTruthy();
    }
  });
});

describe('사건 2 심리 진행', () => {
  it('2턴 뒤 감식 세 개를 고르고 물리 모순 포함 세 모순에서 F06을 연다', () => {
    const trial = requireTrial();
    let state = createPsychologyTrialState(trial);
    state = toggleForensicOption(trial, state, 'FORENSIC_SEAT');
    state = toggleForensicOption(trial, state, 'FORENSIC_ROUTE');
    state = toggleForensicOption(trial, state, 'FORENSIC_RIDER');

    const committed = commitForensicSelection(trial, state, 2);
    expect(committed.evidenceIds).toEqual(['F01', 'F04', 'F05']);
    state = committed.state;

    const recordedClaimIds = kimMancheolContract.initialClaimIds ?? [];
    state = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'E03',
      recordedClaimIds,
    }).state;
    const m1 = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'F01',
      recordedClaimIds,
    });
    expect(m1.newlyConfirmedContradictionIds).toEqual(['M1']);
    expect(m1.recordEvidenceIds).toEqual(['M1']);
    expect(m1.state.stageId).toBe('ST_PATCH');
    state = m1.state;

    const m3 = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'F05',
      recordedClaimIds,
    });
    expect(m3.newlyConfirmedContradictionIds).toEqual(['M3']);
    expect(m3.state.stageId).toBe('ST_RIGID');
    state = m3.state;

    const m4 = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'F04',
      recordedClaimIds,
    });
    expect(m4.newlyConfirmedContradictionIds).toEqual(['M4']);
    expect(m4.automaticEvidenceIds).toEqual(['F06']);
    expect(m4.state.stageId).toBe('ST_DILEMMA');
  });

  it('네 번째 모순만으로는 피날레를 열지 않고 F06 제시가 특수 장면을 연다', () => {
    const trial = requireTrial();
    let state = createPsychologyTrialState(trial);
    state = {
      ...state,
      phase: 'SESSION_TWO',
      stageId: 'ST_DILEMMA',
      confirmedContradictionIds: ['M1', 'M3', 'M4'],
      unlockedAutomaticEvidenceIds: ['F06'],
    };

    const probe = resolveProbe(
      trial,
      state,
      'PROBE_SCENE_DETAIL',
      kimMancheolContract.initialClaimIds ?? [],
    );
    expect(probe.newlyConfirmedContradictionIds).toEqual(['M6']);
    expect(probe.recordEvidenceIds).toEqual(['R_M6', 'M6']);
    expect(probe.state.phase).toBe('SESSION_TWO');
    expect(probe.state.stageId).toBe('ST_DILEMMA');

    const exposed = resolveConfrontation(trial, probe.state, {
      presentedEvidenceId: 'F06',
      recordedClaimIds: kimMancheolContract.initialClaimIds ?? [],
    });
    expect(exposed.impact).toBe('SPECIAL_EVENT');
    expect(exposed.specialEvent?.id).toBe('EXPOSE_DAUGHTER_DRIVER');
    expect(exposed.specialEvent?.reactionLine).toContain('제 딸');
    expect(exposed.state.phase).toBe('FINALE');
    expect(exposed.state.stageId).toBe('ST_COLLAPSE');
    expect(exposed.state.confirmedContradictionIds).toEqual([
      'M1',
      'M3',
      'M4',
      'M6',
    ]);

    const finale = resolveFinale(trial, exposed.state, 'FINALE_EMPATHY');
    expect(finale.state.phase).toBe('COURT');
    expect(finale.state.stageId).toBe('ST_SINCERE');
    expect(finale.state.sincerity).toBe(true);
  });

  it('실제 피드백 경로 F03·F02·F04도 M2·M4·M6 뒤 F06 피날레에 도달한다', () => {
    const trial = requireTrial();
    let state = createPsychologyTrialState(trial);
    state = toggleForensicOption(trial, state, 'FORENSIC_RESTAURANT');
    state = toggleForensicOption(trial, state, 'FORENSIC_TRACE');
    state = toggleForensicOption(trial, state, 'FORENSIC_ROUTE');
    state = commitForensicSelection(trial, state, 2).state;
    const claims = kimMancheolContract.initialClaimIds ?? [];

    state = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'E06',
      recordedClaimIds: claims,
    }).state;
    state = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'F03',
      recordedClaimIds: claims,
    }).state;
    state = resolveConfrontation(trial, state, {
      presentedEvidenceId: 'F04',
      recordedClaimIds: claims,
    }).state;
    const probe = resolveProbe(
      trial,
      state,
      'PROBE_SCENE_DETAIL',
      claims,
    );

    expect(probe.state.confirmedContradictionIds).toEqual(['M2', 'M4', 'M6']);
    expect(probe.automaticEvidenceIds).toEqual(['F06']);

    const exposed = resolveConfrontation(trial, probe.state, {
      presentedEvidenceId: 'F06',
      recordedClaimIds: claims,
    });
    expect(exposed.state.phase).toBe('FINALE');
    expect(exposed.state.confirmedContradictionIds).toEqual(['M2', 'M4', 'M6']);
  });
});

describe('사건 2 법정 판정', () => {
  const winningArguments: CourtSubmission['arguments'] = [
    {
      issueId: 'ISSUE_FALSE_CONFESSION',
      contradictionId: 'M1',
      evidenceIds: ['E03', 'F01'],
    },
    {
      issueId: 'ISSUE_CONFESSION_RELIABILITY',
      contradictionId: 'M3',
      evidenceIds: ['F05'],
    },
    {
      issueId: 'ISSUE_TRUE_DRIVER',
      contradictionId: 'M1',
      evidenceIds: ['F06'],
    },
  ];
  const context = {
    confirmedContradictionIds: ['M1', 'M3', 'M4', 'M6'],
    acquiredEvidenceIds: [
      'E03',
      'E04',
      'F01',
      'F04',
      'F05',
      'F06',
      'R_M6',
      'M1',
      'M3',
      'M4',
      'M6',
    ],
    sincerity: false,
  };

  it('세 쟁점을 증명하면 일반 승리, 진심을 얻으면 히든 승리가 된다', () => {
    const court = requireCourt();
    const submission: CourtSubmission = {
      candidateId: 'seoyeon',
      chargeId: 'hit_and_run',
      arguments: winningArguments,
    };

    expect(judgeCourt(court, submission, context).outcome).toBe(
      'TRUTH_CONVICTION',
    );
    expect(
      judgeCourt(court, submission, { ...context, sincerity: true }).outcome,
    ).toBe('SELF_SURRENDER');
  });

  it('F03·F02·F04 감식 경로도 M2·M4·F06 논증으로 두 승리에 도달한다', () => {
    const court = requireCourt();
    const submission: CourtSubmission = {
      candidateId: 'seoyeon',
      chargeId: 'hit_and_run',
      arguments: [
        {
          issueId: 'ISSUE_FALSE_CONFESSION',
          contradictionId: 'M2',
          evidenceIds: ['E06', 'F03'],
        },
        {
          issueId: 'ISSUE_CONFESSION_RELIABILITY',
          contradictionId: 'M4',
          evidenceIds: ['F04'],
        },
        {
          issueId: 'ISSUE_TRUE_DRIVER',
          contradictionId: 'M2',
          evidenceIds: ['F06'],
        },
      ],
    };
    const feedbackPathContext = {
      confirmedContradictionIds: ['M2', 'M4', 'M6'],
      acquiredEvidenceIds: [
        'E04',
        'E06',
        'F02',
        'F03',
        'F04',
        'F06',
        'R_M6',
        'M2',
        'M4',
        'M6',
      ],
      sincerity: false,
    };

    expect(
      judgeCourt(court, submission, feedbackPathContext).outcome,
    ).toBe('TRUTH_CONVICTION');
    expect(
      judgeCourt(court, submission, {
        ...feedbackPathContext,
        sincerity: true,
      }).outcome,
    ).toBe('SELF_SURRENDER');
  });

  it('나머지 다섯 실패 엔딩을 서로 다른 선택으로 판정한다', () => {
    const court = requireCourt();
    const verdict = (
      candidateId: string,
      chargeId: string | undefined,
      courtArguments: CourtSubmission['arguments'] = winningArguments,
    ) =>
      judgeCourt(
        court,
        { candidateId, chargeId, arguments: courtArguments },
        context,
      ).outcome;

    expect(verdict('mancheol', 'hit_and_run')).toBe('WRONGFUL_CONVICTION');
    expect(verdict('mancheol', 'offender_harboring')).toBe(
      'RELATIVE_EXCEPTION',
    );
    expect(verdict('seoyeon', 'other')).toBe('CHARGE_MISMATCH');
    expect(verdict('seoyeon', 'hit_and_run', [])).toBe(
      'ACQUITTAL_INSUFFICIENT',
    );
    expect(verdict('none', undefined, [])).toBe('UNRESOLVED');
  });
});
