// 사건 서류철은 별도 1막 phase가 아니라 심문 중에도 계속 여는 책상 계층이다.
// 문서 발견·감식 의뢰·해금은 닫힌 ID와 순수 상태 전이로만 처리한다.

export type DossierDocumentKind =
  | 'OFFICIAL_REPORT'
  | 'HANDWRITTEN_STATEMENT'
  | 'PHOTO_SET'
  | 'FLOOR_PLAN'
  | 'PRINTED_EXCERPT'
  | 'MEDICAL_REPORT'
  | 'LOG';

export interface DossierParagraphBlock {
  type: 'paragraph';
  id: string;
  text: string;
  tone?: 'plain' | 'lead' | 'note' | 'warning';
  quoteId?: string;
  discoveryId?: string;
}

export interface DossierFieldBlock {
  type: 'fields';
  id: string;
  rows: readonly {
    id: string;
    label: string;
    value: string;
    quoteId?: string;
    discoveryId?: string;
  }[];
}

export interface DossierTableBlock {
  type: 'table';
  id: string;
  columns: readonly string[];
  rows: readonly {
    id: string;
    cells: readonly string[];
    quoteId?: string;
    discoveryId?: string;
  }[];
}

export interface DossierPhotoHotspot {
  id: string;
  label: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  discoveryId: string;
}

export interface DossierPhotoBlock {
  type: 'photo';
  id: string;
  assetPath: string;
  alt: string;
  caption: string;
  hotspots: readonly DossierPhotoHotspot[];
}

