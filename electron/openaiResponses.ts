import type {
  DesktopModelConfiguration,
  DesktopModelRequest,
  DesktopModelResponse,
} from '../shared/desktopBridge.js';

export const openAiResponsesUrl = 'https://api.openai.com/v1/responses';
export const openAiTestModel = 'gpt-5.6-luna';

const localModel = 'qwen2.5:14b';

export function resolveDesktopModelConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): DesktopModelConfiguration {
  return environment['INTERRO_AI_PROVIDER']?.trim().toLocaleLowerCase() ===
    'openai'
    ? { provider: 'openai', defaultModel: openAiTestModel }
    : {
        provider: 'ollama',
        defaultModel:
          environment['INTERRO_OLLAMA_MODEL']?.trim() || localModel,
      };
}

interface OpenAiInputMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface OpenAiResponsesRequestBody {
  readonly model: typeof openAiTestModel;
  readonly store: false;
  readonly instructions: string;
  readonly input: readonly OpenAiInputMessage[];
  readonly reasoning: { readonly effort: 'none' };
  readonly max_output_tokens: number;
  readonly text: {
    readonly verbosity: 'low' | 'medium';
    readonly format?: { readonly type: 'json_object' };
  };
}

// OpenAI 경로의 모델과 비용 관련 옵션은 main이 고정한다. renderer가 보낸
// 모델명·temperature를 신뢰하지 않아 비싼 별칭으로 바꾸거나 출력을
// 무제한 늘릴 수 없다.
export function buildOpenAiResponsesRequest(
  request: DesktopModelRequest,
): OpenAiResponsesRequestBody {
  const structured = request.format === 'json';
  return {
    model: openAiTestModel,
    store: false,
    instructions: request.systemPrompt,
    input: request.messages.map(({ role, content }) => ({ role, content })),
    reasoning: { effort: 'none' },
    max_output_tokens: structured ? 256 : 384,
    text: {
      verbosity: structured ? 'low' : 'medium',
      ...(structured ? { format: { type: 'json_object' as const } } : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function parseOpenAiResponsesPayload(
  payload: unknown,
): DesktopModelResponse {
  if (!isRecord(payload)) {
    throw new Error('OpenAI가 잘못된 응답을 반환했습니다.');
  }

  if (payload['status'] === 'incomplete') {
    throw new Error('OpenAI 답변이 출력 한도 전에 중단됐습니다.');
  }

  const textParts: string[] = [];
  let refused = false;
  const output = payload['output'];
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!isRecord(item) || item['type'] !== 'message') continue;
      const content = item['content'];
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!isRecord(part)) continue;
        if (part['type'] === 'output_text' && typeof part['text'] === 'string') {
          textParts.push(part['text']);
        } else if (part['type'] === 'refusal') {
          refused = true;
        }
      }
    }
  }

  const content = textParts.join('\n').trim();
  if (!content) {
    throw new Error(
      refused
        ? 'OpenAI가 이 답변 생성을 거부했습니다.'
        : 'OpenAI가 빈 답변을 반환했습니다.',
    );
  }

  const usage = isRecord(payload['usage']) ? payload['usage'] : undefined;
  const inputTokens = usage
    ? optionalNumber(usage, 'input_tokens')
    : undefined;
  const outputTokens = usage
    ? optionalNumber(usage, 'output_tokens')
    : undefined;

  return {
    content,
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
}

export function describeOpenAiHttpError(
  status: number,
  payload: unknown,
): string {
  const error = isRecord(payload) && isRecord(payload['error'])
    ? payload['error']
    : undefined;
  const code = error && typeof error['code'] === 'string' ? error['code'] : '';

  if (status === 401) return 'OpenAI API 키 인증에 실패했습니다.';
  if (status === 403) return '이 API 키에는 모델 호출 권한이 없습니다.';
  if (status === 429 && code === 'insufficient_quota') {
    return 'OpenAI 크레딧 또는 사용 한도를 확인해 주세요.';
  }
  if (status === 429) return 'OpenAI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return 'OpenAI 서비스가 일시적으로 응답하지 않습니다.';
  return `OpenAI 요청에 실패했습니다. (${status})`;
}
