import type { CaseDefinition } from '../../engine/case';
import { hanSeraContract } from './contract';
import { hanSeraContractEn, suspectEn } from './contractEn';
import { briefing, evidences, suspect } from './fixture';

// 기존 프로토타입 사건을 CaseDefinition으로 감싼다 (한국어/영어).

const prototypeSolution = {
  culpritId: 'unknown',
  motive: '프로토타입에는 정답 판정이 없다',
  method: '-',
  proofEvidenceChains: [],
} as const;

export const prototypeCaseKo: CaseDefinition = {
  id: 'proto-ko',
  title: '이도윤 대표 사망 사건',
  briefing,
  maxTurns: 12,
  evidences,
  suspects: [
    {
      id: 'sera',
      name: suspect.name,
      role: suspect.role,
      persona: suspect.persona,
      portrait: '한',
      introLine: '한세라가 맞은편 의자에 앉아 손을 모은 채 기다리고 있다.',
      contract: hanSeraContract,
    },
  ],
  solution: prototypeSolution,
};

export const prototypeCaseEn: CaseDefinition = {
  id: 'proto-en',
  title: '이도윤 대표 사망 사건',
  briefing,
  maxTurns: 12,
  evidences,
  suspects: [
    {
      id: 'sera',
      name: suspectEn.name,
      role: suspectEn.role,
      persona: suspectEn.persona,
      portrait: '한',
      introLine:
        'Han Se-ra sits across from you, hands folded, waiting.',
      contract: hanSeraContractEn,
    },
  ],
  solution: prototypeSolution,
};
