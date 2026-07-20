import type {
  ChatRequest,
  ChatResponse,
  ModelProvider,
} from './types';

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

function parseChunk(line: string): OllamaResponse | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed) as OllamaResponse;
}

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama';

  constructor(private readonly baseUrl: string) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const stream = request.onDelta !== undefined;
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        stream,
        keep_alive: '10m',
        ...(request.format ? { format: request.format } : {}),
        options: {
          temperature: request.temperature ?? 0.35,
          num_predict: 128,
          repeat_penalty: 1.1,
        },
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages,
        ],
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as OllamaResponse;
      throw new Error(data.error ?? `Ollama 요청 실패 (${response.status})`);
    }

    if (!stream) {
      const data = (await response.json()) as OllamaResponse;
      if (data.error) throw new Error(data.error);

      const content = data.message?.content?.trim();
      if (!content) {
        throw new Error('Ollama가 빈 답변을 반환했습니다.');
      }

      return {
        content,
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
      };
    }

    if (!response.body) {
      throw new Error('Ollama 스트림을 열 수 없습니다.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    const consumeLine = (line: string): void => {
      const data = parseChunk(line);
      if (!data) return;
      if (data.error) throw new Error(data.error);

      const delta = data.message?.content ?? '';
      if (delta) {
        content += delta;
        request.onDelta?.(delta);
      }
      inputTokens = data.prompt_eval_count ?? inputTokens;
      outputTokens = data.eval_count ?? outputTokens;
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    consumeLine(buffer);

    content = content.trim();
    if (!content) throw new Error('Ollama가 빈 답변을 반환했습니다.');

    return {
      content,
      inputTokens,
      outputTokens,
    };
  }
}
