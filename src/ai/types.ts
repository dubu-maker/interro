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
