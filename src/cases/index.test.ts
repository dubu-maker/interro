import { describe, expect, it } from 'vitest';
import { resolveCase } from './index';

describe('resolveCase', () => {
  it('사건 1·2·3을 URL ID로 고른다', () => {
    expect(resolveCase('case1').id).toBe('case1');
    expect(resolveCase('case2').id).toBe('case2');
    expect(resolveCase('case3').id).toBe('case3');
  });

  it('사건 ID가 없으면 언어별 프로토타입으로 돌아간다', () => {
    expect(resolveCase(null, 'ko').id).toBe('proto-ko');
    expect(resolveCase(null, 'en').id).toBe('proto-en');
  });
});
