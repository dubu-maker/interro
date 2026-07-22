export type DesktopChatRole = 'user' | 'assistant';

export interface DesktopChatMessage {
  readonly role: DesktopChatRole;
  readonly content: string;
}

export interface DesktopModelRequest {
  readonly systemPrompt: string;
  readonly messages: readonly DesktopChatMessage[];
  readonly model: string;
  readonly format?: 'json';
  readonly temperature?: number;
}

export interface DesktopModelResponse {
  readonly content: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export type DesktopModelProviderKind = 'ollama' | 'openai';

export interface DesktopModelConfiguration {
  readonly provider: DesktopModelProviderKind;
  readonly defaultModel: string;
}

export interface InterroDesktopBridge {
  readonly runtime: 'electron';
  readonly model: DesktopModelConfiguration;
  chat(request: DesktopModelRequest): Promise<DesktopModelResponse>;
}
