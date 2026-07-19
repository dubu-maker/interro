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

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama';

  constructor(private readonly baseUrl: string) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        stream: false,
        keep_alive: '10m',
        options: {
          temperature: 0.7,
          num_predict: 220,
        },
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages,
        ],
      }),
    });

    const data = (await response.json()) as OllamaResponse;

    if (!response.ok || data.error) {
      throw new Error(data.error ?? `Ollama 요청 실패 (${response.status})`);
    }

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
}
