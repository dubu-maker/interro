import type { CaseContract, ContractState } from '../engine/contract';
import { allowedClaims, getClaim, getStage } from '../engine/contract';
import {
  buildFallbackPlan,
  buildPlannerPrompt,
  parsePlannerResponse,
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
  // 직전 답변이 되물음으로 끝났으면 true. 연속 반문을 막는 데 쓴다.
  lastCounterQuestion?: boolean;
  // 렌더링이 폐기될 때마다 호출된다 (UI 표시용).
  onDiscard?: (violations: string[]) => void;
}

export async function runSuspectTurn(
  request: SuspectTurnRequest,
): Promise<SuspectTurnResult> {
  const { provider, model, contract, state, suspect, question } = request;
  const stage = getStage(contract, state.stageId);
  const candidates = allowedClaims(contract, state);
  let inputTokens = 0;
  let outputTokens = 0;

  // 1차 호출: 계획자.
  const plannerPrompt = buildPlannerPrompt(
    stage,
    candidates,
    request.recentTurns,
    contract.language,
  );
  let plan: ResponsePlan | undefined;
  let plannerAttempts = 0;
  while (plannerAttempts < 2 && !plan) {
    plannerAttempts += 1;
    const planResponse = await provider.chat({
      systemPrompt: plannerPrompt,
      messages: [{ role: 'user', content: question }],
      model,
      format: 'json',
      temperature: 0,
    });
    inputTokens += planResponse.inputTokens ?? 0;
    outputTokens += planResponse.outputTokens ?? 0;
    plan = parsePlannerResponse(planResponse.content, candidates);
  }
  plan ??= buildFallbackPlan(stage, candidates);
  // 반문 빈도 캡: 직전 답변이 되물음이었으면 연속 반문을 강제로 끈다.
  if (request.lastCounterQuestion && plan.counterQuestion) {
    plan = { ...plan, counterQuestion: false };
  }

  const approvedMeanings = plan.claimIds
    .map((claimId) => getClaim(contract, claimId)?.meaning)
    .filter((meaning): meaning is string => meaning !== undefined);

  // 2차 호출: 렌더러. 위반 시 같은 계획으로만 재시도한다.
  const rendererPrompt = buildRendererPrompt(
    suspect,
    stage.strategy,
    plan,
    approvedMeanings,
    contract.language,
  );
  const inspectionInput = {
    approvedMeanings,
    question,
    materialLexicon: contract.materialLexicon,
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
    line = composeFallbackLine(approvedMeanings, contract.language);
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
