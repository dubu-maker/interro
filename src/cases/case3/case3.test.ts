import { describe, expect, it } from 'vitest';
import { evaluateUnlocks } from '../../engine/case';
import {
  allowedClaims,
  applyEvidencePresentation,
  createContractState,
} from '../../engine/contract';
import { judgeReport } from '../../engine/verdict';
import { case3 } from './index';

function contractFor(suspectId: string) {
  const suspect = case3.suspects.find((entry) => entry.id === suspectId);
  if (!suspect) throw new Error(`사건 3 용의자를 찾을 수 없습니다: ${suspectId}`);
  return suspect.contract;
}

describe('사건 3 심문 전용 구성', () => {
  it('현장·심리전·법정 없이 세 용의자와 문서 증거로 시작한다', () => {
    expect(case3.id).toBe('case3');
    expect(case3.title).toBe('22:17 — 마지막 리허설');
    expect(case3.scene).toBeUndefined();
    expect(case3.psychologyTrial).toBeUndefined();
    expect(case3.interrogationExperience).toBeUndefined();
    expect(case3.court).toBeUndefined();
    expect(case3.motiveOptions).toEqual([]);
    expect(case3.methodOptions).toEqual([]);
    expect(case3.suspects.map((suspect) => suspect.id)).toEqual([
      'mirae',
      'haneul',
      'gyutae',
    ]);
    expect(case3.initialSuspectIds).toEqual(['mirae', 'haneul', 'gyutae']);
    expect(case3.initialEvidenceIds).toEqual([
      'E1',
      'E2',
      'E3',
      'E4',
      'E5',
    ]);
    expect(case3.evidences).toHaveLength(9);
    expect(
      case3.evidences.every((evidence) => evidence.view?.type === 'document'),
    ).toBe(true);
  });
});

describe('사건 3 계약 무결성', () => {
  it('단계·전환·힌트·해금·정답 사슬의 모든 ID가 실제 데이터에 존재한다', () => {
    const evidenceIds = new Set(case3.evidences.map((evidence) => evidence.id));
    const suspectIds = new Set(case3.suspects.map((suspect) => suspect.id));

    expect(evidenceIds.size).toBe(case3.evidences.length);
    expect(suspectIds.has(case3.solution.culpritId)).toBe(true);

    for (const suspect of case3.suspects) {
      const { contract } = suspect;
      const claimIds = new Set(contract.claims.map((claim) => claim.id));
      const stageIds = new Set(contract.stages.map((stage) => stage.id));

      expect(contract.suspectId).toBe(suspect.id);
      expect(stageIds.has(contract.initialStageId)).toBe(true);
      createContractState(contract);

      for (const claimId of contract.initialClaimIds ?? []) {
        expect(claimIds.has(claimId), `${suspect.id}:${claimId}`).toBe(true);
      }
      for (const stage of contract.stages) {
        for (const claimId of stage.allowedClaimIds) {
          expect(
            claimIds.has(claimId),
            `${suspect.id}:${stage.id}:${claimId}`,
          ).toBe(true);
        }
      }
      for (const transition of contract.transitions) {
        expect(stageIds.has(transition.from)).toBe(true);
        expect(stageIds.has(transition.to)).toBe(true);
        expect(
          evidenceIds.has(transition.whenEvidencePresented),
          `${suspect.id}:${transition.whenEvidencePresented}`,
        ).toBe(true);
      }
      for (const hint of contract.hints) {
        for (const stageId of hint.stageIds) {
          expect(stageIds.has(stageId), `${suspect.id}:${stageId}`).toBe(true);
        }
        if (hint.targetClaimId) {
          expect(claimIds.has(hint.targetClaimId)).toBe(true);
        }
        if (hint.targetEvidenceId) {
          expect(evidenceIds.has(hint.targetEvidenceId)).toBe(true);
        }
      }
      for (const claim of contract.claims) {
        for (const evidenceId of claim.contradictedBy ?? []) {
          expect(evidenceIds.has(evidenceId), claim.id).toBe(true);
        }
      }
    }

    for (const unlock of case3.unlocks) {
      if (unlock.evidenceId) expect(evidenceIds.has(unlock.evidenceId)).toBe(true);
      if (unlock.suspectId) expect(suspectIds.has(unlock.suspectId)).toBe(true);
      const trigger = unlock.trigger;
      if (trigger.type === 'stage') {
        const contract = contractFor(trigger.suspectId);
        expect(
          contract.stages.some((stage) => stage.id === trigger.stageId),
        ).toBe(true);
      }
    }
    for (const chain of case3.solution.proofEvidenceChains) {
      expect(chain.every((evidenceId) => evidenceIds.has(evidenceId))).toBe(true);
    }
  });

  it('언락 전 프롬프트 표면에는 각 인물의 핵심 비밀 claim이 없다', () => {
    const sealedBySuspect: Record<string, readonly string[]> = {
      mirae: ['M_TAPED_WARNING', 'M_KEY_REQUIRED', 'M_GYUTAE_ACCESS'],
      haneul: ['H_SUNA_MOTHER', 'H_THREAT_WORDS', 'H_HEARD_GYUTAE_MEETING'],
      gyutae: ['G_KEY_ROUTINE_CHECK', 'G_WENT_CORRIDOR', 'G_CLOCKS_UNSYNCED'],
    };

    for (const suspect of case3.suspects) {
      const initialStage = suspect.contract.stages.find(
        (stage) => stage.id === suspect.contract.initialStageId,
      );
      expect(initialStage).toBeDefined();
      for (const sealedClaimId of sealedBySuspect[suspect.id] ?? []) {
        expect(initialStage?.allowedClaimIds).not.toContain(sealedClaimId);
      }
    }
  });
});