export interface DossierPlanBlock {
  type: 'floor-plan';
  id: string;
  zones: readonly {
    id: string;
    label: string;
    detail: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

export type DossierBlock =
  | DossierParagraphBlock
  | DossierFieldBlock
  | DossierTableBlock
  | DossierPhotoBlock
  | DossierPlanBlock;

export interface DossierPage {
  id: string;
  label: string;
  blocks: readonly DossierBlock[];
}

export interface DossierDocument {
  id: string;
  group: 'INITIAL' | 'REFERENCE' | 'EXAMINATION' | 'RESULT';
  kind: DossierDocumentKind;
  title: string;
  documentNumber?: string;
  organization?: string;
  pages: readonly DossierPage[];
}

export interface DossierDiscovery {
  id: string;
  documentId: string;
  sourceId: string;
  observation: string;
  note?: string;
}

export interface DossierQuote {
  id: string;
  documentId: string;
  sourceId: string;
  text: string;
  mapping?: {
    suspectId: string;
    claimId: string;
  };
  unmappedReactionLine?: string;
}

export interface DossierRequest {
  id: string;
  label: string;
  description: string;
  kind: 'FORENSIC' | 'RECORDS' | 'RESTORATION';
  slotCost: 0 | 1;
  resultDocumentIds: readonly string[];
  resultEvidenceIds: readonly string[];
  resultNotice: string;
  lockedReason: string;
  privateResult?: boolean;
}

export type DossierPredicate =
  | { type: 'document-opened'; documentId: string }
  | { type: 'discovery-found'; discoveryId: string }
  | { type: 'request-completed'; requestId: string }
  | { type: 'evidence-acquired'; evidenceId: string }
  | { type: 'claim-recorded'; suspectId: string; claimId: string }
  | { type: 'stage'; suspectId: string; stageId: string };

export interface DossierRequirement {
  allOf?: readonly DossierPredicate[];
  anyOf?: readonly DossierPredicate[];
}

export type DossierGrant =
  | { type: 'document'; documentId: string }
  | { type: 'request'; requestId: string }
  | { type: 'evidence'; evidenceId: string };

export interface DossierUnlockRule {
  id: string;
  when: DossierRequirement;
  grants: readonly DossierGrant[];
  notice?: string;
}

export interface DossierDefinition {
  title: string;
  caseNumber: string;
  officialTheory: string;
  openAtStart?: boolean;
  forensicSlotCount: number;
  initialDocumentIds: readonly string[];
  initialRequestIds: readonly string[];
  documents: readonly DossierDocument[];
  discoveries: readonly DossierDiscovery[];
  requests: readonly DossierRequest[];
  quotes: readonly DossierQuote[];
  unlocks: readonly DossierUnlockRule[];
}

export interface DossierState {
  acquiredDocumentIds: readonly string[];
  openedDocumentIds: readonly string[];
  foundDiscoveryIds: readonly string[];
  availableRequestIds: readonly string[];
  completedRequestIds: readonly string[];
  firedUnlockRuleIds: readonly string[];
  spentForensicSlots: number;
}

export interface DossierSnapshot {
  acquiredEvidenceIds: ReadonlySet<string>;
  recordedClaims: ReadonlySet<string>;
  stages: ReadonlyMap<string, string>;
}

export type DossierAction =
  | { type: 'OPEN_DOCUMENT'; documentId: string }
  | {
      type: 'INSPECT_DISCOVERY';
      documentId: string;
      discoveryId: string;
    }
  | { type: 'REQUEST_ANALYSIS'; requestId: string };

export type DossierOutcomeCode =
  | 'OK'
  | 'INVALID'
  | 'LOCKED'
  | 'ALREADY_DONE'
  | 'NO_SLOTS';

export interface DossierOutcome {
  accepted: boolean;
  code: DossierOutcomeCode;
  state: DossierState;
  newDocumentIds: string[];
  newRequestIds: string[];
  newEvidenceIds: string[];
  newDiscoveryIds: string[];
  notices: string[];
}

export interface DossierQuoteOutcome {
  valid: boolean;
  quote?: DossierQuote;
  mappedClaimId?: string;
  reactionLine?: string;
}

interface MutableDossierState {
  acquiredDocumentIds: Set<string>;
  openedDocumentIds: Set<string>;
  foundDiscoveryIds: Set<string>;
  availableRequestIds: Set<string>;
  completedRequestIds: Set<string>;
  firedUnlockRuleIds: Set<string>;
  spentForensicSlots: number;
}

function mutableState(state: DossierState): MutableDossierState {
  return {
    acquiredDocumentIds: new Set(state.acquiredDocumentIds),
    openedDocumentIds: new Set(state.openedDocumentIds),
    foundDiscoveryIds: new Set(state.foundDiscoveryIds),
    availableRequestIds: new Set(state.availableRequestIds),
    completedRequestIds: new Set(state.completedRequestIds),
    firedUnlockRuleIds: new Set(state.firedUnlockRuleIds),
    spentForensicSlots: state.spentForensicSlots,
  };
}

function freezeState(state: MutableDossierState): DossierState {
  return {
    acquiredDocumentIds: [...state.acquiredDocumentIds],
    openedDocumentIds: [...state.openedDocumentIds],
    foundDiscoveryIds: [...state.foundDiscoveryIds],
    availableRequestIds: [...state.availableRequestIds],
    completedRequestIds: [...state.completedRequestIds],
    firedUnlockRuleIds: [...state.firedUnlockRuleIds],
    spentForensicSlots: state.spentForensicSlots,
  };
}

export function createDossierState(
  definition: DossierDefinition,
): DossierState {
  return {
    acquiredDocumentIds: [...definition.initialDocumentIds],
    openedDocumentIds: [],
    foundDiscoveryIds: [],
    availableRequestIds: [...definition.initialRequestIds],
    completedRequestIds: [],
    firedUnlockRuleIds: [],
    spentForensicSlots: 0,
  };
}

function sourceIds(document: DossierDocument): Set<string> {
  const ids = new Set<string>();
  for (const page of document.pages) {
    for (const block of page.blocks) {
      ids.add(block.id);
      if (block.type === 'fields' || block.type === 'table') {
        for (const row of block.rows) ids.add(row.id);
      }
      if (block.type === 'photo') {
        for (const hotspot of block.hotspots) ids.add(hotspot.id);
      }
      if (block.type === 'floor-plan') {
        for (const zone of block.zones) ids.add(zone.id);
      }
    }
  }
  return ids;
}

function predicateSatisfied(
  predicate: DossierPredicate,
  state: MutableDossierState,
  snapshot: DossierSnapshot,
  acquiredEvidenceIds: ReadonlySet<string>,
): boolean {
  switch (predicate.type) {
    case 'document-opened':
      return state.openedDocumentIds.has(predicate.documentId);
    case 'discovery-found':
      return state.foundDiscoveryIds.has(predicate.discoveryId);
    case 'request-completed':
      return state.completedRequestIds.has(predicate.requestId);
    case 'evidence-acquired':
      return acquiredEvidenceIds.has(predicate.evidenceId);
    case 'claim-recorded':
      return snapshot.recordedClaims.has(
        `${predicate.suspectId}:${predicate.claimId}`,
      );
    case 'stage':
      return snapshot.stages.get(predicate.suspectId) === predicate.stageId;
  }
}

function requirementSatisfied(
  requirement: DossierRequirement,
  state: MutableDossierState,
  snapshot: DossierSnapshot,
  acquiredEvidenceIds: ReadonlySet<string>,
): boolean {
  const allSatisfied = (requirement.allOf ?? []).every((predicate) =>
    predicateSatisfied(predicate, state, snapshot, acquiredEvidenceIds),
  );
  const anyOf = requirement.anyOf ?? [];
  const anySatisfied =
    anyOf.length === 0 ||
    anyOf.some((predicate) =>
      predicateSatisfied(predicate, state, snapshot, acquiredEvidenceIds),
    );
  return allSatisfied && anySatisfied;
}

function settleUnlocks(
  definition: DossierDefinition,
  state: MutableDossierState,
  snapshot: DossierSnapshot,
  seedEvidenceIds: readonly string[],
): Omit<DossierOutcome, 'accepted' | 'code' | 'state' | 'newDiscoveryIds'> {
  const newDocumentIds: string[] = [];
  const newRequestIds: string[] = [];
  const newEvidenceIds = [...seedEvidenceIds];
  const notices: string[] = [];
  const acquiredEvidenceIds = new Set([
    ...snapshot.acquiredEvidenceIds,
    ...seedEvidenceIds,
  ]);

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of definition.unlocks) {
      if (state.firedUnlockRuleIds.has(rule.id)) continue;
      if (
        !requirementSatisfied(
          rule.when,
          state,
          snapshot,
          acquiredEvidenceIds,
        )
      ) {
        continue;
      }

      state.firedUnlockRuleIds.add(rule.id);
      changed = true;
      for (const grant of rule.grants) {
        if (grant.type === 'document') {
          if (!state.acquiredDocumentIds.has(grant.documentId)) {
            state.acquiredDocumentIds.add(grant.documentId);
            newDocumentIds.push(grant.documentId);
          }
        } else if (grant.type === 'request') {
          if (!state.availableRequestIds.has(grant.requestId)) {
            state.availableRequestIds.add(grant.requestId);
            newRequestIds.push(grant.requestId);
          }
        } else if (!acquiredEvidenceIds.has(grant.evidenceId)) {
          acquiredEvidenceIds.add(grant.evidenceId);
          newEvidenceIds.push(grant.evidenceId);
        }
      }
      if (rule.notice) notices.push(rule.notice);
    }
  }

