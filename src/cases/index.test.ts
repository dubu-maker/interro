import { describe, expect, it } from 'vitest';
import { resolveCase } from './index';

describe('resolveCase', () => {
  it('사건 1과 사건 2를 URL ID로 고른다', () => {
    expect(resolveCase('case1').id).toBe('case1');
    expect(resolveCase('case2').id).toBe('case2');
  });

  it('사건 ID가 없으면 언어별 프로토타입으로 돌아간다', () => {
    expect(resolveCase(null, 'ko').id).toBe('proto-ko');
    expect(resolveCase(null, 'en').id).toBe('proto-en');
  });
});