describe('사건 3 결정론적 심문 경로', () => {
  it('장미래는 E3와 E2를 어느 순서로 제시해도 모든 과실을 인정한다', () => {
    const contract = contractFor('mirae');

    let tapeFirst = createContractState(contract);
    tapeFirst = applyEvidencePresentation(contract, tapeFirst, 'E3').state;
    expect(tapeFirst.stageId).toBe('M_TAPE');
    tapeFirst = applyEvidencePresentation(contract, tapeFirst, 'E2').state;
    expect(tapeFirst.stageId).toBe('M_FULL');

    let cueFirst = createContractState(contract);
    cueFirst = applyEvidencePresentation(contract, cueFirst, 'E2').state;
    expect(cueFirst.stageId).toBe('M_CUE');
    cueFirst = applyEvidencePresentation(contract, cueFirst, 'E3').state;
    expect(cueFirst.stageId).toBe('M_FULL');
    expect(
      allowedClaims(contract, cueFirst).map((claim) => claim.id),
    ).toEqual(expect.arrayContaining(['M_TAPED_WARNING', 'M_GYUTAE_ACCESS']));
  });

  it('윤하늘은 과거 기록과 성명 초안 뒤 알리바이 영상으로 배제된다', () => {
    const contract = contractFor('haneul');
    let state = createContractState(contract);

    state = applyEvidencePresentation(contract, state, 'E5').state;
    expect(state.stageId).toBe('H_IDENTITY');
    state = applyEvidencePresentation(contract, state, 'E4').state;
    expect(state.stageId).toBe('H_ARGUMENT');
    state = applyEvidencePresentation(contract, state, 'E9').state;
    expect(state.stageId).toBe('H_CLEARED');
    expect(
      allowedClaims(contract, state).map((claim) => claim.id),
    ).toContain('H_ALIBI_CONFIRMED');
  });

  it('이규태는 로그·열쇠·통로·14초 기록 순서로 최후 변명까지 간다', () => {
    const contract = contractFor('gyutae');
    let state = createContractState(contract);

    for (const [evidenceId, stageId] of [
      ['E1', 'G_MANUAL'],
      ['E6', 'G_KEY'],
      ['E7', 'G_CORRIDOR'],
      ['E8', 'G_TIMELINE'],
    ] as const) {
      state = applyEvidencePresentation(contract, state, evidenceId).state;
      expect(state.stageId).toBe(stageId);
    }
    expect(
      allowedClaims(contract, state).map((claim) => claim.id),
    ).toContain('G_CLOCKS_UNSYNCED');
  });

  it('심문 단계가 후속 증거 E6·E7·E8·E9를 순차 해금한다', () => {
    const unlocked = (
      stages: ReadonlyMap<string, string>,
      acquiredEvidenceIds: readonly string[] = case3.initialEvidenceIds,
    ) =>
      evaluateUnlocks(case3, {
        acquiredEvidenceIds: new Set(acquiredEvidenceIds),
        unlockedSuspectIds: new Set(case3.initialSuspectIds),
        recordedClaims: new Set(),
        stages,
      }).map((entry) => entry.evidenceId);

    expect(unlocked(new Map([['mirae', 'M_TAPE']]))).toEqual(['E6']);
    expect(unlocked(new Map([['gyutae', 'G_KEY']]), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'])).toEqual([
      'E7',
    ]);
    expect(
      unlocked(new Map([['gyutae', 'G_CORRIDOR']]), [
        'E1',
        'E2',
        'E3',
        'E4',
        'E5',
        'E6',
        'E7',
      ]),
    ).toEqual(['E8']);
    expect(unlocked(new Map([['haneul', 'H_ARGUMENT']]))).toEqual(['E9']);
  });

  it('자백 없이도 올바른 증거 사슬로 이규태를 유죄 판정한다', () => {
    const verdict = judgeReport(case3, {
      accusedId: 'gyutae',
      motiveId: 'MOTIVE_EXPOSURE',
      methodId: 'METHOD_REHEARSAL',
      evidenceIds: ['E1', 'E2', 'E6', 'E7', 'E8'],
    });

    expect(verdict.outcome).toBe('CONVICTED');
    expect(verdict.win).toBe(true);
    expect(verdict.matchedChain).toEqual(['E1', 'E2', 'E6', 'E7', 'E8']);
  });
});
