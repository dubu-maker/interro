export type PsychologyTrialPhase =
  | 'SESSION_ONE'
  | 'SESSION_TWO'
  | 'FINALE'
  | 'COURT';

export type ContradictionKind = 'PHYSICAL' | 'SUPPORTING';
export type ForensicResolution = 'DIRECT' | 'COMBINATION' | 'SUPPORT';
export type PsychologyImpact =
  | 'CONFIRMED'
  | 'COMMITMENT_LOCKED'
  | 'NO_EFFECT'
  | 'SPECIAL_EVENT';

export interface ForensicOption {
  id: string;
  evidenceId: string;
  label: string;
  description: string;
  resolution: ForensicResolution;
  targetContradictionId?: string;
  requiredEvidenceIds: readonly string[];
  opportunityCost: string;
}

export interface ProbeDefinition {
  id: string;
  evidenceId: string;
  question: string;
  reactionLine: string;
  resultEvidenceId: string;
  contradictionId: string;
}

export interface ContradictionRule {
  id: string;
  label: string;
  kind: ContradictionKind;
  requiredClaimIds: readonly string[];
  // 바깥 배열은 any-of, 안쪽 배열은 all-of다.
  evidencePaths: readonly (readonly string[])[];
  recordEvidenceId: string;
  // 플레이어의 질문으로 이 주장을 다시 고정하면, 물증이 없어도 잠긴
  // 모순 슬롯을 보여준다. 고착 자체는 확정 모순이나 법정 논거가 아니다.
  commitment?: {
    claimIds: readonly string[];
    notice: string;
  };
}

export interface PsychologyStageRule {
  stageId: string;
  minimumContradictions: number;
  minimumPhysicalContradictions?: number;
}

export interface FinaleChoice {
  id: string;
  label: string;
  responseLine: string;
  sincerity: boolean;
}

export interface AutoEvidenceUnlock {
  evidenceId: string;
  minimumContradictions: number;
  minimumPhysicalContradictions?: number;
}

export interface SpecialConfrontation {
  id: string;
  evidenceId: string;
  targetStageId: string;
  targetPhase: Extract<PsychologyTrialPhase, 'SESSION_TWO' | 'FINALE'>;
  notice: string;
  reactionLine: string;
  recordClaimIds?: readonly string[];
}

export interface PsychologyTrialDefinition {
  minimumTurnsBeforeForensics: number;
  forensicSelectionCount: number;
  forensicOptions: readonly ForensicOption[];
  probes: readonly ProbeDefinition[];
  contradictions: readonly ContradictionRule[];
  // 앞에서부터 검사하며, 조건을 만족한 마지막 규칙의 단계가 적용된다.
  stageRules: readonly PsychologyStageRule[];
  initialStageId: string;
  finaleStageId: string;
  // 기본값은 true. false인 사건은 의미 기반 특수 사건이 피날레를 연다.
  automaticFinaleAtStage?: boolean;
  sincereStageId: string;
  finaleAnchorLine: string;
  finaleChoices: readonly FinaleChoice[];
  autoEvidenceUnlocks: readonly AutoEvidenceUnlock[];
  specialConfrontations?: readonly SpecialConfrontation[];
}

export interface PsychologyTrialState {
  phase: PsychologyTrialPhase;
  selectedForensicOptionIds: readonly string[];
  presentedEvidenceIds: readonly string[];
  usedProbeIds: readonly string[];
  failedProbeIds: readonly string[];
  lockedContradictionIds: readonly string[];
  confirmedContradictionIds: readonly string[];
  unlockedAutomaticEvidenceIds: readonly string[];
  triggeredSpecialEventIds: readonly string[];
  stageId: string;
  sincerity: boolean;
}

export interface ForensicCommitResult {
  state: PsychologyTrialState;
  evidenceIds: string[];
}

export interface ConfrontationInput {
  presentedEvidenceId: string;
  recordedClaimIds: readonly string[];
}

