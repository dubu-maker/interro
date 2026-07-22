import { describe, expect, it } from 'vitest';
import {
  buildOpenAiResponsesRequest,
  describeOpenAiHttpError,
  openAiTestModel,
  parseOpenAiResponsesPayload,
  resolveDesktopModelConfiguration,
} from './openaiResponses.js';

const request = {
  systemPrompt: '용의자의 인물 계약',
  messages: [{ role: 'user' as const, content: '어디에 있었습니까?' }],
  model: 'renderer가 보낸 모델명',
  temperature: 2,
};

describe('OpenAI Responses 요청', () => {
  it('OpenAI 모드에서 가장 저렴한 5.6 모델만 선택한다', () => {
    expect(resolveDesktopModelConfiguration({ INTERRO_AI_PROVIDER: 'openai' }))
      .toEqual({ provider: 'openai', defaultModel: openAiTestModel });
    expect(resolveDesktopModelConfiguration({ INTERRO_AI_PROVIDER: 'OPENAI' }))
      .toEqual({ provider: 'openai', defaultModel: openAiTestModel });
  });

  it('기본값은 Ollama이며 로컬 모델만 환경변수로 바꾼다', () => {
    expect(resolveDesktopModelConfiguration({})).toEqual({
      provider: 'ollama',
      defaultModel: 'qwen2.5:14b',
    });
    expect(
      resolveDesktopModelConfiguration({ INTERRO_OLLAMA_MODEL: 'local-model' }),
    ).toEqual({ provider: 'ollama', defaultModel: 'local-model' });
  });

  it('renderer의 모델·temperature를 무시하고 비용 상한을 고정한다', () => {
    expect(buildOpenAiResponsesRequest(request)).toEqual({
      model: 'gpt-5.6-luna',
      store: false,
      instructions: '용의자의 인물 계약',
      input: [{ role: 'user', content: '어디에 있었습니까?' }],
      reasoning: { effort: 'none' },
      max_output_tokens: 384,
      text: { verbosity: 'medium' },
    });
  });

  it('계획자 호출은 JSON 모드와 더 작은 출력 상한을 쓴다', () => {
    expect(
      buildOpenAiResponsesRequest({ ...request, format: 'json' }),
    ).toMatchObject({
      model: 'gpt-5.6-luna',
      max_output_tokens: 256,
      text: { verbosity: 'low', format: { type: 'json_object' } },
    });
  });
});

describe('OpenAI Responses 응답', () => {
  it('모든 message의 output_text와 토큰 사용량을 모은다', () => {
    expect(
      parseOpenAiResponsesPayload({
        output: [
          { type: 'reasoning', summary: [] },
          {
            type: 'message',
            content: [{ type: 'output_text', text: '첫 문장.' }],
          },
          {
            type: 'message',
            content: [{ type: 'output_text', text: '둘째 문장.' }],
          },
        ],
        usage: { input_tokens: 123, output_tokens: 45 },
      }),
    ).toEqual({
      content: '첫 문장.\n둘째 문장.',
      inputTokens: 123,
      outputTokens: 45,
    });
  });

  it('거부와 빈 응답을 사용자에게 안전한 오류로 바꾼다', () => {
    expect(() =>
      parseOpenAiResponsesPayload({
        output: [
          { type: 'message', content: [{ type: 'refusal', refusal: 'no' }] },
        ],
      }),
    ).toThrow('답변 생성을 거부');
    expect(() => parseOpenAiResponsesPayload({ output: [] })).toThrow(
      '빈 답변',
    );
  });

  it('불완전한 답변은 일부 텍스트가 있어도 사용하지 않는다', () => {
    expect(() =>
      parseOpenAiResponsesPayload({
        status: 'incomplete',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '잘린 답변' }],
          },
        ],
      }),
    ).toThrow('출력 한도 전에 중단');
  });

  it('인증·잔액·서비스 오류에서 원격 본문을 노출하지 않는다', () => {
    const payload = {
      error: { code: 'insufficient_quota', message: '원격 상세 메시지' },
    };
    expect(describeOpenAiHttpError(401, payload)).toContain('인증');
    expect(describeOpenAiHttpError(429, payload)).toContain('크레딧');
    expect(describeOpenAiHttpError(500, payload)).not.toContain('원격 상세');
  });
});
