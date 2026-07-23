import { describe, expect, it } from 'vitest';
import {
  createInterrogationDynamicsState,
  INTERROGATION_TACTICS,
  resolveInterrogationTurn,
  type InterrogationDynamicsConfig,
  type InterrogationDynamicsState,
  type InterrogationTacticId,
} from './interrogationDynamics';

const config: InterrogationDynamicsConfig = {
  topics: [
    { id: 'ROUTE', label: '사고 후 동선', maxTurns: 8 },
    { id: 'FAMILY', label: '가족 관계', maxTurns: 8 },
  ],
  claims: [
    { id: 'C_HOME', topicId: 'ROUTE', valueId: 'HOME' },
    {
      id: 'C_RESTAURANT',
      topicId: 'ROUTE',
      valueId: 'RESTAURANT',
    },
    { id: 'C_DAUGHTER', topicId: 'FAMILY', valueId: 'DAUGHTER' },
    { id: 'C_GENERIC' },
  ],
  counterQuestionRules: [],
};

function turn(
  state: InterrogationDynamicsState,
  tacticId: InterrogationTacticId,
  topicId: string,
  claimIds: readonly string[] = [],
) {
  return resolveInterrogationTurn(config, state, {
    tacticId,
    topicId,
    claimIds,
  });
}

describe('대화 심리전 초기 상태와 입력 계약', () => {
  it('모든 심리 수치를 0..100으로 제한하고 빈 기록에서 시작한다', () => {
    const state = createInterrogationDynamicsState({
      ...config,
      initialPsychology: {
        trust: 130,
        pressure: -10,
        guard: 42.4,
        protectiveness: 70,
      },
    });

    expect(state.psychology).toEqual({
      trust: 100,
      pressure: 0,
      guard: 42,
      protectiveness: 70,
    });
    expect(state.statements).toEqual([]);
    expect(state.topics).toHaveLength(2);
  });

  it('엔진 입력은 전술·주제·닫힌 claim ID만 받는다', () => {
    const state = createInterrogationDynamicsState(config);
    expect(() =>
      resolveInterrogationTurn(config, state, {
        tacticId: 'ASK_DETAIL',
        topicId: 'ROUTE',
        claimIds: ['NO_CLAIM'],
      }),
    ).toThrow('알 수 없는 대화 진술');
    expect(() =>
      resolveInterrogationTurn(config, state, {
        tacticId: 'ASK_DETAIL',
        topicId: 'FAMILY',
        claimIds: ['C_HOME'],
      }),
    ).toThrow('FAMILY 주제에서 사용할 수 없습니다');
    expect(() =>
      resolveInterrogationTurn(config, state, {
        tacticId: 'ASK_DETAIL',
        topicId: 'ROUTE',
        claimIds: ['C_HOME', 'C_RESTAURANT'],
      }),
    ).toThrow('상반된 값을 함께 기록할 수 없습니다');
  });

  it('잘못된 설정을 생성 시점과 턴 처리 시점에 거절한다', () => {
    expect(() =>
      createInterrogationDynamicsState({
        topics: [],
        claims: [],
      }),
    ).toThrow('대화 주제가 하나 이상');
    expect(() =>
      createInterrogationDynamicsState({
        topics: [
          { id: 'ROUTE', label: '동선' },
          { id: 'ROUTE', label: '중복' },
        ],
        claims: [],
      }),
    ).toThrow('중복된 대화 주제');
    expect(() =>
      createInterrogationDynamicsState({
        topics: [{ id: 'ROUTE', label: '동선' }],
        claims: [
          { id: 'C_BAD', topicId: 'UNKNOWN', valueId: 'VALUE' },
        ],
      }),
    ).toThrow('알 수 없는 진술 주제');
  });
});

