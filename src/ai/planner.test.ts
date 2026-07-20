import { describe, expect, it } from 'vitest';
import { hanSeraContract } from '../cases/prototype/contract';
import {
  allowedClaims,
  createContractState,
  getStage,
} from '../engine/contract';
import {
  buildFallbackPlan,
  buildPlannerPrompt,
  parsePlannerResponse,
} from './planner';

const state = createContractState(hanSeraContract);
const stage = getStage(hanSeraContract, state.stageId);
const candidates = allowedClaims(hanSeraContract, state);

describe('parsePlannerResponse', () => {
  it('정상 JSON 계획을 파싱한다', () => {
    const plan = parsePlannerResponse(
      '{"speechAct":"DENIAL","claimIds":["C_WENT_HOME"],"emotion":"CALM","counterQuestion":false}',
      candidates,
    );

    expect(plan).toMatchObject({
      speechAct: 'DENIAL',
      claimIds: ['C_WENT_HOME'],
      usedFallback: false,
    });
  });

  it('후보 밖의 claim ID는 걸러낸다', () => {
    const plan = parsePlannerResponse(
      '{"speechAct":"DENIAL","claimIds":["C_HEARD_PHONE","C_WENT_HOME","C_FAKE"],"emotion":"CALM","counterQuestion":false}',
      candidates,
    );

    expect(plan?.claimIds).toEqual(['C_WENT_HOME']);
  });

  it('JSON이 아니거나 스키마가 어긋나면 undefined를 반환한다', () => {
    expect(parsePlannerResponse('그냥 문장입니다.', candidates)).toBeUndefined();
    expect(
      parsePlannerResponse(
        '{"speechAct":"SING","claimIds":[],"emotion":"CALM","counterQuestion":false}',
        candidates,
      ),
    ).toBeUndefined();
  });

  it('claim ID는 최대 2개로 제한한다', () => {
    const plan = parsePlannerResponse(
      '{"speechAct":"DENIAL","claimIds":["C_WENT_HOME","C_KNEW_SATURDAY","C_DENY_MURDER"],"emotion":"CALM","counterQuestion":false}',
      candidates,
    );

    expect(plan?.claimIds).toHaveLength(2);
  });
});

describe('buildFallbackPlan', () => {
  it('S0에서는 부인 화행의 결정론적 계획을 만든다', () => {
    const plan = buildFallbackPlan(stage, candidates);

    expect(plan.speechAct).toBe('DENIAL');
    expect(plan.claimIds).toEqual(['C_WENT_HOME']);
    expect(plan.usedFallback).toBe(true);
    expect(plan.counterQuestion).toBe(false);
  });
});

describe('buildPlannerPrompt', () => {
  it('후보 ID와 방어 전략을 포함하고 JSON 출력을 지시한다', () => {
    const prompt = buildPlannerPrompt(stage, candidates, []);

    expect(prompt).toContain('C_WENT_HOME');
    expect(prompt).toContain(stage.strategy);
    expect(prompt).toContain('JSON만 출력');
  });
});
