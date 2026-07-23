import type { ResponsePlan } from './planner';
import { inspectSuspectResponse } from './responseGuard';
import type {
  ForbiddenLinePattern,
  PositionContract,
} from '../engine/contract';

// 2차 호출(렌더러): 승인된 의미만 자연스러운 대사로 표현한다.
// 전체 사건 시트, 잠긴 사실, 범인 정보는 렌더러에 주지 않는다.

export type PlayLanguage = 'ko' | 'en';

export interface SuspectPersona {
  name: string;
  role: string;
  persona: string;
}

const speechActDirectives: Record<ResponsePlan['speechAct'], string> = {
  DENIAL:
    '형사의 추론이나 관련성만 부인한다. 승인된 사실과 현재 입장은 뒤집지 않는다.',
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

const speechActDirectivesEn: Record<ResponsePlan['speechAct'], string> = {
  DENIAL:
    'Deny only the detective’s inference or relevance. Never reverse an approved fact or the current position.',
  PARTIAL_ADMISSION: 'Admit only what is within the approved meanings.',
  ADMISSION: 'Calmly acknowledge the approved meanings.',
  DEFLECT: 'Avoid answering directly; keep it brief.',
};

const emotionDirectivesEn: Record<ResponsePlan['emotion'], string> = {
  CALM: 'Calm, restrained tone.',
  NERVOUS: 'Anxious; sentences get short and trail off.',
  DEFENSIVE: 'Guarded, defensive tone.',
  SHAKEN: 'Visibly rattled; brief hesitation shows.',
};

export function buildRendererPrompt(
  suspect: SuspectPersona,
  strategy: string,
  plan: ResponsePlan,
  approvedMeanings: readonly string[],
  language: PlayLanguage = 'ko',
  position?: PositionContract,
): string {
  const positionBlock = position
    ? language === 'en'
      ? `Position contract: ${position.directive}\n`
      : `입장 계약: ${position.directive}\n`
    : '';
  if (language === 'en') {
    const meanings =
      approvedMeanings.length > 0
        ? approvedMeanings.map((meaning) => `- ${meaning}`).join('\n')
        : '- (Nothing new to convey. Briefly hold to what you have already said.)';

    return `You are ${suspect.name} (${suspect.role}), being questioned by a
detective in an interrogation room. Never describe yourself as anyone or
anything else.

Voice and personality: ${suspect.persona}
Current stance: ${strategy}
${positionBlock}
Emotion: ${emotionDirectivesEn[plan.emotion]}
Speech act: ${speechActDirectivesEn[plan.speechAct]}

Meanings you may convey in this reply:
${meanings}

Rules:
- Do not add any new people, times, places, objects, or actions beyond the meanings above.
- Do not drop or contradict the approved meanings.
- Never reverse the position contract or deny a fact marked as undeniable.
- Reply in natural spoken English, 1-3 sentences.
- Do not invite further questions or wrap up like a customer-service agent.
${plan.counterQuestion ? '- You may end with one defensive counter-question.' : '- Do not end with a question. Do not use question marks.'}`;
  }

  const meanings =
    approvedMeanings.length > 0
      ? approvedMeanings.map((meaning) => `- ${meaning}`).join('\n')
      : '- (전달할 새 진술 없음. 이미 한 말을 짧게 유지한다.)';

  return `당신은 ${suspect.name}(${suspect.role})이다. 심문실에서 형사의
질문에 답한다. 이 사람 이외의 정체성을 설명하지 않는다.

말투와 성격: ${suspect.persona}
현재 태도: ${strategy}
${positionBlock}
감정: ${emotionDirectives[plan.emotion]}
화행: ${speechActDirectives[plan.speechAct]}

이번 답변에서 전달해도 되는 의미:
${meanings}

규칙:
- 위 의미 목록에 없는 새로운 인물, 시간, 장소, 물건, 행동을 추가하지 않는다.
- 승인된 의미를 삭제하거나 모순되게 바꾸지 않는다.
- 입장 계약과 부인 불가 사실을 뒤집지 않는다. 관련성만 다툰다.
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
  sealedTerms?: readonly string[];
  forbiddenLinePatterns?: readonly ForbiddenLinePattern[];
  requiredLinePatterns?: readonly ForbiddenLinePattern[];
  counterQuestion: boolean;
  language?: PlayLanguage;
}

const timePattern =
  /\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)|\d{1,2}시(?:\s*\d{1,2}분)?/gi;

function toHour24(hour: number, meridiem: string): number {
  if (meridiem === 'pm' && hour < 12) return hour + 12;
  if (meridiem === 'am' && hour === 12) return 0;
  return hour;
}

function parseTimeExpression(
  raw: string,
): { hour: number; minute?: number } | undefined {
  const value = raw.trim().toLocaleLowerCase();
  let match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/.exec(value);
  if (match) {
    const meridiem = match[3];
    const hour = meridiem
      ? toHour24(Number(match[1]), meridiem)
      : Number(match[1]);
    return { hour, minute: Number(match[2]) };
  }
  match = /^(\d{1,2})\s*(am|pm)$/.exec(value);
  if (match) {
    return { hour: toHour24(Number(match[1]), match[2] ?? '') };
  }
  match = /^(\d{1,2})시(?:\s*(\d{1,2})분)?$/.exec(value);
  if (match) {
    return {
      hour: Number(match[1]),
      minute: match[2] !== undefined ? Number(match[2]) : undefined,
    };
  }
  return undefined;
}

// "오후 9시"·"9:38 PM"·"21:38"·"21시 38분"을 같은 시각으로 취급한다.
function timeExpressionAllowed(match: string, context: string): boolean {
  if (context.includes(match)) return true;
  const parsed = parseTimeExpression(match);
  if (!parsed) return false;
  const twin = parsed.hour < 12 ? parsed.hour + 12 : parsed.hour - 12;
  const hours = [parsed.hour, twin].filter((h) => h >= 0 && h <= 23);
  const variants: string[] = [];
  for (const hour of hours) {
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const meridiem = hour < 12 ? 'am' : 'pm';
    if (parsed.minute !== undefined) {
      const padded = String(parsed.minute).padStart(2, '0');
      variants.push(
        `${hour}시 ${parsed.minute}분`,
        `${hour}:${padded}`,
        `${hour12}:${padded} ${meridiem}`,
        `${hour12}:${padded}${meridiem}`,
      );
    } else {
      variants.push(`${hour}시`, `${hour12} ${meridiem}`, `${hour12}${meridiem}`);
    }
  }
  return variants.some((variant) => context.includes(variant));
}

function materialTokenPresent(
  text: string,
  token: string,
  language: PlayLanguage,
): boolean {
  if (language === 'en') {
    return new RegExp(`\\b${token}\\b`, 'i').test(text);
  }
  return text.includes(token);
}

// 렌더링된 대사가 승인된 의미 밖의 물질적 세부를 추가했는지 검사한다.
// 심문관 질문에 이미 등장한 세부를 되받는 것은 허용한다.
export function inspectRenderedLine(
  content: string,
  input: RenderInspectionInput,
): RenderInspection {
  const language = input.language ?? 'ko';
  const violations: string[] = [];
  const allowedContext = (
    input.approvedMeanings.join(' ') + ' ' + input.question
  ).toLocaleLowerCase();
  const normalized = content.toLocaleLowerCase();

  const approvedContext = input.approvedMeanings
    .join(' ')
    .toLocaleLowerCase();
  for (const term of input.sealedTerms ?? []) {
    const lowered = term.toLocaleLowerCase();
    if (
      materialTokenPresent(normalized, lowered, language) &&
      !materialTokenPresent(approvedContext, lowered, language)
    ) {
      violations.push(`봉인된 세부: ${term}`);
    }
  }

  for (const rule of input.forbiddenLinePatterns ?? []) {
    if (new RegExp(rule.pattern, 'i').test(content)) {
      violations.push(`입장 계약 위반: ${rule.label}`);
    }
  }
  for (const rule of input.requiredLinePatterns ?? []) {
    if (!new RegExp(rule.pattern, 'i').test(content)) {
      violations.push(`부인 불가 사실 누락: ${rule.label}`);
    }
  }

  for (const token of input.materialLexicon) {
    const lowered = token.toLocaleLowerCase();
    if (
      materialTokenPresent(normalized, lowered, language) &&
      !materialTokenPresent(allowedContext, lowered, language)
    ) {
      violations.push(`시트 밖 세부: ${token}`);
    }
  }

  for (const match of content.match(timePattern) ?? []) {
    if (!timeExpressionAllowed(match.toLocaleLowerCase(), allowedContext)) {
      violations.push(`승인되지 않은 시간: ${match}`);
    }
  }

  if (!input.counterQuestion && /[?？]/.test(content)) {
    violations.push('허용되지 않은 반문');
  }

  const surface = inspectSuspectResponse(content, [], allowedContext, language);
  violations.push(...surface.violations);

  return { safe: violations.length === 0, violations };
}

// 렌더링이 두 번 실패하면 승인된 의미를 그대로 이어 붙인 고정 대사를 쓴다.
// 표현은 딱딱해도 계약 위반이 원천적으로 불가능하다.
export function composeFallbackLine(
  approvedMeanings: readonly string[],
  language: PlayLanguage = 'ko',
): string {
  if (approvedMeanings.length === 0) {
    return language === 'en'
      ? 'I have nothing to add beyond what I have already told you.'
      : '그 부분은 이미 말씀드린 것 외에 더 드릴 말이 없습니다.';
  }
  return approvedMeanings
    .map((meaning) => (meaning.endsWith('.') ? meaning : `${meaning}.`))
    .join(' ');
}