describe('진술 언급·재확인·고착·번복', () => {
  it('같은 claim을 반복하면 언급에서 재확인, 고착으로 상승한다', () => {
    const initial = createInterrogationDynamicsState(config);
    const first = turn(initial, 'ASK_DETAIL', 'ROUTE', ['C_HOME']);
    const second = turn(
      first.state,
      'ASK_DETAIL',
      'ROUTE',
      ['C_HOME'],
    );
    const third = turn(
      second.state,
      'ASK_DETAIL',
      'ROUTE',
      ['C_HOME'],
    );

    expect(first.state.statements[0]?.strength).toBe('MENTIONED');
    expect(second.state.statements[0]?.strength).toBe('REAFFIRMED');
    expect(third.state.statements[0]?.strength).toBe('COMMITTED');
    expect(third.newCommitmentClaimIds).toEqual(['C_HOME']);
    expect(third.state.statements[0]?.timesAsserted).toBe(3);
  });

  it('이미 언급한 진술에 고정 전술을 쓰면 즉시 고착한다', () => {
    const initial = createInterrogationDynamicsState(config);
    const first = turn(initial, 'ASK_DETAIL', 'ROUTE', ['C_HOME']);
    const pinned = turn(
      first.state,
      'PIN_STATEMENT',
      'ROUTE',
      ['C_HOME'],
    );

    expect(pinned.state.statements[0]?.strength).toBe('COMMITTED');
    expect(pinned.newCommitmentClaimIds).toEqual(['C_HOME']);
    expect(pinned.responseDirective.instruction).toContain('재확인');
  });

  it('같은 주제에서 다른 값이 나오면 이전 진술을 번복 처리한다', () => {
    const initial = createInterrogationDynamicsState(config);
    const home = turn(initial, 'ASK_DETAIL', 'ROUTE', ['C_HOME']);
    const restaurant = turn(
      home.state,
      'PROBE',
      'ROUTE',
      ['C_RESTAURANT'],
    );

    expect(
      restaurant.state.statements.find(
        (statement) => statement.claimId === 'C_HOME',
      ),
    ).toMatchObject({
      strength: 'REVISED',
      supersededByClaimId: 'C_RESTAURANT',
    });
    expect(
      restaurant.state.statements.find(
        (statement) => statement.claimId === 'C_RESTAURANT',
      )?.strength,
    ).toBe('MENTIONED');
    expect(restaurant.revisions).toEqual([
      {
        topicId: 'ROUTE',
        previousClaimId: 'C_HOME',
        nextClaimId: 'C_RESTAURANT',
      },
    ]);
  });

  it('고착 뒤 같은 말을 더 반복해도 새 고착을 중복 지급하지 않는다', () => {
    let state = createInterrogationDynamicsState(config);
    state = turn(state, 'ASK_DETAIL', 'ROUTE', ['C_HOME']).state;
    state = turn(state, 'PIN_STATEMENT', 'ROUTE', ['C_HOME']).state;
    const repeated = turn(
      state,
      'PIN_STATEMENT',
      'ROUTE',
      ['C_HOME'],
    );

    expect(repeated.newCommitmentClaimIds).toEqual([]);
    expect(repeated.statementChanges).toEqual([
      {
        claimId: 'C_HOME',
        kind: 'UNCHANGED',
        from: 'COMMITTED',
        to: 'COMMITTED',
      },
    ]);
  });
});

describe('전술 심리 수치와 반복 피로', () => {
  it('전술마다 결정론적인 심리 변화를 반환한다', () => {
    const initial = createInterrogationDynamicsState(config);
    const empathy = turn(initial, 'EMPATHIZE', 'FAMILY', [
      'C_DAUGHTER',
    ]);

    expect(empathy.psychologyDelta).toEqual(
      INTERROGATION_TACTICS.EMPATHIZE.psychologyDelta,
    );
    expect(empathy.state.psychology).toEqual({
      trust: 60,
      pressure: 15,
      guard: 27,
      protectiveness: 36,
    });
  });

  it('같은 전술을 반복하면 신뢰 피로와 추가 경계가 생긴다', () => {
    const initial = createInterrogationDynamicsState(config);
    const first = turn(initial, 'PRESSURE', 'ROUTE');
    const second = turn(first.state, 'PRESSURE', 'ROUTE');

    expect(first.psychologyDelta).toEqual({
      trust: -8,
      pressure: 14,
      guard: 10,
      protectiveness: 7,
    });
    expect(second.psychologyDelta).toEqual({
      trust: -9,
      pressure: 14,
      guard: 12,
      protectiveness: 7,
    });
  });

  it('심리 수치가 경계값을 넘지 않으며 실제 적용량을 돌려준다', () => {
    const cappedConfig: InterrogationDynamicsConfig = {
      ...config,
      initialPsychology: {
        trust: 3,
        pressure: 95,
        guard: 96,
        protectiveness: 98,
      },
    };
    const initial = createInterrogationDynamicsState(cappedConfig);
    const result = resolveInterrogationTurn(cappedConfig, initial, {
      tacticId: 'PRESSURE',
      topicId: 'ROUTE',
      claimIds: [],
    });

    expect(result.state.psychology).toEqual({
      trust: 0,
      pressure: 100,
      guard: 100,
      protectiveness: 100,
    });
    expect(result.psychologyDelta).toEqual({
      trust: -3,
      pressure: 5,
      guard: 4,
      protectiveness: 2,
    });
  });
});

