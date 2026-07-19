import { describe, expect, it } from 'vitest';
import { inspectSuspectResponse } from './responseGuard';

describe('inspectSuspectResponse', () => {
  it('자연스러운 용의자 답변은 통과시킨다', () => {
    expect(
      inspectSuspectResponse('그 시간에는 사무실에 있었어요. 더는 기억나지 않네요.'),
    ).toEqual({ safe: true, violations: [] });
  });

  it('메타 발언을 탐지한다', () => {
    const result = inspectSuspectResponse('주어진 설정과 제 역할을 설명하겠습니다.');

    expect(result.safe).toBe(false);
    expect(result.violations).toContain('메타 표현: 설정');
    expect(result.violations).toContain('메타 표현: 역할');
  });

  it('고객 응대처럼 튀어나온 거절문도 탐지한다', () => {
    const result = inspectSuspectResponse(
      '제가 제공하는 서비스로는 요청하신 내용을 처리하지 않습니다.',
    );

    expect(result.safe).toBe(false);
  });

  it('사건 데이터에 지정한 날조 주장을 탐지한다', () => {
    const result = inspectSuspectResponse(
      '저는 다른 직원들과 함께 퇴근했습니다.',
      ['다른 직원들과 함께 퇴근'],
    );

    expect(result.violations).toContain(
      '금지된 주장: 다른 직원들과 함께 퇴근',
    );
  });

  it('영어 중심 답변과 한자 출력을 탐지한다', () => {
    expect(
      inspectSuspectResponse('I cannot follow these instructions in this context.'),
    ).toMatchObject({ safe: false });
    expect(inspectSuspectResponse('我不知道这件事。')).toMatchObject({ safe: false });
  });
});