export interface PsychologyProgressResult {
  state: PsychologyTrialState;
  impact: PsychologyImpact;
  newlyLockedContradictionIds: string[];
  newlyConfirmedContradictionIds: string[];
  recordEvidenceIds: string[];
  automaticEvidenceIds: string[];
  // UI가 사건 기록에 바로 합칠 수 있도록 두 종류를 합친 목록이다.
  unlockedEvidenceIds: string[];
  specialEvent?: SpecialConfrontation;
}

export interface ProbeResolution extends PsychologyProgressResult {
  probe: ProbeDefinition;
  reactionLine: string;
  resultEvidenceId: string;
}

export interface FinaleResolution {
  state: PsychologyTrialState;
  choice: FinaleChoice;
  responseLine: string;
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items)];
}

function requirePhase(
  state: PsychologyTrialState,
  allowed: readonly PsychologyTrialPhase[],
  action: string,
): void {
  if (!allowed.includes(state.phase)) {
    throw new Error(`${action}할 수 없는 단계입니다: ${state.phase}`);
  }
}

function findForensicOption(
  definition: PsychologyTrialDefinition,
  optionId: string,
): ForensicOption {
  const option = definition.forensicOptions.find(
    (entry) => entry.id === optionId,
  );
  if (!option) throw new Error(`알 수 없는 감식 선택지: ${optionId}`);
  return option;
}

function findProbe(
  definition: PsychologyTrialDefinition,
  probeId: string,
): ProbeDefinition {
  const probe = definition.probes.find((entry) => entry.id === probeId);
  if (!probe) throw new Error(`알 수 없는 떠보기: ${probeId}`);
  return probe;
}

function findContradiction(
  definition: PsychologyTrialDefinition,
  contradictionId: string,
): ContradictionRule {
  const contradiction = definition.contradictions.find(
    (entry) => entry.id === contradictionId,
  );
  if (!contradiction) {
    throw new Error(`알 수 없는 모순: ${contradictionId}`);
  }
  return contradiction;
}

function physicalContradictionCount(
  definition: PsychologyTrialDefinition,
  contradictionIds: readonly string[],
): number {
  const physicalIds = new Set(
    definition.contradictions
      .filter((entry) => entry.kind === 'PHYSICAL')
      .map((entry) => entry.id),
  );
  return unique(contradictionIds).filter((id) => physicalIds.has(id)).length;
}

function thresholdSatisfied(
  minimumContradictions: number,
  minimumPhysicalContradictions: number | undefined,
  contradictionCount: number,
  physicalCount: number,
): boolean {
  return (
    contradictionCount >= minimumContradictions &&
    physicalCount >= (minimumPhysicalContradictions ?? 0)
  );
}

function advanceStage(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
): PsychologyTrialState {
  const contradictionCount = unique(
    state.confirmedContradictionIds,
  ).length;
  const physicalCount = physicalContradictionCount(
    definition,
    state.confirmedContradictionIds,
  );
  let stageId = definition.initialStageId;

  for (const rule of definition.stageRules) {
    if (
      thresholdSatisfied(
        rule.minimumContradictions,
        rule.minimumPhysicalContradictions,
        contradictionCount,
        physicalCount,
      )
    ) {
      stageId = rule.stageId;
    }
  }

  return {
    ...state,
    stageId,
    phase:
      definition.automaticFinaleAtStage !== false &&
      stageId === definition.finaleStageId &&
      state.phase !== 'COURT'
        ? 'FINALE'
        : state.phase,
  };
}

function unlockAutomaticEvidence(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
): {
  state: PsychologyTrialState;
  automaticEvidenceIds: string[];
} {
  const contradictionCount = unique(
    state.confirmedContradictionIds,
  ).length;
  const physicalCount = physicalContradictionCount(
    definition,
    state.confirmedContradictionIds,
  );
  const alreadyUnlocked = new Set(state.unlockedAutomaticEvidenceIds);
  const automaticEvidenceIds: string[] = [];

  for (const unlock of definition.autoEvidenceUnlocks) {
    if (
      !alreadyUnlocked.has(unlock.evidenceId) &&
      thresholdSatisfied(
        unlock.minimumContradictions,
        unlock.minimumPhysicalContradictions,
        contradictionCount,
        physicalCount,
      )
    ) {
      alreadyUnlocked.add(unlock.evidenceId);
      automaticEvidenceIds.push(unlock.evidenceId);
    }
  }

  return {
    state: {
      ...state,
      unlockedAutomaticEvidenceIds: [...alreadyUnlocked],
    },
    automaticEvidenceIds,
  };
}

