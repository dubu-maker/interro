import { describe, expect, it } from 'vitest';
import { hanSeraContract } from '../cases/prototype/contract';
import {
  allowedClaims,
  applyEvidencePresentation,
  createContractState,
  recordStatements,
  validatePlannedClaimIds,
} from './contract';

describe('사건 계약 엔진', () => {
  it('E1을 정식 제시하면 S0에서 S1로 결정론적으로 전환된다', () => {
    const state = createContractState(hanSeraContract);
    const outcome = applyEvidencePresentation(hanSeraContract, state, 'E1');

    expect(outcome.state.stageId).toBe('S1');
    expect(outcome.transition?.unlockNotice).toContain('주차장 기록');
    const claimIds = allowedClaims(hanSeraContract, outcome.state).map(
      (claim) => claim.id,
    );
    expect(claimIds).toContain('C_TABLET');
    expect(claimIds).toContain('C_HEARD_PHONE');
  });

  it('제시 순서가 어긋나면 전환되지 않는다 (S0에서 E3)', () => {
    const state = createContractState(hanSeraContract);
    const outcome = applyEvidencePresentation(hanSeraContract, state, 'E3');

    expect(outcome.state.stageId).toBe('S0');
    expect(outcome.transition).toBeUndefined();
  });

  it('S1에서 E3을 제시하면 S2가 열린다', () => {
    let state = createContractState(hanSeraContract);
    state = applyEvidencePresentation(hanSeraContract, state, 'E1').state;
    const outcome = applyEvidencePresentation(hanSeraContract, state, 'E3');

    expect(outcome.state.stageId).toBe('S2');
    const claimIds = allowedClaims(hanSeraContract, outcome.state).map(
      (claim) => claim.id,
    );
    expect(claimIds).toContain('C_COFFEE_TOGETHER');
  });

  it('단계가 전진해도 이전 단계에서 인정한 사실은 계속 진술할 수 있다', () => {
    let state = createContractState(hanSeraContract);
    state = applyEvidencePresentation(hanSeraContract, state, 'E1').state;
    state = applyEvidencePresentation(hanSeraContract, state, 'E3').state;
    const claimIds = allowedClaims(hanSeraContract, state).map(
      (claim) => claim.id,
    );

    expect(claimIds).toContain('C_HEARD_PHONE');
    expect(claimIds).toContain('C_TABLET');
    expect(claimIds).toContain('C_LEFT_2205');
  });

  it('계획자가 현재 단계에서 허용되지 않은 claim을 고르면 차단된다', () => {
    const state = createContractState(hanSeraContract);
    const result = validatePlannedClaimIds(hanSeraContract, state, [
      'C_WENT_HOME',
      'C_HEARD_PHONE',
      'C_NO_SUCH_ID',
    ]);

    expect(result.valid).toEqual(['C_WENT_HOME']);
    expect(result.rejected).toEqual(['C_HEARD_PHONE', 'C_NO_SUCH_ID']);
  });

  it('기록된 거짓 진술은 반박 증거 제시 시 모순 상태가 된다', () => {
    let state = createContractState(hanSeraContract);
    state = recordStatements(state, ['C_WENT_HOME'], 1);
    const outcome = applyEvidencePresentation(hanSeraContract, state, 'E1');

    expect(outcome.contradictedClaimIds).toEqual(['C_WENT_HOME']);
    expect(outcome.state.statements[0]?.status).toBe('CONTRADICTED');
  });

  it('같은 claim은 진술 기록에 중복 저장되지 않는다', () => {
    let state = createContractState(hanSeraContract);
    state = recordStatements(state, ['C_WENT_HOME'], 1);
    state = recordStatements(state, ['C_WENT_HOME', 'C_DENY_MURDER'], 2);

    expect(state.statements).toHaveLength(2);
    expect(state.statements[0]?.turn).toBe(1);
  });
});
