import { describe, expect, it } from 'vitest';
import { kimMancheolContract } from '../cases/case2/contract';
import { createContractState } from '../engine/contract';
import { runSuspectTurn } from './interrogationPipeline';
import type { ChatRequest, ChatResponse, ModelProvider } from './types';

class ScriptedProvider implements ModelProvider {
  readonly id = 'scripted';
  readonly requests: ChatRequest[] = [];

  constructor(private readonly responses: string[]) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    const content = this.responses.shift();
    if (content === undefined) throw new Error('스크립트 응답이 부족합니다.');
    return { content };
  }
}

const suspect = {
  name: '김만철',
  role: '자수자',
  persona: '공손하지만 준비한 자백을 고수한다.',
};

describe('입장 계약 심문 파이프라인', () => {
  it('자기 자백을 부정한 렌더를 두 번 폐기하고 긍정 입장 폴백을 쓴다', async () => {
    const provider = new ScriptedProvider([
      '{"speechAct":"DENIAL","claimIds":["C_I_DROVE"],"emotion":"DEFENSIVE","counterQuestion":false}',
      '제가 사고를 낸 것은 맞지 않습니다.',
      '제가 운전한 것은 아닙니다.',
    ]);

    const result = await runSuspectTurn({
      provider,
      model: 'test-model',
      contract: kimMancheolContract,
      state: createContractState(kimMancheolContract),
      suspect,
      question: '정말 당신이 운전한 게 맞습니까?',
      recentTurns: [],
    });

    expect(result.usedLineFallback).toBe(true);
    expect(result.discardedRenders).toHaveLength(2);
    expect(result.line).toContain('운전한 사람은 접니다');
    expect(result.line).not.toContain('운전한 것은 아닙니다');
    expect(provider.requests[0]?.systemPrompt).toContain('입장 계약');
    expect(provider.requests[0]?.systemPrompt).not.toContain(
      '김서연이 운전했다',
    );
  });

  it('통신 기록을 제시하면 딸 관계와 통화 사실을 계획에 강제로 합친다', async () => {
    const provider = new ScriptedProvider([
      '{"speechAct":"DEFLECT","claimIds":["C_MEMORY_BLANK"],"emotion":"NERVOUS","counterQuestion":false}',
      '김서연은 제 딸이고 그 시각 통화한 것도 맞습니다. 하지만 사고와는 관계없습니다.',
    ]);

    const result = await runSuspectTurn({
      provider,
      model: 'test-model',
      contract: kimMancheolContract,
      state: createContractState(kimMancheolContract),
      suspect,
      question: '김서연과 통화한 기록은 무엇입니까?',
      recentTurns: [],
      presentedEvidence: {
        id: 'E05',
        name: '통신 기록',
        description: '23시 52분 김서연과 4분 08초 통화했다.',
      },
    });

    expect(result.plan.speechAct).toBe('PARTIAL_ADMISSION');
    expect(result.plan.claimIds).toEqual([
      'C_DAUGHTER_IDENTITY',
      'C_CALL_OCCURRED',
    ]);
    expect(result.usedLineFallback).toBe(false);
  });
});