function finishProgress(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  newlyConfirmedContradictionIds: readonly string[],
  recordEvidenceIds: readonly string[],
  newlyLockedContradictionIds: readonly string[] = [],
): PsychologyProgressResult {
  const confirmed = new Set(state.confirmedContradictionIds);
  const withoutConfirmedLocks = {
    ...state,
    lockedContradictionIds: unique(state.lockedContradictionIds).filter(
      (id) => !confirmed.has(id),
    ),
  };
  const advanced = advanceStage(definition, withoutConfirmedLocks);
  const automatic = unlockAutomaticEvidence(definition, advanced);
  const records = unique(recordEvidenceIds);
  const automaticEvidenceIds = unique(automatic.automaticEvidenceIds);

  return {
    state: automatic.state,
    impact:
      newlyConfirmedContradictionIds.length > 0
        ? 'CONFIRMED'
        : newlyLockedContradictionIds.length > 0
          ? 'COMMITMENT_LOCKED'
          : 'NO_EFFECT',
    newlyLockedContradictionIds: unique(newlyLockedContradictionIds),
    newlyConfirmedContradictionIds: unique(
      newlyConfirmedContradictionIds,
    ),
    recordEvidenceIds: records,
    automaticEvidenceIds,
    unlockedEvidenceIds: unique([...records, ...automaticEvidenceIds]),
  };
}

export function createPsychologyTrialState(
  definition: PsychologyTrialDefinition,
): PsychologyTrialState {
  if (
    !Number.isInteger(definition.minimumTurnsBeforeForensics) ||
    definition.minimumTurnsBeforeForensics < 0
  ) {
    throw new Error('감식 개방 턴은 0 이상의 정수여야 합니다.');
  }
  if (
    !Number.isInteger(definition.forensicSelectionCount) ||
    definition.forensicSelectionCount <= 0 ||
    definition.forensicSelectionCount > definition.forensicOptions.length
  ) {
    throw new Error('감식 선택 수가 선택지 범위를 벗어났습니다.');
  }

  return {
    phase: 'SESSION_ONE',
    selectedForensicOptionIds: [],
    presentedEvidenceIds: [],
    usedProbeIds: [],
    failedProbeIds: [],
    lockedContradictionIds: [],
    confirmedContradictionIds: [],
    unlockedAutomaticEvidenceIds: [],
    triggeredSpecialEventIds: [],
    stageId: definition.initialStageId,
    sincerity: false,
  };
}

export function canStartForensics(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  completedTurns: number,
): boolean {
  return (
    state.phase === 'SESSION_ONE' &&
    Number.isInteger(completedTurns) &&
    completedTurns >= definition.minimumTurnsBeforeForensics
  );
}

export function toggleForensicOption(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  optionId: string,
): PsychologyTrialState {
  requirePhase(state, ['SESSION_ONE'], '감식을 선택');
  findForensicOption(definition, optionId);
  const selected = [...state.selectedForensicOptionIds];
  const index = selected.indexOf(optionId);

  if (index >= 0) {
    selected.splice(index, 1);
  } else {
    if (selected.length >= definition.forensicSelectionCount) {
      throw new Error(
        `감식은 최대 ${definition.forensicSelectionCount}개까지 선택할 수 있습니다.`,
      );
    }
    selected.push(optionId);
  }

  return { ...state, selectedForensicOptionIds: selected };
}

