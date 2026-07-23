// 사건 계약: 엔진이 진실, 부분 진실, 허용된 거짓말을 모두 소유하고
// LLM은 여기서 선택된 진술만 연기한다. 방어 단계 전환은 모델의 제안이
// 아니라 증거 제시 UI 이벤트에 대한 엔진 규칙의 결과다.

export type ClaimTruth = 'true' | 'partial' | 'false';

export interface CaseClaim {
  id: string;
  // 렌더러에 전달되는 승인된 의미. 이 문장 밖의 물질적 세부는 연기할 수 없다.
  meaning: string;
  // 모델 대사가 두 번 반려됐을 때 실제 인물이 말할 1인칭 안전 대사.
  // 생략하면 meaning을 그대로 사용한다.
  fallbackLine?: string;
  truth: ClaimTruth;
  // 같은 topicId 안의 서로 다른 valueId는 동시에 참일 수 없는 진술로
  // 취급한다. 자연어를 재분석하지 않고 닫힌 claim 집합만으로 번복을 잡는다.
  topicId?: string;
  valueId?: string;
  // 이 증거가 정식 제시되면 해당 진술 기록은 모순 상태가 된다.
  contradictedBy?: readonly string[];
}

export interface ClaimTopic {
  id: string;
  label: string;
  // 번복이 생겼을 때 플레이어에게 여는 저작 추궁. 자유 텍스트가 아니라
  // 사건 데이터가 소유하므로 결정론적이다.
  revisionFollowUp?: string;
}

export interface ForbiddenLinePattern {
  id: string;
  label: string;
  // 사건 작성자가 소유하는 정규식 문자열. 렌더러 출력에만 적용하며
  // 모델 프롬프트에는 패턴 원문을 노출하지 않는다.
  pattern: string;
}

export interface UndeniableFactRule {
  claimId: string;
  stageIds: readonly string[];
  // 이 사실이 강제된 턴에는 출력에도 인정 표현이 실제로 있어야 한다.
  acknowledgementPattern: string;
  // 렌더러가 두 번 실패했을 때 설명문 대신 말하게 할 자연스러운 저작 대사.
  fallbackLine: string;
  // 질문이나 정식 제시 증거가 이 사실을 직접 건드리면 planner 선택과
  // 무관하게 승인 의미에 포함한다.
  questionTerms?: readonly string[];
  evidenceIds?: readonly string[];
}

export interface PositionContract {
  stageIds: readonly string[];
  // 비밀을 포함하지 않는 현재 입장. planner와 renderer 모두에 전달한다.
  directive: string;
  // 이 단계들에서 의미를 뒤집어서는 안 되는 핵심 주장.
  protectedClaimIds: readonly string[];
  // 조회 한 번으로 확인되는 사실. 인정하되 관련성만 다투게 한다.
  undeniableFacts: readonly UndeniableFactRule[];
  forbiddenLinePatterns: readonly ForbiddenLinePattern[];
  // 두 번의 렌더링이 모두 입장을 어기면 사용하는 저작 안전 대사.
  fallbackLine: string;
}

export interface DefenseStage {
  id: string;
  // 렌더러에 전달되는 현재 방어 전략 한 줄.
  strategy: string;
  allowedClaimIds: readonly string[];
}

export interface StageTransition {
  from: string;
  to: string;
  whenEvidencePresented: string;
  unlockNotice: string;
  // 전환 직후 용의자가 내뱉는 저작 반응 대사(앵커 대사). LLM을 거치지
  // 않아 극적 순간의 품질이 보장된다.
  reactionLine?: string;
}

// 정체 시에만 노출되는 수사 노트 힌트. 힌트도 엔진이 소유한다 —
// LLM이 지어내지 않고, 아직 나오지 않은 진술이나 증거를 향해 저작된
// 문장 중에서 결정론적으로 고른다.
export interface CaseHint {
  id: string;
  text: string;
  // 이 단계들에서만 유효하다.
  stageIds: readonly string[];
  // 지정 시, 해당 claim이 아직 기록되지 않았을 때만 유효하다.
  targetClaimId?: string;
  // 지정 시, 해당 증거가 아직 제시되지 않았을 때만 유효하다.
  targetEvidenceId?: string;
}

