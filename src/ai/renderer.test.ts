import { describe, expect, it } from 'vitest';
import { hanSeraContract } from '../cases/prototype/contract';
import { composeFallbackLine, inspectRenderedLine } from './renderer';

const s1Meanings = [
  '21시 38분에 두고 온 태블릿을 가지러 회사로 돌아왔다.',
  '사무실 앞에서 대표가 누군가와 통화하며 언성을 높이는 소리를 들었다.',
];

function inspect(
  content: string,
  overrides: Partial<Parameters<typeof inspectRenderedLine>[1]> = {},
) {
  return inspectRenderedLine(content, {
    approvedMeanings: s1Meanings,
    question: '왜 다시 회사로 돌아온 겁니까?',
    materialLexicon: hanSeraContract.materialLexicon,
    counterQuestion: false,
    ...overrides,
  });
}

describe('inspectRenderedLine', () => {
  it('승인된 의미(S1 통화 언쟁)는 정상 출력된다', () => {
    const result = inspect(
      '태블릿을 가지러 돌아왔습니다. 그때 대표님이 통화하며 언성을 높이는 소리를 들었습니다.',
    );
    expect(result).toEqual({ safe: true, violations: [] });
  });

  it('시트에 없는 물질적 세부(커피)는 거부된다', () => {
    const result = inspect(
      '태블릿을 찾으러 왔고, 대표님은 커피를 마시며 통화 중이었습니다.',
    );
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('시트 밖 세부: 커피');
  });

  it('S2에서 커피가 승인된 의미에 있으면 허용된다', () => {
    const result = inspect('대표님이 내려 준 커피를 함께 마셨습니다.', {
      approvedMeanings: [
        '대표가 내려 준 커피를 함께 마셨고, 잔 하나에 립스틱 자국이 남았다.',
      ],
    });
    expect(result.safe).toBe(true);
  });

  it('심문관 질문에 나온 세부를 되받는 것은 허용된다', () => {
    const result = inspect('커피잔에 대해서는 아는 것이 없습니다.', {
      approvedMeanings: [],
      question: '책상 위 커피잔 두 개는 어떻게 설명할 겁니까?',
    });
    expect(result.safe).toBe(true);
  });

  it('승인되지 않은 시간 표현은 거부된다', () => {
    const result = inspect('23시쯤 다른 곳에 있었습니다.', {
      approvedMeanings: [],
    });
    expect(result.safe).toBe(false);
    expect(result.violations.some((v) => v.includes('시간'))).toBe(true);
  });

  it('12시간제·콜론 표기는 같은 시각으로 허용된다', () => {
    expect(
      inspect('저녁 9시에 퇴근해서 집으로 갔습니다.', {
        approvedMeanings: ['21시에 퇴근해서 곧장 집으로 갔다.'],
      }).safe,
    ).toBe(true);
    expect(
      inspect('21:38에 다시 회사로 왔습니다.', {
        approvedMeanings: [
          '21시 38분에 두고 온 태블릿을 가지러 회사로 돌아왔다.',
        ],
        question: '왜 돌아왔습니까?',
      }).safe,
    ).toBe(true);
    expect(
      inspect('오후 11시에 회사에 있었습니다.', {
        approvedMeanings: ['21시에 퇴근해서 곧장 집으로 갔다.'],
      }).safe,
    ).toBe(false);
  });

  it('counterQuestion이 false면 질문형 종결이 거부된다', () => {
    const result = inspect('태블릿을 가지러 돌아왔습니다. 왜 그러시죠?');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('허용되지 않은 반문');
  });

  it('counterQuestion이 true면 되물음이 허용된다', () => {
    const result = inspect(
      '태블릿을 가지러 돌아왔습니다. 지금 저를 의심하시는 겁니까?',
      { counterQuestion: true },
    );
    expect(result.safe).toBe(true);
  });
});

describe('영어 플레이 모드 검사', () => {
  const enInput = {
    approvedMeanings: [
      'I came back at 9:38 PM to pick up the tablet I had left behind.',
    ],
    question: 'Why did you come back to the office?',
    materialLexicon: ['coffee', 'tablet', 'files', 'recording'],
    counterQuestion: false,
    language: 'en' as const,
  };

  it('승인된 의미의 영어 답변은 통과한다', () => {
    expect(
      inspectRenderedLine(
        'I came back at 9:38 PM to get the tablet I left behind.',
        enInput,
      ),
    ).toEqual({ safe: true, violations: [] });
  });

  it('12시간·24시간 표기를 같은 시각으로 취급한다', () => {
    expect(
      inspectRenderedLine('I returned at 21:38 for my tablet.', enInput).safe,
    ).toBe(true);
  });

  it('시트 밖 물질 세부는 단어 경계로 검사한다', () => {
    const result = inspectRenderedLine(
      'I only touched his files that night.',
      enInput,
    );
    expect(result.violations).toContain('시트 밖 세부: files');
    // "recall"이 lexicon의 "recording"과 부분 일치해도 오탐하지 않는다.
    expect(
      inspectRenderedLine('I do not recall anything else.', enInput).safe,
    ).toBe(true);
  });

  it('영어 모드에서 한글·키릴 누출을 잡는다', () => {
    const result = inspectRenderedLine(
      'I went straight home. температур',
      enInput,
    );
    expect(result.violations).toContain('영어 외 문자');
  });
});

describe('composeFallbackLine', () => {
  it('승인된 의미를 그대로 이어 붙인다', () => {
    expect(composeFallbackLine(s1Meanings)).toBe(
      '21시 38분에 두고 온 태블릿을 가지러 회사로 돌아왔다. 사무실 앞에서 대표가 누군가와 통화하며 언성을 높이는 소리를 들었다.',
    );
  });

  it('승인된 의미가 없으면 중립 문장을 쓴다', () => {
    expect(composeFallbackLine([])).toContain('더 드릴 말이 없습니다');
  });
});