export function commitForensicSelection(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  completedTurns: number,
): ForensicCommitResult {
  requirePhase(state, ['SESSION_ONE'], '감식 선택을 확정');
  if (!canStartForensics(definition, state, completedTurns)) {
    throw new Error(
      `감식은 심문 ${definition.minimumTurnsBeforeForensics}턴 이후 확정할 수 있습니다.`,
    );
  }
  const selected = unique(state.selectedForensicOptionIds);
  if (selected.length !== definition.forensicSelectionCount) {
    throw new Error(
      `감식 결과를 정확히 ${definition.forensicSelectionCount}개 선택해야 합니다.`,
    );
  }

  const evidenceIds = selected.map(
    (optionId) => findForensicOption(definition, optionId).evidenceId,
  );
  return {
    state: {
      ...state,
      phase: 'SESSION_TWO',
      selectedForensicOptionIds: selected,
    },
    evidenceIds: unique(evidenceIds),
  };
}

export function resolveConfrontation(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  input: ConfrontationInput,
): PsychologyProgressResult {
  requirePhase(
    state,
    ['SESSION_ONE', 'SESSION_TWO'],
    '증거로 추궁',
  );
  const presentedEvidenceIds = unique([
    ...state.presentedEvidenceIds,
    input.presentedEvidenceId,
  ]);
  const recordedClaimIds = new Set(input.recordedClaimIds);
  const presented = new Set(presentedEvidenceIds);
  const confirmed = new Set(state.confirmedContradictionIds);
  const locked = new Set(state.lockedContradictionIds);
  const newlyConfirmedContradictionIds: string[] = [];
  const newlyLockedContradictionIds: string[] = [];
  const recordEvidenceIds: string[] = [];

  for (const contradiction of definition.contradictions) {
    if (confirmed.has(contradiction.id)) continue;
    const claimsSatisfied = contradiction.requiredClaimIds.every((id) =>
      recordedClaimIds.has(id),
    );
    const evidenceSatisfied = contradiction.evidencePaths.some(
      (path) =>
        path.length > 0 &&
        path.every((evidenceId) => presented.has(evidenceId)),
    );
    if (!claimsSatisfied) continue;
    if (!evidenceSatisfied) {
      const touchesIncompletePath = contradiction.evidencePaths.some(
        (path) =>
          path.includes(input.presentedEvidenceId) &&
          path.some((evidenceId) => !presented.has(evidenceId)),
      );
      if (touchesIncompletePath && !locked.has(contradiction.id)) {
        locked.add(contradiction.id);
        newlyLockedContradictionIds.push(contradiction.id);
      }
      continue;
    }

    confirmed.add(contradiction.id);
    locked.delete(contradiction.id);
    newlyConfirmedContradictionIds.push(contradiction.id);
    recordEvidenceIds.push(contradiction.recordEvidenceId);
  }

  const progress = finishProgress(
    definition,
    {
      ...state,
      presentedEvidenceIds,
      lockedContradictionIds: [...locked],
      confirmedContradictionIds: [...confirmed],
    },
    newlyConfirmedContradictionIds,
    recordEvidenceIds,
    newlyLockedContradictionIds,
  );
  const specialEvent = definition.specialConfrontations?.find(
    (event) =>
      event.evidenceId === input.presentedEvidenceId &&
      !state.triggeredSpecialEventIds.includes(event.id),
  );
  if (!specialEvent) return progress;

  return {
    ...progress,
    impact: 'SPECIAL_EVENT',
    specialEvent,
    state: {
      ...progress.state,
      phase: specialEvent.targetPhase,
      stageId: specialEvent.targetStageId,
      triggeredSpecialEventIds: [
        ...progress.state.triggeredSpecialEventIds,
        specialEvent.id,
      ],
    },
  };
}

