import type { CaseContract } from './contract';
import type { Evidence } from './types';

// 사건 정의: 용의자 여러 명과 증거, 정답을 하나의 단위로 묶는다.
// main과 시뮬레이터는 이 정의만 소비한다.

export interface CaseSuspect {
  id: string;
  name: string;
  role: string;
  persona: string;
  // 초상 이니셜 한 글자.
  portrait: string;
  // 심문 시작 시 표시되는 지문.
  introLine: string;
  contract: CaseContract;
}

// 최종 보고서에서 플레이어가 고르는 선택지. 오답도 그럴듯해야 한다.
export interface ReportOption {
  id: string;
  label: string;
}

// 최종 보고서 판정용 정답 데이터.
export interface CaseSolution {
  culpritId: string;
  motiveId: string;
  methodId: string;
  // 각 배열은 하나의 유효한 증명 사슬(모두 제시되어야 함). any_of 관계.
  proofEvidenceChains: readonly (readonly string[])[];
  // 판정 후 보여주는 사건의 진상.
  epilogue: string;
}

// 점진 공개: 증거와 용의자는 처음부터 다 주지 않고, 심문에서 나온
// 진술·입수한 증거·도달한 단계가 다음 단서를 연다.
export type UnlockTrigger =
  | { type: 'claim'; suspectId: string; claimId: string }
  | { type: 'evidence'; evidenceId: string }
  | { type: 'stage'; suspectId: string; stageId: string };

export interface CaseUnlock {
  // 둘 중 하나만 지정한다: 입수되는 증거 또는 열리는 용의자.
  evidenceId?: string;
  suspectId?: string;
  notice: string;
  trigger: UnlockTrigger;
}

export interface CaseDefinition {
  id: string;
  title: string;
  briefing: string;
  maxTurns: number;
  evidences: readonly Evidence[];
  suspects: readonly CaseSuspect[];
  initialEvidenceIds: readonly string[];
  initialSuspectIds: readonly string[];
  unlocks: readonly CaseUnlock[];
  motiveOptions: readonly ReportOption[];
  methodOptions: readonly ReportOption[];
  solution: CaseSolution;
}

export interface DiscoverySnapshot {
  acquiredEvidenceIds: ReadonlySet<string>;
  unlockedSuspectIds: ReadonlySet<string>;
  // `${suspectId}:${claimId}` 형태.
  recordedClaims: ReadonlySet<string>;
  // suspectId → 현재 방어 단계.
  stages: ReadonlyMap<string, string>;
}

// 현재 수사 상태로 새로 열리는 단서를 전부 반환한다 (연쇄 포함, 결정론).
export function evaluateUnlocks(
  caseDefinition: CaseDefinition,
  snapshot: DiscoverySnapshot,
): CaseUnlock[] {
  const acquired = new Set(snapshot.acquiredEvidenceIds);
  const suspects = new Set(snapshot.unlockedSuspectIds);
  const fired: CaseUnlock[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const unlock of caseDefinition.unlocks) {
      const alreadyOpen = unlock.evidenceId
        ? acquired.has(unlock.evidenceId)
        : unlock.suspectId
          ? suspects.has(unlock.suspectId)
          : true;
      if (alreadyOpen) continue;

      const trigger = unlock.trigger;
      const satisfied =
        trigger.type === 'claim'
          ? snapshot.recordedClaims.has(
              `${trigger.suspectId}:${trigger.claimId}`,
            )
          : trigger.type === 'evidence'
            ? acquired.has(trigger.evidenceId)
            : snapshot.stages.get(trigger.suspectId) === trigger.stageId;
      if (!satisfied) continue;

      if (unlock.evidenceId) acquired.add(unlock.evidenceId);
      if (unlock.suspectId) suspects.add(unlock.suspectId);
      fired.push(unlock);
      changed = true;
    }
  }
  return fired;
}

export function getSuspect(
  caseDefinition: CaseDefinition,
  suspectId: string,
): CaseSuspect {
  const found = caseDefinition.suspects.find(
    (entry) => entry.id === suspectId,
  );
  if (!found) throw new Error(`알 수 없는 용의자: ${suspectId}`);
  return found;
}