export interface CaseContract {
  suspectId: string;
  // 심문 대사와 검증이 동작하는 언어. 계약·프롬프트·검사기가 함께 따른다.
  language: 'ko' | 'en';
  // 빈 입력창이 부담스러운 플레이어를 위한 시작 질문 제안 (심문 시작 전 표시).
  starterQuestions: readonly string[];
  // 조서처럼 심문 시작 전에 이미 공식 기록으로 커밋된 진술. 모델 출력과
  // 무관하게 0턴 진술로 생성한다.
  initialClaimIds?: readonly string[];
  initialStageId: string;
  stages: readonly DefenseStage[];
  transitions: readonly StageTransition[];
  claims: readonly CaseClaim[];
  claimTopics?: readonly ClaimTopic[];
  position?: PositionContract;
  hints: readonly CaseHint[];
  // 시트 밖 세부 검사용 물질 명사. 렌더링된 대사에 이 토큰이 나오면
  // 승인된 의미나 심문관 질문에 근거가 있어야 한다.
  materialLexicon: readonly string[];
  // 플레이어가 질문에 직접 적어도, 승인된 claim에 포함되기 전에는 모델이
  // 되받아 말할 수 없는 비공개 현장 세부.
  sealedTerms?: readonly string[];
}

export type StatementStatus = 'UNVERIFIED' | 'REVISED' | 'CONTRADICTED';

export interface StatementRecord {
  claimId: string;
  turn: number;
  status: StatementStatus;
  supersededByClaimId?: string;
}

export interface StatementRevision {
  topicId: string;
  topicLabel: string;
  previousClaimId: string;
  previousTurn: number;
  nextClaimId: string;
  nextTurn: number;
  followUpQuestion?: string;
}

export interface StatementCommitOutcome {
  state: ContractState;
  addedClaimIds: string[];
  reaffirmedClaimIds: string[];
  revisions: StatementRevision[];
}

export interface ContractState {
  stageId: string;
  statements: readonly StatementRecord[];
}

export function createContractState(contract: CaseContract): ContractState {
  const claimIds = new Set(contract.claims.map((claim) => claim.id));
  const stageIds = new Set(contract.stages.map((stage) => stage.id));
  const topics = new Map(
    (contract.claimTopics ?? []).map((topic) => [topic.id, topic]),
  );
  const initialClaimIds = contract.initialClaimIds ?? [];
  const seen = new Set<string>();
  for (const claim of contract.claims) {
    if ((claim.topicId === undefined) !== (claim.valueId === undefined)) {
      throw new Error(`진술 주제와 값은 함께 지정해야 합니다: ${claim.id}`);
    }
    if (claim.topicId !== undefined && !topics.has(claim.topicId)) {
      throw new Error(`알 수 없는 진술 주제: ${claim.topicId}`);
    }
  }
  if (contract.position) {
    for (const stageId of contract.position.stageIds) {
      if (!stageIds.has(stageId)) {
        throw new Error(`알 수 없는 입장 계약 단계: ${stageId}`);
      }
    }
    for (const claimId of contract.position.protectedClaimIds) {
      if (!claimIds.has(claimId)) {
        throw new Error(`알 수 없는 보호 입장 진술: ${claimId}`);
      }
    }
    for (const fact of contract.position.undeniableFacts) {
      if (!claimIds.has(fact.claimId)) {
        throw new Error(`알 수 없는 부인 불가 진술: ${fact.claimId}`);
      }
      for (const stageId of fact.stageIds) {
        if (!stageIds.has(stageId)) {
          throw new Error(`알 수 없는 부인 불가 사실 단계: ${stageId}`);
        }
      }
      try {
        new RegExp(fact.acknowledgementPattern, 'i');
      } catch {
        throw new Error(`잘못된 부인 불가 사실 패턴: ${fact.claimId}`);
      }
      if (!fact.fallbackLine.trim()) {
        throw new Error(`부인 불가 사실 폴백 대사가 비어 있습니다: ${fact.claimId}`);
      }
    }
    for (const rule of contract.position.forbiddenLinePatterns) {
      try {
        new RegExp(rule.pattern, 'i');
      } catch {
        throw new Error(`잘못된 입장 금칙 패턴: ${rule.id}`);
      }
    }
  }
  for (const claimId of initialClaimIds) {
    if (!claimIds.has(claimId)) {
      throw new Error(`알 수 없는 초기 진술: ${claimId}`);
    }
    if (seen.has(claimId)) {
      throw new Error(`중복된 초기 진술: ${claimId}`);
    }
    seen.add(claimId);
  }
  return {
    stageId: contract.initialStageId,
    statements: initialClaimIds.map((claimId) => ({
      claimId,
      turn: 0,
      status: 'UNVERIFIED' as const,
    })),
  };
}

