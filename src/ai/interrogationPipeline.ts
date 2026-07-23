import type { CaseContract, ContractState } from '../engine/contract';
import {
  allowedClaims,
  getActivePosition,
  getClaim,
  getStage,
  requiredUndeniableClaimIds,
} from '../engine/contract';
import {
  buildFallbackPlan,
  buildPlannerPrompt,
  parsePlannerResponse,
  type InterrogationDirection,
  type ResponsePlan,
} from './planner';
import {
  buildRendererPrompt,
  composeFallbackLine,
  inspectRenderedLine,
  type SuspectPersona,
} from './renderer';
import { stripClosingInvites } from './responseGuard';
import type { ChatMessage, ModelProvider } from './types';

// 심문 한 턴의 공용 파이프라인: 계획(claim ID 선택) → 렌더링(승인된 의미만
// 대사화) → 검증 → 실패 시 재렌더링 → 고정 대사. UI와 시뮬레이터가 같은
// 경로를 쓴다. 상태 변경은 하지 않는다 — 커밋은 호출자가 한다.

export interface DiscardedRender {
  content: string;
  violations: string[];
}

export interface SuspectTurnResult {
  line: string;
  plan: ResponsePlan;
  plannerAttempts: number;
  renderAttempts: number;
  usedLineFallback: boolean;
  discardedRenders: DiscardedRender[];
  inputTokens: number;
  outputTokens: number;
}

export interface SuspectTurnRequest {
  provider: ModelProvider;
  model: string;
  contract: CaseContract;
  state: ContractState;
  suspect: SuspectPersona;
  question: string;
  recentTurns: readonly ChatMessage[];
  // 탁자에 올려 둔 증거. 계획·렌더·검사 문맥에 포함되어 용의자가
  // 해당 증거를 자연스럽게 언급할 수 있다 (전환은 엔진이 별도 처리).
  presentedEvidence?: { id: string; name: string; description: string };
  // 자유 문장은 그대로 전달하되, 플레이어가 고른 닫힌 전술·주제로
  // 이번 대화의 방향을 명시한다. 하드 판정은 호출자가 별도로 처리한다.
  interaction?: InterrogationDirection;
  // 직전 답변이 되물음으로 끝났으면 true. 연속 반문을 막는 데 쓴다.
  lastCounterQuestion?: boolean;
  // 렌더링이 폐기될 때마다 호출된다 (UI 표시용).
  onDiscard?: (violations: string[]) => void;
}