  return {
    newDocumentIds,
    newRequestIds,
    newEvidenceIds,
    notices,
  };
}

function outcome(
  accepted: boolean,
  code: DossierOutcomeCode,
  state: DossierState,
  additions: Partial<
    Pick<
      DossierOutcome,
      | 'newDocumentIds'
      | 'newRequestIds'
      | 'newEvidenceIds'
      | 'newDiscoveryIds'
      | 'notices'
    >
  > = {},
): DossierOutcome {
  return {
    accepted,
    code,
    state,
    newDocumentIds: additions.newDocumentIds ?? [],
    newRequestIds: additions.newRequestIds ?? [],
    newEvidenceIds: additions.newEvidenceIds ?? [],
    newDiscoveryIds: additions.newDiscoveryIds ?? [],
    notices: additions.notices ?? [],
  };
}

export function synchronizeDossier(
  definition: DossierDefinition,
  state: DossierState,
  snapshot: DossierSnapshot,
): DossierOutcome {
  const next = mutableState(state);
  const settled = settleUnlocks(definition, next, snapshot, []);
  return outcome(true, 'OK', freezeState(next), settled);
}

export function resolveDossierAction(
  definition: DossierDefinition,
  state: DossierState,
  snapshot: DossierSnapshot,
  action: DossierAction,
): DossierOutcome {
  const next = mutableState(state);
  const newDiscoveryIds: string[] = [];
  const requestDocumentIds: string[] = [];
  const seedEvidenceIds: string[] = [];
  const actionNotices: string[] = [];

  if (action.type === 'OPEN_DOCUMENT') {
    if (!next.acquiredDocumentIds.has(action.documentId)) {
      return outcome(false, 'LOCKED', state);
    }
    if (
      !definition.documents.some(
        (document) => document.id === action.documentId,
      )
    ) {
      return outcome(false, 'INVALID', state);
    }
    if (next.openedDocumentIds.has(action.documentId)) {
      return outcome(true, 'ALREADY_DONE', state);
    }
    next.openedDocumentIds.add(action.documentId);
  } else if (action.type === 'INSPECT_DISCOVERY') {
    const document = definition.documents.find(
      (entry) => entry.id === action.documentId,
    );
    const discovery = definition.discoveries.find(
      (entry) => entry.id === action.discoveryId,
    );
    if (
      !document ||
      !discovery ||
      discovery.documentId !== action.documentId ||
      !sourceIds(document).has(discovery.sourceId)
    ) {
      return outcome(false, 'INVALID', state);
    }
    if (
      !next.acquiredDocumentIds.has(action.documentId) ||
      !next.openedDocumentIds.has(action.documentId)
    ) {
      return outcome(false, 'LOCKED', state);
    }
    if (next.foundDiscoveryIds.has(action.discoveryId)) {
      return outcome(true, 'ALREADY_DONE', state);
    }
    next.foundDiscoveryIds.add(action.discoveryId);
    newDiscoveryIds.push(action.discoveryId);
    actionNotices.push(discovery.observation);
  } else {
    const request = definition.requests.find(
      (entry) => entry.id === action.requestId,
    );
    if (!request) return outcome(false, 'INVALID', state);
    if (!next.availableRequestIds.has(request.id)) {
      return outcome(false, 'LOCKED', state);
    }
    if (next.completedRequestIds.has(request.id)) {
      return outcome(true, 'ALREADY_DONE', state);
    }
    if (
      request.slotCost > 0 &&
      next.spentForensicSlots + request.slotCost >
        definition.forensicSlotCount
    ) {
      return outcome(false, 'NO_SLOTS', state);
    }
    next.completedRequestIds.add(request.id);
    next.spentForensicSlots += request.slotCost;
    for (const documentId of request.resultDocumentIds) {
      if (!next.acquiredDocumentIds.has(documentId)) {
        next.acquiredDocumentIds.add(documentId);
        requestDocumentIds.push(documentId);
      }
    }
    for (const evidenceId of request.resultEvidenceIds) {
      if (!snapshot.acquiredEvidenceIds.has(evidenceId)) {
        seedEvidenceIds.push(evidenceId);
      }
    }
    actionNotices.push(request.resultNotice);
  }

  const settled = settleUnlocks(
    definition,
    next,
    snapshot,
    seedEvidenceIds,
  );
  return outcome(true, 'OK', freezeState(next), {
    ...settled,
    newDocumentIds: [
      ...requestDocumentIds,
      ...settled.newDocumentIds,
    ],
    newDiscoveryIds,
    notices: [...actionNotices, ...settled.notices],
  });
}

export function resolveDossierQuote(
  definition: DossierDefinition,
  state: DossierState,
  suspectId: string,
  quoteId: string,
): DossierQuoteOutcome {
  const quote = definition.quotes.find((entry) => entry.id === quoteId);
  if (
    !quote ||
    !state.acquiredDocumentIds.includes(quote.documentId) ||
    !state.openedDocumentIds.includes(quote.documentId)
  ) {
    return { valid: false };
  }
  const mapping =
    quote.mapping?.suspectId === suspectId ? quote.mapping : undefined;
  return {
    valid: true,
    quote,
    ...(mapping ? { mappedClaimId: mapping.claimId } : {}),
    ...(!mapping && quote.unmappedReactionLine
      ? { reactionLine: quote.unmappedReactionLine }
      : {}),
  };
}
