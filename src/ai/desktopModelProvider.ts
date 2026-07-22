import type { InterroDesktopBridge } from '../../shared/desktopBridge';
import type { ChatRequest, ChatResponse, ModelProvider } from './types';

// 렌더러에는 공급자 자격 증명이나 원격 주소를 주지 않는다. 검증된 모델
// 요청만 Electron main으로 보내고, main이 로컬/원격 공급자를 선택한다.
export class DesktopModelProvider implements ModelProvider {
  readonly id: string;

  constructor(private readonly bridge: InterroDesktopBridge) {
    this.id = `desktop-${bridge.model.provider}`;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.bridge.chat({
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      model: request.model,
      ...(request.format ? { format: request.format } : {}),
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature }),
    });

    // IPC는 검증이 끝난 최종 응답만 반환한다. ModelProvider의 선택적
    // 스트리밍 계약은 유지하되, 승인된 전체 문장을 한 조각으로 전달한다.
    request.onDelta?.(response.content);
    return response;
  }
}
