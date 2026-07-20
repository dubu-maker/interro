export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  systemPrompt: string;
  messages: readonly ChatMessage[];
  model: string;
  onDelta?: (delta: string) => void;
  // 'json'이면 공급자에게 JSON 형식 출력을 강제한다 (계획자 호출용).
  format?: 'json';
  // 미지정 시 공급자 기본값. 계획자는 0으로 결정성을 높인다.
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ModelProvider {
  readonly id: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