export function getStage(
  contract: CaseContract,
  stageId: string,
): DefenseStage {
  const stage = contract.stages.find((entry) => entry.id === stageId);
  if (!stage) throw new Error(`알 수 없는 방어 단계: ${stageId}`);
  return stage;
}

export function getClaim(
  contract: CaseContract,
  claimId: string,
): CaseClaim | undefined {
  return contract.claims.find((claim) => claim.id === claimId);
}

export function getActivePosition(
  contract: CaseContract,
  state: ContractState,
): PositionContract | undefined {
  const position = contract.position;
  return position?.stageIds.includes(state.stageId) ? position : undefined;
}

export function allowedClaims(
  contract: CaseContract,
  state: ContractState,
): CaseClaim[] {
  const stage = getStage(contract, state.stageId);
  const position = getActivePosition(contract, state);
  const undeniableIds =
    position?.undeniableFacts
      .filter((fact) => fact.stageIds.includes(state.stageId))
      .map((fact) => fact.claimId) ?? [];
  return [...new Set([...stage.allowedClaimIds, ...undeniableIds])]
    .map((id) => getClaim(contract, id))
    .filter((claim): claim is CaseClaim => claim !== undefined);
}

export function requiredUndeniableClaimIds(
  contract: CaseContract,
  state: ContractState,
  question: string,
  evidenceId?: string,
): string[] {
  const position = getActivePosition(contract, state);
  if (!position) return [];
  const normalizedQuestion = question.toLocaleLowerCase();
  return position.undeniableFacts
    .filter(
      (fact) =>
        fact.stageIds.includes(state.stageId) &&
        ((evidenceId !== undefined &&
          fact.evidenceIds?.includes(evidenceId) === true) ||
          fact.questionTerms?.some((term) =>
            normalizedQuestion.includes(term.toLocaleLowerCase()),
          ) === true),
    )
    .map((fact) => fact.claimId);
}

export interface PresentationOutcome {
  state: ContractState;
  transition?: StageTransition;
  contradictedClaimIds: string[];
}

export function applyEvidencePresentation(
  contract: CaseContract,
  state: ContractState,
  evidenceId: string,
): PresentationOutcome {
  const transition = contract.transitions.find(
    (entry) =>
      entry.from === state.stageId &&
      entry.whenEvidencePresented === evidenceId,
  );

  const contradictedClaimIds: string[] = [];
  const statements = state.statements.map((statement) => {
    if (statement.status === 'CONTRADICTED') return statement;
    const claim = getClaim(contract, statement.claimId);
    if (claim?.contradictedBy?.includes(evidenceId)) {
      contradictedClaimIds.push(statement.claimId);
      return { ...statement, status: 'CONTRADICTED' as const };
    }
    return statement;
  });

  return {
    state: {
      stageId: transition ? transition.to : state.stageId,
      statements,
    },
    transition,
    contradictedClaimIds,
  };
}

export interface ClaimValidation {
  valid: string[];
  rejected: string[];
}

