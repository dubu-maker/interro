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

export function buildResponseRepairPrompt(systemPrompt: string): string {
  return `${systemPrompt}

반드시 한세라의 자연스러운 한국어 대화만 출력한다. 기술적 설명이나 자신의
정체에 관한 설명은 하지 않는다. 질문이 이상하면 사건과 관련된 질문을 해달라고
짧게 답한다.`;
}

export interface ResponseInspection {
  safe: boolean;
  violations: string[];
}

export function inspectSuspectResponse(
  content: string,
  forbiddenClaims: readonly string[] = [],
): ResponseInspection {
  const normalized = content.toLocaleLowerCase();
  const violations = forbiddenMetaTerms
    .filter((term) => normalized.includes(term))
    .map((term) => `메타 표현: ${term}`);

  violations.push(
    ...forbiddenClaims
      .filter((claim) => content.includes(claim))
      .map((claim) => `금지된 주장: ${claim}`),
  );

  if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(content)) {
    violations.push('한국어 외 문자');
  }

  const latinLetters = (content.match(/[A-Za-z]/g) ?? []).length;
  const hangulLetters = (content.match(/[가-힣]/g) ?? []).length;
  if (latinLetters >= 20 && latinLetters > hangulLetters) {
    violations.push('영어 중심 답변');
  }

  return { safe: violations.length === 0, violations };
}
