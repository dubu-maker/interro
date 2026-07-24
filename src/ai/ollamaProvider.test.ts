import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from './ollamaProvider';

const request = {
  systemPrompt: '인물로 답한다.',
  messages: [{ role: 'user' as const, content: '어디 있었죠?' }],
  model: 'test-model',
};

describe('OllamaProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('일반 응답과 사용량을 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { content: '집에 있었습니다.' },
          prompt_eval_count: 20,
          eval_count: 8,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    const provider = new OllamaProvider('/api/ollama');
    await expect(provider.chat(request)).resolves.toEqual({
      content: '집에 있었습니다.',
      inputTokens: 20,
      outputTokens: 8,
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({ model: 'test-model', think: false });
  });

  it('스트리밍 조각을 전달하고 최종 응답을 조립한다', async () => {
    const body = [
      JSON.stringify({ message: { content: '집에 ' } }),
      JSON.stringify({ message: { content: '있었습니다.' } }),
      JSON.stringify({ prompt_eval_count: 20, eval_count: 8 }),
      '',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { status: 200 })),
    );
    const deltas: string[] = [];
    const provider = new OllamaProvider('/api/ollama');

    const response = await provider.chat({
      ...request,
      onDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual(['집에 ', '있었습니다.']);
    expect(response).toEqual({
      content: '집에 있었습니다.',
      inputTokens: 20,
      outputTokens: 8,
    });
  });
});
