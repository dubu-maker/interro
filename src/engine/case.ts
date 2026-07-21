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

export interface CaseDefinition {
  id: string;
  title: string;
  briefing: string;
  maxTurns: number;
  evidences: readonly Evidence[];
  suspects: readonly CaseSuspect[];
  motiveOptions: readonly ReportOption[];
  methodOptions: readonly ReportOption[];
  solution: CaseSolution;
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
