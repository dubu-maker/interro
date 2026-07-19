import { describe, expect, it } from 'vitest';
import { suspect } from '../cases/prototype/fixture';
import { buildSystemPrompt } from './promptBuilder';

describe('buildSystemPrompt', () => {
  it('언락 전에는 비밀 내용을 포함하지 않는다', () => {
    const prompt = buildSystemPrompt(suspect, []);
    expect(prompt).not.toContain('21:38');
    expect(prompt).not.toContain('태블릿');
    expect(prompt).not.toContain('언성을 높이는');
  });

  it('언락 후에는 인정할 사실과 태도를 포함한다', () => {
    const prompt = buildSystemPrompt(suspect, ['S1']);
    expect(prompt).toContain('21:38');
    expect(prompt).toContain('태블릿');
    expect(prompt).toContain('살해는 강하게 부인');
  });
});
