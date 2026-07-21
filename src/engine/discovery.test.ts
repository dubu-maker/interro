import { describe, expect, it } from 'vitest';
import { case1 } from '../cases/case1';
import { prototypeCaseKo } from '../cases/prototype';
import { evaluateUnlocks } from './case';

function snapshot(overrides: {
  acquired?: string[];
  suspects?: string[];
  claims?: string[];
  stages?: [string, string][];
}) {
  return {
    acquiredEvidenceIds: new Set(
      overrides.acquired ?? [...case1.initialEvidenceIds],
    ),
    unlockedSuspectIds: new Set(
      overrides.suspects ?? [...case1.initialSuspectIds],
    ),
    recordedClaims: new Set(overrides.claims ?? []),
    stages: new Map(overrides.stages ?? []),
  };
}

describe('점진 공개 (사건 1)', () => {
  it('시작 상태에서는 아무것도 열리지 않는다', () => {
    expect(evaluateUnlocks(case1, snapshot({}))).toEqual([]);
  });

  it('통화 목격 진술이 통화 기록을 입수시키고, 연쇄로 박진태가 열린다', () => {
    const fired = evaluateUnlocks(
      case1,
      snapshot({ claims: ['sera:C_HS_HEARD_PHONE'] }),
    );

    expect(fired.map((u) => u.evidenceId ?? u.suspectId)).toEqual([
      'E4',
      'park',
    ]);
  });

  it('자금 언쟁 진술이 감사 메모를 입수시킨다', () => {
    const fired = evaluateUnlocks(
      case1,
      snapshot({ claims: ['sera:C_HS_MONEY_TALK'] }),
    );
    expect(fired.map((u) => u.evidenceId)).toEqual(['E5']);
  });

  it('박진태의 부인 진술이 후문 CCTV → 보안 로그 → 유민호까지 연쇄로 연다', () => {
    const fired = evaluateUnlocks(
      case1,
      snapshot({
        suspects: ['sera', 'park'],
        acquired: ['E1', 'E2', 'E3', 'E4'],
        claims: ['park:C_PJ_NOT_THERE'],
      }),
    );

    expect(fired.map((u) => u.evidenceId ?? u.suspectId)).toEqual([
      'E6',
      'E7',
      'minho',
    ]);
  });

  it('박진태가 S3에 도달하면 트로피 감식이 열린다', () => {
    const fired = evaluateUnlocks(
      case1,
      snapshot({
        suspects: ['sera', 'park'],
        stages: [['park', 'S3']],
      }),
    );
    expect(fired.map((u) => u.evidenceId)).toEqual(['E8']);
  });

  it('이미 입수한 단서는 다시 열리지 않는다', () => {
    const fired = evaluateUnlocks(
      case1,
      snapshot({
        acquired: ['E1', 'E2', 'E3', 'E4'],
        suspects: ['sera', 'park'],
        claims: ['sera:C_HS_HEARD_PHONE'],
      }),
    );
    expect(fired).toEqual([]);
  });

  it('모든 unlock이 존재하는 증거·용의자·claim만 참조한다', () => {
    const evidenceIds = new Set(case1.evidences.map((entry) => entry.id));
    const suspectIds = new Set(case1.suspects.map((entry) => entry.id));
    for (const unlock of case1.unlocks) {
      if (unlock.evidenceId) expect(evidenceIds.has(unlock.evidenceId)).toBe(true);
      if (unlock.suspectId) expect(suspectIds.has(unlock.suspectId)).toBe(true);
      const trigger = unlock.trigger;
      if (trigger.type === 'claim') {
        const contract = case1.suspects.find(
          (entry) => entry.id === trigger.suspectId,
        )?.contract;
        expect(
          contract?.claims.some((claim) => claim.id === trigger.claimId),
        ).toBe(true);
      } else if (trigger.type === 'evidence') {
        expect(evidenceIds.has(trigger.evidenceId)).toBe(true);
      } else {
        expect(suspectIds.has(trigger.suspectId)).toBe(true);
      }
    }
  });

  it('전체 증명 사슬의 증거가 모두 입수 가능하다 (해결 가능성)', () => {
    // 최장 경로: 통화 목격 → E4·park, 자금 언쟁 → E5, 부인 → E6·E7·minho,
    // S3 → E8. 초기 3개와 합치면 8개 전부.
    const acquired = new Set(case1.initialEvidenceIds);
    const fired = evaluateUnlocks(case1, {
      acquiredEvidenceIds: acquired,
      unlockedSuspectIds: new Set(case1.initialSuspectIds),
      recordedClaims: new Set([
        'sera:C_HS_HEARD_PHONE',
        'sera:C_HS_MONEY_TALK',
        'park:C_PJ_NOT_THERE',
      ]),
      stages: new Map([['park', 'S3']]),
    });
    for (const unlock of fired) {
      if (unlock.evidenceId) acquired.add(unlock.evidenceId);
    }
    expect(acquired.size).toBe(case1.evidences.length);
  });
});

describe('점진 공개 (프로토타입)', () => {
  it('프로토타입은 전부 초기 공개라 열릴 것이 없다', () => {
    expect(prototypeCaseKo.initialEvidenceIds.length).toBe(
      prototypeCaseKo.evidences.length,
    );
    expect(prototypeCaseKo.unlocks.length).toBe(0);
  });
});
