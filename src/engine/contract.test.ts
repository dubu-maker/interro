import { describe, expect, it } from 'vitest';
import { hanSeraContract } from '../cases/prototype/contract';
import { kimMancheolContract } from '../cases/case2/contract';
import {
  allowedClaims,
  applyEvidencePresentation,
  commitStatements,
  createContractState,
  getActivePosition,
  recordStatements,
  requiredUndeniableClaimIds,
  selectHint,
  validatePlannedClaimIds,
} from './contract';

describe('사건 계약 엔진', () => {
  it('초기 진술은 존재하는 claim을 중복 없이 참조해야 한다', () => {
    expect(() =>
      createContractState({
        ...hanSeraContract,
        initialClaimIds: ['NO_CLAIM'],
      }),
    ).toThrow('알 수 없는 초기 진술');
    expect(() =>
      createContractState({
        ...hanSeraContract,
        initialClaimIds: ['C_WENT_HOME', 'C_WENT_HOME'],
      }),
    ).toThrow('중복된 초기 진술');
  });

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

  it('정체 힌트는 단계·미기록 진술·미제시 증거 조건으로 선택된다', () => {
    let state = createContractState(hanSeraContract);
    // S0: 주차장 기록을 향한 힌트가 먼저 나온다.
    expect(selectHint(hanSeraContract, state, [], [])?.id).toBe(
      'H_S0_PARKING',
    );

    // S1로 전진 + E1 제시됨: 관찰 힌트가 나온다.
    state = applyEvidencePresentation(hanSeraContract, state, 'E1').state;
    expect(selectHint(hanSeraContract, state, ['E1'], [])?.id).toBe(
      'H_S1_OBSERVATION',
    );

    // 관찰 진술이 이미 기록됐으면 커피잔 힌트로 넘어간다.
    state = recordStatements(state, ['C_HEARD_PHONE'], 2);
    expect(selectHint(hanSeraContract, state, ['E1'], [])?.id).toBe(
      'H_S1_COFFEE',
    );

    // 이미 보여준 힌트는 다시 나오지 않는다.
    expect(
      selectHint(hanSeraContract, state, ['E1'], ['H_S1_COFFEE'])?.id,
    ).toBeUndefined();
  });

  it('모든 진술이 나오면 힌트도 소진된다', () => {
    let state = createContractState(hanSeraContract);
    state = applyEvidencePresentation(hanSeraContract, state, 'E1').state;
    state = applyEvidencePresentation(hanSeraContract, state, 'E3').state;
    state = recordStatements(
      state,
      ['C_HEARD_PHONE', 'C_MONEY_ARGUMENT', 'C_LEFT_ALIVE'],
      3,
    );

    expect(selectHint(hanSeraContract, state, ['E1', 'E3'], [])).toBeUndefined();
  });

  it('같은 claim은 진술 기록에 중복 저장되지 않는다', () => {
    let state = createContractState(hanSeraContract);
    state = recordStatements(state, ['C_WENT_HOME'], 1);
    state = recordStatements(state, ['C_WENT_HOME', 'C_DENY_MURDER'], 2);

    expect(state.statements).toHaveLength(2);
    expect(state.statements[0]?.turn).toBe(1);
  });

  it('입장 계약 단계에서는 핵심 자백과 부인 불가 사실을 함께 제공한다', () => {
    const state = createContractState(kimMancheolContract);
    const position = getActivePosition(kimMancheolContract, state);
    const claimIds = allowedClaims(kimMancheolContract, state).map(
      (claim) => claim.id,
    );

    expect(position?.protectedClaimIds).toEqual(['C_I_DROVE']);
    expect(claimIds).toEqual(
      expect.arrayContaining([
        'C_DAUGHTER_IDENTITY',
        'C_CARD_OWNERSHIP',
        'C_CAR_OWNERSHIP',
        'C_CALL_OCCURRED',
      ]),
    );
  });

  it('질문과 증거가 건드린 부인 불가 사실을 결정론적으로 고른다', () => {
    const state = createContractState(kimMancheolContract);

    expect(
      requiredUndeniableClaimIds(
        kimMancheolContract,
        state,
        '김서연은 누구입니까?',
        'E05',
      ),
    ).toEqual(['C_DAUGHTER_IDENTITY', 'C_CALL_OCCURRED']);
    expect(
      requiredUndeniableClaimIds(
        kimMancheolContract,
        state,
        '이게 당신 카드 맞습니까?',
        'E06',
      ),
    ).toContain('C_CARD_OWNERSHIP');
  });

  it('같은 주제의 다른 값은 번복으로 기록하고 전용 추궁을 연다', () => {
    const initial = createContractState(kimMancheolContract);
    const outcome = commitStatements(
      kimMancheolContract,
      initial,
      ['C_RESTAURANT_PRESENT'],
      3,
    );

    expect(outcome.revisions).toEqual([
      expect.objectContaining({
        topicId: 'POST_CRASH_ROUTE',
        previousClaimId: 'C_HOME_DIRECT',
        previousTurn: 0,
        nextClaimId: 'C_RESTAURANT_PRESENT',
        nextTurn: 3,
      }),
    ]);
    expect(outcome.revisions[0]?.followUpQuestion).toContain(
      '아까는 사고 뒤 곧장 집',
    );
    expect(
      outcome.state.statements.find(
        (statement) => statement.claimId === 'C_HOME_DIRECT',
      ),
    ).toMatchObject({
      status: 'REVISED',
      supersededByClaimId: 'C_RESTAURANT_PRESENT',
    });
  });

  it('같은 진술 재확인은 번복이 아니라 고착 후보로 돌려준다', () => {
    const initial = createContractState(kimMancheolContract);
    const outcome = commitStatements(
      kimMancheolContract,
      initial,
      ['C_HOME_DIRECT'],
      2,
    );

    expect(outcome.reaffirmedClaimIds).toEqual(['C_HOME_DIRECT']);
    expect(outcome.revisions).toEqual([]);
    expect(outcome.state).toBe(initial);
  });
});