describe('주제 반복·소진과 전역 정체', () => {
  it('새 전술 탐색은 진전이고 같은 전술·같은 고착 반복은 무진전이다', () => {
    let state = createInterrogationDynamicsState(config);
    state = turn(state, 'ASK_DETAIL', 'ROUTE', ['C_HOME']).state;
    state = turn(state, 'PIN_STATEMENT', 'ROUTE', ['C_HOME']).state;

    const newTactic = turn(state, 'SILENCE', 'ROUTE');
    const repeated = turn(
      newTactic.state,
      'SILENCE',
      'ROUTE',
    );

    expect(newTactic.progressed).toBe(true);
    expect(repeated.progressed).toBe(false);
    expect(repeated.state.consecutiveNoProgressTurns).toBe(1);
  });

  it('같은 주제에서 2회 연속 무진전이면 소진되고 정체 안내를 준다', () => {
    let state = createInterrogationDynamicsState(config);
    state = turn(state, 'ASK_DETAIL', 'ROUTE', ['C_HOME']).state;
    state = turn(state, 'ASK_DETAIL', 'ROUTE', ['C_HOME']).state;
    state = turn(state, 'ASK_DETAIL', 'ROUTE', ['C_HOME']).state;

    const noProgressOne = turn(
      state,
      'ASK_DETAIL',
      'ROUTE',
      ['C_HOME'],
    );
    const noProgressTwo = turn(
      noProgressOne.state,
      'ASK_DETAIL',
      'ROUTE',
      ['C_HOME'],
    );

    expect(noProgressOne.progressed).toBe(false);
    expect(noProgressTwo.topicExhausted).toBe(true);
    expect(noProgressTwo.newlyExhausted).toBe(true);
    expect(noProgressTwo.stalledNotice).toContain(
      '2회 연속 새 진술이나 새로운 전술 반응',
    );
    expect(noProgressTwo.responseDirective.mode).toBe(
      'TOPIC_EXHAUSTED',
    );
    expect(noProgressTwo.responseDirective.notice).toContain(
      '사고 후 동선',
    );
  });

  it('서로 다른 주제의 무진전도 전역 2회면 알리되 해당 주제는 소진하지 않는다', () => {
    const lenientConfig: InterrogationDynamicsConfig = {
      ...config,
      topics: [
        {
          id: 'ROUTE',
          label: '사고 후 동선',
          maxTurns: 20,
          noProgressLimit: 4,
        },
        {
          id: 'FAMILY',
          label: '가족 관계',
          maxTurns: 20,
          noProgressLimit: 4,
        },
      ],
    };
    let state = createInterrogationDynamicsState(lenientConfig);
    for (const topicId of ['ROUTE', 'FAMILY'] as const) {
      state = resolveInterrogationTurn(lenientConfig, state, {
        tacticId: 'ASK_DETAIL',
        topicId,
        claimIds: [],
      }).state;
    }
    const firstRepeat = resolveInterrogationTurn(
      lenientConfig,
      state,
      {
        tacticId: 'ASK_DETAIL',
        topicId: 'ROUTE',
        claimIds: [],
      },
    );
    const secondRepeat = resolveInterrogationTurn(
      lenientConfig,
      firstRepeat.state,
      {
        tacticId: 'ASK_DETAIL',
        topicId: 'FAMILY',
        claimIds: [],
      },
    );

    expect(secondRepeat.stalledNotice).toContain('대화 정체');
    expect(secondRepeat.topicExhausted).toBe(false);
    expect(secondRepeat.responseDirective.mode).toBe('STALLED');
  });

  it('소진된 주제를 다시 선택해도 심리 수치나 진술을 파밍하지 못한다', () => {
    const shortConfig: InterrogationDynamicsConfig = {
      ...config,
      topics: [
        { id: 'ROUTE', label: '사고 후 동선', maxTurns: 1 },
        { id: 'FAMILY', label: '가족 관계' },
      ],
    };
    const initial = createInterrogationDynamicsState(shortConfig);
    const exhausted = resolveInterrogationTurn(shortConfig, initial, {
      tacticId: 'PRESSURE',
      topicId: 'ROUTE',
      claimIds: ['C_HOME'],
    });
    const retried = resolveInterrogationTurn(
      shortConfig,
      exhausted.state,
      {
        tacticId: 'PRESSURE',
        topicId: 'ROUTE',
        claimIds: ['C_HOME'],
      },
    );

    expect(retried.psychologyDelta).toEqual({
      trust: 0,
      pressure: 0,
      guard: 0,
      protectiveness: 0,
    });
    expect(retried.state.psychology).toEqual(
      exhausted.state.psychology,
    );
    expect(retried.state.statements).toEqual(
      exhausted.state.statements,
    );
  });
});

