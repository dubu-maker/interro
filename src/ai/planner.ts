import type {
  CaseClaim,
  DefenseStage,
  PositionContract,
} from '../engine/contract';
import type { ChatMessage } from './types';

// 1차 호출(계획자): 자유 텍스트가 아니라 엔진이 준 후보 중에서
// claim ID와 화행만 고른다. 새 사건 문장을 쓰게 하지 않는다.

export const speechActs = [
  'DENIAL',
  'PARTIAL_ADMISSION',
  'ADMISSION',
  'DEFLECT',
] as const;
export type SpeechAct = (typeof speechActs)[number];

export const emotions = ['CALM', 'NERVOUS', 'DEFENSIVE', 'SHAKEN'] as const;
export type Emotion = (typeof emotions)[number];

export interface ResponsePlan {
  speechAct: SpeechAct;
  claimIds: string[];
  emotion: Emotion;
  counterQuestion: boolean;
  // planner 실패로 결정론적 기본 계획을 사용한 경우 true.
  usedFallback: boolean;
}

export function buildPlannerPrompt(
  stage: DefenseStage,
  candidates: readonly CaseClaim[],
  recentTurns: readonly ChatMessage[],
  language: 'ko' | 'en' = 'ko',
  suspectName = language === 'en' ? 'the suspect' : '용의자',
  position?: PositionContract,
): string {
  const undeniableIds = new Set(
    position?.undeniableFacts.map((fact) => fact.claimId) ?? [],
  );
  const candidateList = candidates
    .map(
      (claim) =>
        `- ${claim.id}${undeniableIds.has(claim.id) ? ' [UNDENIABLE FACT]' : ''}: ${claim.meaning}`,
    )
    .join('\n');
  const positionBlock = position
    ? language === 'en'
      ? `\nPosition contract: ${position.directive}\n`
      : `\n입장 계약: ${position.directive}\n`
    : '';

  if (language === 'en') {
    const recentEn = recentTurns
      .map(
        (message) =>
          `${message.role === 'user' ? 'Detective' : 'Suspect'}: ${message.content}`,
      )
      .join('\n');

    return `You are the response planner for an interrogation scene. Decide how
${suspectName} reacts to the detective's question. Do not write dialogue —
output JSON only.

Current defense strategy: ${stage.strategy}
${positionBlock}

Available claim candidates (never pick outside these IDs):
${candidateList}

Recent conversation:
${recentEn || '(none)'}

Rules:
- Pick 1-2 claimIds directly relevant to the detective's question.
- If no candidate is relevant, return an empty array.
- Never deny the position contract or an [UNDENIABLE FACT]. Dispute only its
  relevance to the accusation.
- Set counterQuestion to true only when the suspect would defensively ask back.
- The suspect never asks the detective for case information. A counter-question
  may only push back on the accusation or its logic, and should be rare.

Output JSON only, with this schema:
{"speechAct": "DENIAL" | "PARTIAL_ADMISSION" | "ADMISSION" | "DEFLECT",
 "claimIds": string[],
 "emotion": "CALM" | "NERVOUS" | "DEFENSIVE" | "SHAKEN",
 "counterQuestion": boolean}`;
  }

  const recent = recentTurns
    .map(
      (message) =>
        `${message.role === 'user' ? '형사' : '용의자'}: ${message.content}`,
    )
    .join('\n');

  return `너는 심문 장면의 응답 계획자다. 형사의 질문에 대한 용의자
${suspectName}의 반응을 결정한다. 대사를 쓰지 말고 JSON만 출력한다.

현재 방어 전략: ${stage.strategy}
${positionBlock}

사용 가능한 진술 후보 (이 ID 밖에서는 절대 고르지 않는다):
${candidateList}

최근 대화:
${recent || '(없음)'}

규칙:
- claimIds는 형사의 질문과 직접 관련된 후보만 1~2개 고른다.
- 질문과 관련된 후보가 없으면 빈 배열을 반환한다.
- 입장 계약과 [UNDENIABLE FACT]는 부정하지 않는다. 확인 가능한 사실은
  인정하고, 혐의와의 관련성만 다툰다.
- counterQuestion은 용의자가 방어적으로 되물을 때만 true로 한다.
- 용의자는 수사관에게 사건 정보를 묻지 않는다. 되물음은 혐의나 추론에
  대한 반박일 때만, 드물게 쓴다.

다음 스키마의 JSON만 출력한다:
{"speechAct": "DENIAL" | "PARTIAL_ADMISSION" | "ADMISSION" | "DEFLECT",
 "claimIds": string[],
 "emotion": "CALM" | "NERVOUS" | "DEFENSIVE" | "SHAKEN",
 "counterQuestion": boolean}`;
}

export function parsePlannerResponse(
  raw: string,
  candidates: readonly CaseClaim[],
): ResponsePlan | undefined {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;

  const data = parsed as Record<string, unknown>;
  const speechAct = data['speechAct'];
  const emotion = data['emotion'];
  if (!speechActs.includes(speechAct as SpeechAct)) return undefined;
  if (!emotions.includes(emotion as Emotion)) return undefined;

  const candidateIds = new Set(candidates.map((claim) => claim.id));
  const rawClaimIds = Array.isArray(data['claimIds']) ? data['claimIds'] : [];
  const claimIds = rawClaimIds
    .filter((id): id is string => typeof id === 'string')
    .filter((id) => candidateIds.has(id))
    .slice(0, 2);

  return {
    speechAct: speechAct as SpeechAct,
    claimIds,
    emotion: emotion as Emotion,
    counterQuestion: data['counterQuestion'] === true,
    usedFallback: false,
  };
}

// planner가 두 번 실패했을 때 쓰는 결정론적 기본 계획.
// 현재 단계의 첫 번째 후보를 방어 전략에 맞는 화행으로 반복한다.
export function buildFallbackPlan(
  stage: DefenseStage,
  candidates: readonly CaseClaim[],
): ResponsePlan {
  const first = candidates[0];
  return {
    speechAct: stage.id === 'S0' ? 'DENIAL' : 'PARTIAL_ADMISSION',
    claimIds: first ? [first.id] : [],
    emotion: 'DEFENSIVE',
    counterQuestion: false,
    usedFallback: true,
  };
}