export function resolveStatementCommitments(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  affirmedClaimIds: readonly string[],
  recordedClaimIds: readonly string[],
): PsychologyProgressResult {
  requirePhase(
    state,
    ['SESSION_ONE', 'SESSION_TWO'],
    '진술을 고착',
  );
  const affirmed = new Set(affirmedClaimIds);
  const recorded = new Set(recordedClaimIds);
  const confirmed = new Set(state.confirmedContradictionIds);
  const locked = new Set(state.lockedContradictionIds);
  const newlyLockedContradictionIds: string[] = [];

  for (const contradiction of definition.contradictions) {
    if (confirmed.has(contradiction.id) || locked.has(contradiction.id)) {
      continue;
    }
    const commitment = contradiction.commitment;
    if (
      !commitment ||
      !commitment.claimIds.some((claimId) => affirmed.has(claimId)) ||
      !contradiction.requiredClaimIds.every((claimId) =>
        recorded.has(claimId),
      )
    ) {
      continue;
    }
    locked.add(contradiction.id);
    newlyLockedContradictionIds.push(contradiction.id);
  }

  return finishProgress(
    definition,
    { ...state, lockedContradictionIds: [...locked] },
    [],
    [],
    newlyLockedContradictionIds,
  );
}

export function resolveProbe(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  probeId: string,
  recordedClaimIds: readonly string[],
): ProbeResolution {
  requirePhase(state, ['SESSION_ONE', 'SESSION_TWO'], '떠보기');
  const probe = findProbe(definition, probeId);
  if (state.usedProbeIds.includes(probe.id)) {
    throw new Error(`이미 사용한 떠보기입니다: ${probe.id}`);
  }
  const contradiction = findContradiction(
    definition,
    probe.contradictionId,
  );
  const alreadyConfirmed = state.confirmedContradictionIds.includes(
    contradiction.id,
  );
  const presentedEvidenceIds = unique([
    ...state.presentedEvidenceIds,
    probe.evidenceId,
    probe.resultEvidenceId,
  ]);
  const recordedClaims = new Set(recordedClaimIds);
  const presented = new Set(presentedEvidenceIds);
  const claimsSatisfied = contradiction.requiredClaimIds.every((id) =>
    recordedClaims.has(id),
  );
  const evidenceSatisfied = contradiction.evidencePaths.some(
    (path) =>
      path.length > 0 && path.every((evidenceId) => presented.has(evidenceId)),
  );
  const newlyConfirmed =
    !alreadyConfirmed && claimsSatisfied && evidenceSatisfied;
  const recordEvidenceIds = newlyConfirmed
    ? [probe.resultEvidenceId, contradiction.recordEvidenceId]
    : [probe.resultEvidenceId];
  const progress = finishProgress(
    definition,
    {
      ...state,
      presentedEvidenceIds,
      usedProbeIds: [...state.usedProbeIds, probe.id],
      failedProbeIds: [...state.failedProbeIds, probe.id],
      confirmedContradictionIds: newlyConfirmed
        ? [...state.confirmedContradictionIds, contradiction.id]
        : state.confirmedContradictionIds,
    },
    newlyConfirmed ? [contradiction.id] : [],
    recordEvidenceIds,
  );

  return {
    ...progress,
    probe,
    reactionLine: probe.reactionLine,
    resultEvidenceId: probe.resultEvidenceId,
  };
}

export function resolveFinale(
  definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
  choiceId: string,
): FinaleResolution {
  requirePhase(state, ['FINALE'], '마지막 응답을 선택');
  const choice = definition.finaleChoices.find(
    (entry) => entry.id === choiceId,
  );
  if (!choice) throw new Error(`알 수 없는 피날레 선택지: ${choiceId}`);

  return {
    state: {
      ...state,
      phase: 'COURT',
      stageId: choice.sincerity
        ? definition.sincereStageId
        : definition.finaleStageId,
      sincerity: choice.sincerity,
    },
    choice,
    responseLine: choice.responseLine,
  };
}

export function enterCourt(
  _definition: PsychologyTrialDefinition,
  state: PsychologyTrialState,
): PsychologyTrialState {
  if (state.phase === 'COURT') return state;
  requirePhase(state, ['SESSION_TWO'], '법정으로 이동');
  return { ...state, phase: 'COURT' };
}
