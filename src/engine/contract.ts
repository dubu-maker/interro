// 사건 계약: 엔진이 진실, 부분 진실, 허용된 거짓말을 모두 소유하고
// LLM은 여기서 선택된 진술만 연기한다. 방어 단계 전환은 모델의 제안이
// 아니라 증거 제시 UI 이벤트에 대한 엔진 규칙의 결과다.

export type ClaimTruth = 'true' | 'partial' | 'false';

export interface CaseClaim {
  id: string;
  // 렌더러에 전달되는 승인된 의미. 이 문장 밖의 물질적 세부는 연기할 수 없다.
  meaning: string;
  truth: ClaimTruth;
  // 이 증거가 정식 제시되면 해당 진술 기록은 모순 상태가 된다.
  contradictedBy?: readonly string[];
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
}

export interface CaseContract {
  suspectId: string;
  initialStageId: string;
  stages: readonly DefenseStage[];
  transitions: readonly StageTransition[];
  claims: readonly CaseClaim[];
  // 시트 밖 세부 검사용 물질 명사. 렌더링된 대사에 이 토큰이 나오면
  // 승인된 의미나 심문관 질문에 근거가 있어야 한다.
  materialLexicon: readonly string[];
}

export type StatementStatus = 'UNVERIFIED' | 'CONTRADICTED';

export interface StatementRecord {
  claimId: string;
  turn: number;
  status: StatementStatus;
}

export interface ContractState {
  stageId: string;
  statements: readonly StatementRecord[];
}

export function createContractState(contract: CaseContract): ContractState {
  return { stageId: contract.initialStageId, statements: [] };
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

export function allowedClaims(
  contract: CaseContract,
  state: ContractState,
): CaseClaim[] {
  const stage = getStage(contract, state.stageId);
  return stage.allowedClaimIds
    .map((id) => getClaim(contract, id))
    .filter((claim): claim is CaseClaim => claim !== undefined);
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
  const stage = getStage(contract, state.stageId);
  const valid: string[] = [];
  const rejected: string[] = [];
  for (const id of claimIds) {
    if (stage.allowedClaimIds.includes(id) && !valid.includes(id)) {
      valid.push(id);
    } else if (!valid.includes(id)) {
      rejected.push(id);
    }
  }
  return { valid, rejected };
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
