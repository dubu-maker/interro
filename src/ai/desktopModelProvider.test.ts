import { describe, expect, it, vi } from 'vitest';
import type { InterroDesktopBridge } from '../../shared/desktopBridge';
import { DesktopModelProvider } from './desktopModelProvider';

describe('DesktopModelProvider', () => {
  it('콜백과 자격 증명 없이 모델 요청만 데스크톱 경계로 전달한다', async () => {
    const chat = vi.fn().mockResolvedValue({
      content: '집에 있었습니다.',
      inputTokens: 20,
      outputTokens: 8,
    });
    const bridge: InterroDesktopBridge = {
      runtime: 'electron',
      model: { provider: 'openai', defaultModel: 'gpt-5.6-luna' },
      chat,
    };
    const onDelta = vi.fn();
    const provider = new DesktopModelProvider(bridge);

    expect(provider.id).toBe('desktop-openai');
    await expect(
      provider.chat({
        systemPrompt: '인물로 답한다.',
        messages: [{ role: 'user', content: '어디 있었죠?' }],
        model: 'gpt-5.6-luna',
        format: 'json',
        temperature: 0,
        onDelta,
      }),
    ).resolves.toEqual({
      content: '집에 있었습니다.',
      inputTokens: 20,
      outputTokens: 8,
    });

    expect(chat).toHaveBeenCalledWith({
      systemPrompt: '인물로 답한다.',
      messages: [{ role: 'user', content: '어디 있었죠?' }],
      model: 'gpt-5.6-luna',
      format: 'json',
      temperature: 0,
    });
    expect(onDelta).toHaveBeenCalledOnce();
    expect(onDelta).toHaveBeenCalledWith('집에 있었습니다.');
  });
});