describe('AI 역질문과 응답 지시', () => {
  it('심리 조건을 만족하면 저작된 역질문 이벤트를 한 번만 발생시킨다', () => {
    const counterConfig: InterrogationDynamicsConfig = {
      ...config,
      initialPsychology: {
        protectiveness: 50,
      },
      counterQuestionRules: [
        {
          id: 'FAMILY_BOUNDARY',
          topicIds: ['FAMILY'],
          tacticIds: ['PROBE'],
          minimumTopicTurns: 2,
          minimumProtectiveness: 60,
          question: '왜 제 딸 이야기를 계속하시는 겁니까?',
        },
      ],
    };
    const initial = createInterrogationDynamicsState(counterConfig);
    const first = resolveInterrogationTurn(counterConfig, initial, {
      tacticId: 'PROBE',
      topicId: 'FAMILY',
      claimIds: ['C_DAUGHTER'],
    });
    const second = resolveInterrogationTurn(
      counterConfig,
      first.state,
      {
        tacticId: 'PROBE',
        topicId: 'FAMILY',
        claimIds: ['C_DAUGHTER'],
      },
    );
    const third = resolveInterrogationTurn(
      counterConfig,
      second.state,
      {
        tacticId: 'PROBE',
        topicId: 'FAMILY',
        claimIds: ['C_DAUGHTER'],
      },
    );

    expect(first.counterQuestion).toBeUndefined();
    expect(second.counterQuestion).toEqual({
      kind: 'AI_COUNTER_QUESTION',
      ruleId: 'FAMILY_BOUNDARY',
      topicId: 'FAMILY',
      question: '왜 제 딸 이야기를 계속하시는 겁니까?',
    });
    expect(second.responseDirective).toMatchObject({
      mode: 'COUNTER_QUESTION',
      counterQuestion: '왜 제 딸 이야기를 계속하시는 겁니까?',
      allowedClaimIds: ['C_DAUGHTER'],
    });
    expect(third.counterQuestion).toBeUndefined();
    expect(third.state.triggeredCounterQuestionIds).toEqual([
      'FAMILY_BOUNDARY',
    ]);
  });

  it('결과 지시는 승인된 claim만 전달하고 LLM에게 상태 변경을 맡기지 않는다', () => {
    const initial = createInterrogationDynamicsState(config);
    const result = turn(initial, 'EMPATHIZE', 'FAMILY', [
      'C_DAUGHTER',
    ]);

    expect(result.responseDirective.allowedClaimIds).toEqual([
      'C_DAUGHTER',
    ]);
    expect(result.responseDirective.instruction).toContain(
      '승인된 사실',
    );
    expect(result.state.turn).toBe(1);
    expect(Object.keys(result.state)).toEqual([
      'turn',
      'psychology',
      'statements',
      'topics',
      'consecutiveNoProgressTurns',
      'triggeredCounterQuestionIds',
    ]);
  });
});
