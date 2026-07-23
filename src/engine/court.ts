import type { ContradictionKind } from './psychologyTrial';

export type CourtOutcome =
  | 'TRUTH_CONVICTION'
  | 'SELF_SURRENDER'
  | 'WRONGFUL_CONVICTION'
  | 'ACQUITTAL_INSUFFICIENT'
  | 'RELATIVE_EXCEPTION'
  | 'CHARGE_MISMATCH'
  | 'UNRESOLVED';

export interface CourtCandidate {
  id: string;
  label: string;
  description: string;
}

export interface CourtCharge {
  id: string;
  label: string;
  description: string;
}

export interface CourtAcceptedArgument {
  contradictionId: string;
  requiredEvidenceIds: readonly string[];
}

export interface CourtIssue {
  id: string;
  label: string;
  description: string;
  kind: ContradictionKind;
  acceptedArguments: readonly CourtAcceptedArgument[];
}

export interface CourtEndingCopy {
  title: string;
  summary: string;
  epilogue: string;
  win: boolean;
}

export interface CourtDefinition {
  candidates: readonly CourtCandidate[];
  charges: readonly CourtCharge[];
  issues: readonly CourtIssue[];
  correctAccusedId: string;
  correctChargeId: string;
  noProsecutionCandidateId: string;
  coverConfessorId: string;
  relativeExceptionChargeId: string;
  minimumIssues: number;
  requiredIssueKinds: readonly ContradictionKind[];
  endings: Readonly<Record<CourtOutcome, CourtEndingCopy>>;
}

export interface CourtArgument {
  issueId: string;
  contradictionId: string;
  evidenceIds: readonly string[];
}

export interface CourtSubmission {
  candidateId: string;
  chargeId?: string;
  arguments: readonly CourtArgument[];
}

export interface CourtContext {
  confirmedContradictionIds: readonly string[];
  acquiredEvidenceIds: readonly string[];
  sincerity: boolean;
}

export interface CourtVerdict {
  outcome: CourtOutcome;
  win: boolean;
  copy: CourtEndingCopy;
  satisfiedIssueIds: string[];
  rejectedArgumentIndexes: number[];
}

interface ArgumentEvaluation {
  satisfiedIssueIds: string[];
  rejectedArgumentIndexes: number[];
}

function sameStringSet(
  leftItems: readonly string[],
  rightItems: readonly string[],
): boolean {
  const left = new Set(leftItems);
  const right = new Set(rightItems);
  if (left.size !== right.size) return false;
  return [...left].every((entry) => right.has(entry));
}

function acceptedArgumentMatches(
  accepted: CourtAcceptedArgument,
  argument: CourtArgument,
  confirmedContradictions: ReadonlySet<string>,
  acquiredEvidence: ReadonlySet<string>,
): boolean {
  return (
    accepted.contradictionId === argument.contradictionId &&
    confirmedContradictions.has(argument.contradictionId) &&
    sameStringSet(accepted.requiredEvidenceIds, argument.evidenceIds) &&
    accepted.requiredEvidenceIds.every((id) => acquiredEvidence.has(id)) &&
    argument.evidenceIds.every((id) => acquiredEvidence.has(id))
  );
}

function evaluateArguments(
  definition: CourtDefinition,
  submission: CourtSubmission,
  context: CourtContext,
): ArgumentEvaluation {
  const confirmedContradictions = new Set(
    context.confirmedContradictionIds,
  );
  const acquiredEvidence = new Set(context.acquiredEvidenceIds);
  const satisfied = new Set<string>();
  const rejectedArgumentIndexes: number[] = [];

  submission.arguments.forEach((argument, index) => {
    const issue = definition.issues.find(
      (entry) => entry.id === argument.issueId,
    );
    const matches =
      issue?.acceptedArguments.some((accepted) =>
        acceptedArgumentMatches(
          accepted,
          argument,
          confirmedContradictions,
          acquiredEvidence,
        ),
      ) ?? false;

    if (matches && issue) {
      satisfied.add(issue.id);
    } else {
      rejectedArgumentIndexes.push(index);
    }
  });

  return {
    satisfiedIssueIds: [...satisfied],
    rejectedArgumentIndexes,
  };
}

function proofSatisfied(
  definition: CourtDefinition,
  satisfiedIssueIds: readonly string[],
): boolean {
  if (satisfiedIssueIds.length < definition.minimumIssues) return false;
  const satisfiedKinds = new Set(
    definition.issues
      .filter((issue) => satisfiedIssueIds.includes(issue.id))
      .map((issue) => issue.kind),
  );
  return definition.requiredIssueKinds.every((kind) =>
    satisfiedKinds.has(kind),
  );
}

function result(
  definition: CourtDefinition,
  outcome: CourtOutcome,
  evaluation: ArgumentEvaluation,
): CourtVerdict {
  const copy = definition.endings[outcome];
  return {
    outcome,
    win: copy.win,
    copy,
    ...evaluation,
  };
}

export function judgeCourt(
  definition: CourtDefinition,
  submission: CourtSubmission,
  context: CourtContext,
): CourtVerdict {
  const candidateExists = definition.candidates.some(
    (entry) => entry.id === submission.candidateId,
  );
  if (!candidateExists) {
    throw new Error(`알 수 없는 기소 대상: ${submission.candidateId}`);
  }
  const evaluation = evaluateArguments(definition, submission, context);

  // 판정 순서는 사건 데이터보다 엔진 규칙이 우선한다. 불기소와 보호
  // 자백자를 먼저 처리해야 이들을 단순 오인 기소로 뭉개지 않는다.
  if (submission.candidateId === definition.noProsecutionCandidateId) {
    return result(definition, 'UNRESOLVED', evaluation);
  }

  if (submission.candidateId === definition.coverConfessorId) {
    return result(
      definition,
      submission.chargeId === definition.relativeExceptionChargeId
        ? 'RELATIVE_EXCEPTION'
        : 'WRONGFUL_CONVICTION',
      evaluation,
    );
  }

  if (submission.candidateId !== definition.correctAccusedId) {
    return result(definition, 'WRONGFUL_CONVICTION', evaluation);
  }

  if (submission.chargeId !== definition.correctChargeId) {
    return result(definition, 'CHARGE_MISMATCH', evaluation);
  }

  if (
    !proofSatisfied(definition, evaluation.satisfiedIssueIds)
  ) {
    return result(definition, 'ACQUITTAL_INSUFFICIENT', evaluation);
  }

  return result(
    definition,
    context.sincerity ? 'SELF_SURRENDER' : 'TRUTH_CONVICTION',
    evaluation,
  );
}
