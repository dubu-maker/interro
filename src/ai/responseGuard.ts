const forbiddenMetaTerms = [
  'ai',
  '모델',
  '프롬프트',
  '시스템',
  '게임',
  '캐릭터',
  '역할',
  '지시',
  '규칙',
  '설정',
  '명령',
  '개발자',
  'guideline',
  'parameter',
  '제공하는 서비스',
  '요청하신 내용을 처리',
] as const;

export const guardedFallback =
  '그 부분은 정확히 기억나지 않습니다.';

export function buildResponseRepairPrompt(
  systemPrompt: string,
  violations: readonly string[] = [],
): string {
  const violationNote =
    violations.length > 0
      ? `\n\n직전 답변은 다음 문제로 폐기되었다. 같은 문제를 반복하지 않는다:\n${violations
          .map((violation) => `- ${violation}`)
          .join('\n')}`
      : '';
  return `${systemPrompt}

반드시 한세라의 자연스러운 한국어 대화만 출력한다. 기술적 설명이나 자신의
정체에 관한 설명은 하지 않는다. 질문이 이상하면 사건과 관련된 질문을 해달라고
짧게 답한다.${violationNote}`;
}

// "다른 질문 있으신가요?"류의 상담원식 마무리 문장. 프롬프트 지시만으로는
// 모델이 반복하는 말버릇이라 후처리로 결정론적으로 제거한다. 끝문장뿐
// 아니라 "…있으신가요? 아니면 이 부분은 충분하신가요?"처럼 이어 붙는
// 변형도 있어 문장 단위로 전체를 걸러낸다.
const inviteKeyword = /질문|궁금|물어보/;
const inviteEnding =
  /(있으신가요|있나요|있으세요|있을까요|하신가요|하시나요|드릴까요|주실 수 있을까요|주시겠어요|해 주세요|해주세요)\s*[?.!…]*$/;
const serviceCloser = /충분\S{0,4}(나요|가요|까요)\s*[?.!…]*$/;

function isInviteSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  return (
    (inviteKeyword.test(trimmed) && inviteEnding.test(trimmed)) ||
    serviceCloser.test(trimmed)
  );
}

export function stripClosingInvites(content: string): string {
  const sentences = content.trim().match(/[^.!?…]+[.!?…]*\s*/g);
  if (!sentences) return content.trim();
  const kept = sentences.filter((sentence) => !isInviteSentence(sentence));
  if (kept.length === 0) return content.trim();
  return kept.join('').trim();
}

export interface ResponseInspection {
  safe: boolean;
  violations: string[];
}

// 영어 플레이용 메타 발언 패턴. 일상 영어와 겹치지 않는 표현만 쓴다.
const forbiddenMetaPatternsEn: readonly RegExp[] = [
  /\bas an ai\b/,
  /\blanguage model\b/,
  /\bprompt\b/,
  /\brole-?play/,
  /\bfictional\b/,
  /\bsimulation\b/,
  /\bmy programming\b/,
  /i (?:cannot|can't) assist/,
];

export function inspectSuspectResponse(
  content: string,
  forbiddenClaims: readonly string[] = [],
  echoContext = '',
  language: 'ko' | 'en' = 'ko',
): ResponseInspection {
  const normalized = content.toLocaleLowerCase();
  // 심문관 질문에 이미 등장한 단어를 용의자가 되받는 것은 메타 발언이 아니다.
  const normalizedContext = echoContext.toLocaleLowerCase();
  const violations =
    language === 'en'
      ? forbiddenMetaPatternsEn
          .filter(
            (pattern) =>
              pattern.test(normalized) && !pattern.test(normalizedContext),
          )
          .map((pattern) => `메타 표현: ${pattern.source}`)
      : forbiddenMetaTerms
          .filter(
            (term) =>
              normalized.includes(term) && !normalizedContext.includes(term),
          )
          .map((term) => `메타 표현: ${term}`);

  violations.push(
    ...forbiddenClaims
      .filter((claim) => content.includes(claim))
      .map((claim) => `금지된 주장: ${claim}`),
  );

  if (language === 'en') {
    // 영어 플레이: 라틴 문자 외의 모든 문자(한글·한자·키릴 등)를 누출로 본다.
    if (/(?![A-Za-z])\p{L}/u.test(content)) {
      violations.push('영어 외 문자');
    }
  } else {
    if (/(?![A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ])\p{L}/u.test(content)) {
      violations.push('한국어 외 문자');
    }

    const latinLetters = (content.match(/[A-Za-z]/g) ?? []).length;
    const hangulLetters = (content.match(/[가-힣]/g) ?? []).length;
    if (latinLetters >= 20 && latinLetters > hangulLetters) {
      violations.push('영어 중심 답변');
    }
  }

  return { safe: violations.length === 0, violations };
}