export async function runSuspectTurn(
  request: SuspectTurnRequest,
): Promise<SuspectTurnResult> {
  const { provider, model, contract, state, suspect, question } = request;
  const evidence = request.presentedEvidence;
  const evidenceNote = evidence
    ? contract.language === 'en'
      ? `
[Evidence on the table: ${evidence.name} — ${evidence.description}]`
      : `
[탁자 위 증거: ${evidence.name} — ${evidence.description}]`
    : '';
  const stage = getStage(contract, state.stageId);
  const position = getActivePosition(contract, state);
  const allCandidates = allowedClaims(contract, state);
  const preferredClaimIds = new Set(
    request.interaction?.preferredClaimIds ?? [],
  );
  const focusedCandidates = allCandidates.filter((candidate) =>
    preferredClaimIds.has(candidate.id),
  );
  // 플레이어가 주제를 명시한 사건에서는 그 주제의 공개 claim만 planner
  // 선택지로 준다. 부인 불가 사실과 진술 고정 claim은 아래에서 별도로
  // 주입하므로, 자유 질문이 주제 밖 진술을 우연히 끌어내지 못한다.
  const candidates =
    request.interaction && focusedCandidates.length > 0
      ? focusedCandidates
      : allCandidates;
  const plannerInteraction = request.interaction
    ? {
        ...request.interaction,
        preferredClaimIds: candidates.map((candidate) => candidate.id),
      }
    : undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  // 1차 호출: 계획자.
  const plannerPrompt = buildPlannerPrompt(
    stage,
    candidates,
    request.recentTurns,
    contract.language,
    suspect.name,
    position,
    plannerInteraction,
  );
  let plan: ResponsePlan | undefined;
  let plannerAttempts = 0;
  while (plannerAttempts < 2 && !plan) {
    plannerAttempts += 1;
    const planResponse = await provider.chat({
      systemPrompt: plannerPrompt,
      messages: [{ role: 'user', content: question + evidenceNote }],
      model,
      format: 'json',
      temperature: 0,
    });
    inputTokens += planResponse.inputTokens ?? 0;
    outputTokens += planResponse.outputTokens ?? 0;
    plan = parsePlannerResponse(planResponse.content, candidates);
  }
  plan ??= buildFallbackPlan(stage, candidates);
  const requiredClaimIds = requiredUndeniableClaimIds(
    contract,
    state,
    question,
    evidence?.id,
  );
  const requiredFacts =
    position?.undeniableFacts.filter((fact) =>
      requiredClaimIds.includes(fact.claimId),
    ) ?? [];
  const allowedCandidateIds = new Set(
    allCandidates.map((candidate) => candidate.id),
  );
  const forcedClaimIds = (request.interaction?.forceClaimIds ?? []).filter(
    (claimId) => allowedCandidateIds.has(claimId),
  );
  const injectedClaimIds = [...requiredClaimIds, ...forcedClaimIds];
  if (injectedClaimIds.length > 0) {
    plan = {
      ...plan,
      speechAct: 'PARTIAL_ADMISSION',
      claimIds: [
        ...new Set([...injectedClaimIds, ...plan.claimIds]),
      ].slice(0, 2),
    };
  }
  // 반문 빈도 캡: 직전 답변이 되물음이었으면 연속 반문을 강제로 끈다.
  if (request.lastCounterQuestion && plan.counterQuestion) {
    plan = { ...plan, counterQuestion: false };
  }
  if (request.interaction?.allowModelCounterQuestion === false) {
    plan = { ...plan, counterQuestion: false };
  }

  const approvedMeanings = plan.claimIds
    .map((claimId) => getClaim(contract, claimId)?.meaning)
    .filter((meaning): meaning is string => meaning !== undefined);

  // 2차 호출: 렌더러. 위반 시 같은 계획으로만 재시도한다.
  const evidenceContext = evidence
    ? contract.language === 'en'
      ? `

The detective has just placed evidence on the table: ${evidence.name} — ${evidence.description}. You may refer to it.`
      : `

형사가 방금 탁자에 증거를 올려놓았다: ${evidence.name} — ${evidence.description}. 이 증거를 언급해도 된다.`
    : '';
  const rendererPrompt =
    buildRendererPrompt(
      suspect,
      stage.strategy,
      plan,
      approvedMeanings,
      contract.language,
      position,
      request.interaction,
    ) + evidenceContext;
  const inspectionInput = {
    approvedMeanings,
    question: evidence
      ? `${question} ${evidence.name} ${evidence.description}`
      : question,
    materialLexicon: contract.materialLexicon,
    sealedTerms: contract.sealedTerms,
    forbiddenLinePatterns: position?.forbiddenLinePatterns,
    requiredLinePatterns: requiredFacts.map((fact) => ({
      id: fact.claimId,
      label: getClaim(contract, fact.claimId)?.meaning ?? fact.claimId,
      pattern: fact.acknowledgementPattern,
    })),
    counterQuestion: plan.counterQuestion,
    language: contract.language,
  };
  const discardedRenders: DiscardedRender[] = [];
  let line = '';
  let lineAccepted = false;
  let renderAttempts = 0;
  while (renderAttempts < 2 && !lineAccepted) {
    renderAttempts += 1;
    const rendered = await provider.chat({
      systemPrompt:
        renderAttempts === 1
          ? rendererPrompt
          : `${rendererPrompt}\n\n직전 답변은 규칙 위반으로 폐기되었다. 승인된 의미만 다시 표현한다.`,
      messages: [{ role: 'user', content: question }],
      model,
    });
    inputTokens += rendered.inputTokens ?? 0;
    outputTokens += rendered.outputTokens ?? 0;
    // 상담원식 마무리 제거는 한국어 전용. 영어는 물음표 규칙이 대신 막는다.
    line =
      contract.language === 'ko'
        ? stripClosingInvites(rendered.content)
        : rendered.content.trim();
    const inspection = inspectRenderedLine(line, inspectionInput);
    if (inspection.safe) {
      lineAccepted = true;
    } else {
      discardedRenders.push({
        content: rendered.content,
        violations: inspection.violations,
      });
      request.onDiscard?.(inspection.violations);
    }
  }
  if (!lineAccepted) {
    const claimFallbackLines = plan.claimIds
      .map((claimId) => getClaim(contract, claimId))
      .filter((claim) => claim !== undefined)
      .map((claim) => claim.fallbackLine ?? claim.meaning);
    const approvedFallback = composeFallbackLine(
      claimFallbackLines,
      contract.language,
    );
    const positionCoveredClaimIds = new Set([
      ...(position?.protectedClaimIds ?? []),
      ...requiredClaimIds,
    ]);
    const supplementalMeanings = plan.claimIds
      .filter((claimId) => !positionCoveredClaimIds.has(claimId))
      .map((claimId) => getClaim(contract, claimId))
      .filter((claim) => claim !== undefined)
      .map((claim) => claim.fallbackLine ?? claim.meaning);
    const supplementalFallback =
      supplementalMeanings.length > 0
        ? composeFallbackLine(supplementalMeanings, contract.language)
        : '';
    const undeniableFallback = requiredFacts
      .map((fact) => fact.fallbackLine)
      .join(' ');
    line = position
      ? [
          position.fallbackLine,
          undeniableFallback,
          supplementalFallback,
        ]
          .filter(Boolean)
          .join(' ')
      : approvedFallback;
  }

  return {
    line,
    plan,
    plannerAttempts,
    renderAttempts,
    usedLineFallback: !lineAccepted,
    discardedRenders,
    inputTokens,
    outputTokens,
  };
}
