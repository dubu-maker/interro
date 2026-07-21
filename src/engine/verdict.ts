import type { CaseDefinition } from './case';

// 최종 판정: 자백이 아니라 증거 사슬로 사건을 끝낸다.
// 용의자가 끝까지 부인해도 올바른 증거를 모으면 유죄 판정이 나오고,
// 진범을 용의선상에서 제외하면 그 순간 패배한다.

export type VerdictOutcome =
  | 'CONVICTED' // 진범 지목 + 증명 사슬 충족
  | 'INSUFFICIENT_EVIDENCE' // 진범은 맞췄지만 증거가 부족
  | 'WRONG_SUSPECT' // 무고한 사람을 기소
  | 'CULPRIT_RELEASED'; // 진범을 용의선상에서 제외

export interface ReportSubmission {
  accusedId: string;
  motiveId: string;
  methodId: string;
  evidenceIds: readonly string[];
}

export interface VerdictResult {
  outcome: VerdictOutcome;
  win: boolean;
  correctCulprit: boolean;
  correctMotive: boolean;
  correctMethod: boolean;
  // 충족된 증명 사슬(있다면).
  matchedChain?: readonly string[];
  // 가장 근접한 사슬에서 빠진 증거들 (실패 시 피드백용).
  missingEvidenceIds: string[];
}

function chainSatisfied(
  chain: readonly string[],
  submitted: ReadonlySet<string>,
): boolean {
  return chain.every((id) => submitted.has(id));
}

export function judgeReport(
  caseDefinition: CaseDefinition,
  submission: ReportSubmission,
): VerdictResult {
  const { solution } = caseDefinition;
  const submitted = new Set(submission.evidenceIds);
  const correctCulprit = submission.accusedId === solution.culpritId;
  const correctMotive = submission.motiveId === solution.motiveId;
  const correctMethod = submission.methodId === solution.methodId;

  if (!correctCulprit) {
    return {
      outcome: 'WRONG_SUSPECT',
      win: false,
      correctCulprit,
      correctMotive,
      correctMethod,
      missingEvidenceIds: [],
    };
  }

  const matchedChain = solution.proofEvidenceChains.find((chain) =>
    chainSatisfied(chain, submitted),
  );
  if (matchedChain) {
    return {
      outcome: 'CONVICTED',
      win: true,
      correctCulprit,
      correctMotive,
      correctMethod,
      matchedChain,
      missingEvidenceIds: [],
    };
  }

  // 가장 적게 모자란 사슬을 골라 무엇이 빠졌는지 알려준다.
  let missingEvidenceIds: string[] = [];
  let fewest = Number.POSITIVE_INFINITY;
  for (const chain of solution.proofEvidenceChains) {
    const missing = chain.filter((id) => !submitted.has(id));
    if (missing.length < fewest) {
      fewest = missing.length;
      missingEvidenceIds = missing;
    }
  }

  return {
    outcome: 'INSUFFICIENT_EVIDENCE',
    win: false,
    correctCulprit,
    correctMotive,
    correctMethod,
    missingEvidenceIds,
  };
}

// 용의선상 제외: 진범을 놓아주면 즉시 패배한다.
export function judgeRelease(
  caseDefinition: CaseDefinition,
  suspectId: string,
): VerdictResult | undefined {
  if (suspectId !== caseDefinition.solution.culpritId) return undefined;
  return {
    outcome: 'CULPRIT_RELEASED',
    win: false,
    correctCulprit: false,
    correctMotive: false,
    correctMethod: false,
    missingEvidenceIds: [],
  };
}
