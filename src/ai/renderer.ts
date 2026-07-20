import type { SuspectSheet } from '../engine/types';
import type { ResponsePlan } from './planner';
import { inspectSuspectResponse } from './responseGuard';

// 2차 호출(렌더러): 승인된 의미만 자연스러운 대사로 표현한다.
// 전체 사건 시트, 잠긴 사실, 범인 정보는 렌더러에 주지 않는다.

const speechActDirectives: Record<ResponsePlan['speechAct'], string> = {
  DENIAL: '혐의나 주장을 부인한다.',
  PARTIAL_ADMISSION: '승인된 의미의 범위 안에서만 인정한다.',
  ADMISSION: '승인된 의미를 담담하게 인정한다.',
  DEFLECT: '직접 답을 피하고 짧게 흘린다.',
};

const emotionDirectives: Record<ResponsePlan['emotion'], string> = {
  CALM: '침착하고 절제된 어조.',
  NERVOUS: '불안해서 문장이 짧아지고 말끝이 약해진다.',
  DEFENSIVE: '방어적이고 경계하는 어조.',
  SHAKEN: '동요해서 잠시 머뭇거리는 기색이 드러난다.',
};

export function buildRendererPrompt(
  suspect: SuspectSheet,
  strategy: string,
  plan: ResponsePlan,
  approvedMeanings: readonly string[],
): string {
  const meanings =
    approvedMeanings.length > 0
      ? approvedMeanings.map((meaning) => `- ${meaning}`).join('\n')
      : '- (전달할 새 진술 없음. 이미 한 말을 짧게 유지한다.)';

  return `당신은 ${suspect.name}(${suspect.role})이다. 심문실에서 형사의
질문에 답한다. 이 사람 이외의 정체성을 설명하지 않는다.

말투와 성격: ${suspect.persona}
현재 태도: ${strategy}
감정: ${emotionDirectives[plan.emotion]}
화행: ${speechActDirectives[plan.speechAct]}

이번 답변에서 전달해도 되는 의미:
${meanings}

규칙:
- 위 의미 목록에 없는 새로운 인물, 시간, 장소, 물건, 행동을 추가하지 않는다.
- 승인된 의미를 삭제하거나 모순되게 바꾸지 않는다.
- 자연스러운 한국어 대화체 1~3문장으로 답한다.
- 형사에게 다음 질문을 청하거나 상담원처럼 응대를 마치지 않는다.
${plan.counterQuestion ? '- 마지막에 방어적인 되물음 한 문장을 붙여도 된다.' : '- 질문으로 끝내지 않는다. 물음표를 사용하지 않는다.'}`;
}

export interface RenderInspection {
  safe: boolean;
  violations: string[];
}

export interface RenderInspectionInput {
  approvedMeanings: readonly string[];
  question: string;
  materialLexicon: readonly string[];
  counterQuestion: boolean;
}

const timePattern = /\d{1,2}:\d{2}|\d{1,2}시(?:\s*\d{1,2}분)?/g;

// 렌더링된 대사가 승인된 의미 밖의 물질적 세부를 추가했는지 검사한다.
// 심문관 질문에 이미 등장한 세부를 되받는 것은 허용한다.
export function inspectRenderedLine(
  content: string,
  input: RenderInspectionInput,
): RenderInspection {
  const violations: string[] = [];
  const allowedContext = (
    input.approvedMeanings.join(' ') + ' ' + input.question
  ).toLocaleLowerCase();
  const normalized = content.toLocaleLowerCase();

  for (const token of input.materialLexicon) {
    const lowered = token.toLocaleLowerCase();
    if (normalized.includes(lowered) && !allowedContext.includes(lowered)) {
      violations.push(`시트 밖 세부: ${token}`);
    }
  }

  for (const match of content.match(timePattern) ?? []) {
    if (!allowedContext.includes(match.toLocaleLowerCase())) {
      violations.push(`승인되지 않은 시간: ${match}`);
    }
  }

  if (!input.counterQuestion && /[?？]/.test(content)) {
    violations.push('허용되지 않은 반문');
  }

  const surface = inspectSuspectResponse(content, [], allowedContext);
  violations.push(...surface.violations);

  return { safe: violations.length === 0, violations };
}

// 렌더링이 두 번 실패하면 승인된 의미를 그대로 이어 붙인 고정 대사를 쓴다.
// 표현은 딱딱해도 계약 위반이 원천적으로 불가능하다.
export function composeFallbackLine(
  approvedMeanings: readonly string[],
): string {
  if (approvedMeanings.length === 0) {
    return '그 부분은 이미 말씀드린 것 외에 더 드릴 말이 없습니다.';
  }
  return approvedMeanings
    .map((meaning) => (meaning.endsWith('.') ? meaning : `${meaning}.`))
    .join(' ');
}