export function validatePlannedClaimIds(
  contract: CaseContract,
  state: ContractState,
  claimIds: readonly string[],
): ClaimValidation {
  const allowed = new Set(allowedClaims(contract, state).map((claim) => claim.id));
  const valid: string[] = [];
  const rejected: string[] = [];
  for (const id of claimIds) {
    if (allowed.has(id) && !valid.includes(id)) {
      valid.push(id);
    } else if (!valid.includes(id)) {
      rejected.push(id);
    }
  }
  return { valid, rejected };
}

export function commitStatements(
  contract: CaseContract,
  state: ContractState,
  claimIds: readonly string[],
  turn: number,
): StatementCommitOutcome {
  const statements = [...state.statements];
  const known = new Set(statements.map((entry) => entry.claimId));
  const addedClaimIds: string[] = [];
  const reaffirmedClaimIds: string[] = [];
  const revisions: StatementRevision[] = [];
  const topics = new Map(
    (contract.claimTopics ?? []).map((topic) => [topic.id, topic]),
  );

  for (const claimId of [...new Set(claimIds)]) {
    const claim = getClaim(contract, claimId);
    if (!claim) continue;
    if (known.has(claimId)) {
      reaffirmedClaimIds.push(claimId);
      continue;
    }

    if (claim.topicId !== undefined && claim.valueId !== undefined) {
      let previousIndex = -1;
      for (let index = statements.length - 1; index >= 0; index -= 1) {
        const statement = statements[index];
        if (!statement) continue;
        const previous = getClaim(contract, statement.claimId);
        if (
          previous?.topicId === claim.topicId &&
          previous.valueId !== undefined &&
          previous.valueId !== claim.valueId
        ) {
          previousIndex = index;
          break;
        }
      }
      const previous =
        previousIndex >= 0 ? statements[previousIndex] : undefined;
      if (previous !== undefined) {
        statements[previousIndex] = {
          ...previous,
          status:
            previous.status === 'CONTRADICTED'
              ? 'CONTRADICTED'
              : 'REVISED',
          supersededByClaimId: claimId,
        };
        const topic = topics.get(claim.topicId);
        revisions.push({
          topicId: claim.topicId,
          topicLabel: topic?.label ?? claim.topicId,
          previousClaimId: previous.claimId,
          previousTurn: previous.turn,
          nextClaimId: claimId,
          nextTurn: turn,
          ...(topic?.revisionFollowUp
            ? { followUpQuestion: topic.revisionFollowUp }
            : {}),
        });
      }
    }

    known.add(claimId);
    addedClaimIds.push(claimId);
    statements.push({ claimId, turn, status: 'UNVERIFIED' });
  }

  return {
    state:
      addedClaimIds.length === 0 && revisions.length === 0
        ? state
        : { ...state, statements },
    addedClaimIds,
    reaffirmedClaimIds,
    revisions,
  };
}

// 정체 상태에서 보여줄 힌트를 고른다. 현재 단계에서 유효하고, 목표
// claim이 아직 기록되지 않았으며, 목표 증거가 아직 제시되지 않았고,
// 이미 보여준 적 없는 첫 번째 힌트를 반환한다.
export function selectHint(
  contract: CaseContract,
  state: ContractState,
  presentedEvidenceIds: readonly string[],
  shownHintIds: readonly string[],
): CaseHint | undefined {
  const recorded = new Set(state.statements.map((entry) => entry.claimId));
  return contract.hints.find(
    (hint) =>
      hint.stageIds.includes(state.stageId) &&
      !shownHintIds.includes(hint.id) &&
      (hint.targetClaimId === undefined ||
        !recorded.has(hint.targetClaimId)) &&
      (hint.targetEvidenceId === undefined ||
        !presentedEvidenceIds.includes(hint.targetEvidenceId)),
  );
}

export function recordStatements(
  state: ContractState,
  claimIds: readonly string[],
  turn: number,
): ContractState {
  const known = new Set(state.statements.map((entry) => entry.claimId));
  const added: StatementRecord[] = [];
  for (const claimId of claimIds) {
    if (known.has(claimId)) continue;
    known.add(claimId);
    added.push({ claimId, turn, status: 'UNVERIFIED' });
  }
  if (added.length === 0) return state;
  return { ...state, statements: [...state.statements, ...added] };
}
