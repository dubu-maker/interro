import type { CaseDefinition } from '../engine/case';
import { case1 } from './case1';
import { case2 } from './case2';
import { prototypeCaseEn, prototypeCaseKo } from './prototype';

// URL과 데스크톱 런처가 같은 사건 선택 규칙을 공유하게 한다.
export function resolveCase(
  caseId: string | null,
  language: 'ko' | 'en' = 'ko',
): CaseDefinition {
  if (caseId === case1.id) return case1;
  if (caseId === case2.id) return case2;
  return language === 'en' ? prototypeCaseEn : prototypeCaseKo;
}

export { case1, case2, prototypeCaseEn, prototypeCaseKo };
