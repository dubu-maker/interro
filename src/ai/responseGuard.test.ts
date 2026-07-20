import { describe, expect, it } from 'vitest';
import {
  buildResponseRepairPrompt,
  inspectSuspectResponse,
  stripClosingInvites,
} from './responseGuard';

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

  it('심문관 질문에 나온 단어를 되받는 것은 메타 발언으로 잡지 않는다', () => {
    const echoAnswer = '누군가로부터 협박이나 지시를 받은 적은 없습니다.';

    expect(inspectSuspectResponse(echoAnswer)).toMatchObject({ safe: false });
    expect(
      inspectSuspectResponse(
        echoAnswer,
        [],
        '누군가로부터 협박이나 지시를 받은 게 있습니까?',
      ),
    ).toEqual({ safe: true, violations: [] });
  });

  it('키릴 문자 등 라틴·한글 외 문자 누출을 탐지한다', () => {
    const result = inspectSuspectResponse(
      '그런 일은 전혀 기억나지 않습니다.температур',
    );

    expect(result.safe).toBe(false);
    expect(result.violations).toContain('한국어 외 문자');
    expect(inspectSuspectResponse('私は知りません。')).toMatchObject({ safe: false });
  });
});

describe('buildResponseRepairPrompt', () => {
  it('위반 내용을 재생성 프롬프트에 포함한다', () => {
    const prompt = buildResponseRepairPrompt('기본 프롬프트', [
      '금지된 주장: 중요한 자료',
    ]);

    expect(prompt).toContain('같은 문제를 반복하지 않는다');
    expect(prompt).toContain('- 금지된 주장: 중요한 자료');
  });

  it('위반 목록이 없으면 기존 형태를 유지한다', () => {
    const prompt = buildResponseRepairPrompt('기본 프롬프트');

    expect(prompt).toContain('기본 프롬프트');
    expect(prompt).not.toContain('같은 문제를 반복하지 않는다');
  });
});

describe('stripClosingInvites', () => {
  it('상담원식 마무리 문장을 제거한다', () => {
    expect(
      stripClosingInvites('21시에 퇴근했습니다. 다른 질문 있으신가요?'),
    ).toBe('21시에 퇴근했습니다.');
    expect(
      stripClosingInvites(
        '커피잔에 대해선 모르겠습니다. 다른 내용으로 질문해 주실 수 있을까요?',
      ),
    ).toBe('커피잔에 대해선 모르겠습니다.');
  });

  it('이어 붙는 변형과 중간에 낀 마무리 문장도 제거한다', () => {
    expect(
      stripClosingInvites(
        '회사 근처에도 가지 않았습니다. 다른 질문 있으신가요? 아니면 이 부분은 충분하시나요?',
      ),
    ).toBe('회사 근처에도 가지 않았습니다.');
    expect(
      stripClosingInvites(
        '대표님의 일은 다음 날 아침에야 알게 되었습니다. 다른 점이 궁금하신가요?',
      ),
    ).toBe('대표님의 일은 다음 날 아침에야 알게 되었습니다.');
  });

  it('방어적인 되묻기와 일반 답변은 그대로 둔다', () => {
    expect(stripClosingInvites('왜 저한테 그런 질문을 하시죠?')).toBe(
      '왜 저한테 그런 질문을 하시죠?',
    );
    expect(stripClosingInvites('그날 밤 집에 있었습니다.')).toBe(
      '그날 밤 집에 있었습니다.',
    );
  });

  it('마무리 문장만으로 된 답변은 비우지 않는다', () => {
    expect(stripClosingInvites('다른 질문 있으신가요?')).toBe(
      '다른 질문 있으신가요?',
    );
  });
});
