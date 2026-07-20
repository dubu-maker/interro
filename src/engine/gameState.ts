import { matchEvidenceToSecrets } from './gates';
import type {
  EvidencePresentationResult,
  GameState,
  SuspectSheet,
} from './types';

export function createGameState(maxTurns: number): GameState {
  if (!Number.isInteger(maxTurns) || maxTurns <= 0) {
    throw new Error('maxTurns는 양의 정수여야 합니다.');
  }

  return {
    turn: 0,
    maxTurns,
    presentedEvidenceIds: [],
    unlockedSecretIds: [],
  };
}

// 소프트 캡: maxTurns는 하드 종료가 아니라 정규 수사 마감선이다.
// 초과해도 심문은 계속되고, 초과 수사로 표기·기록만 된다.
// (베타에서 실제 필요 턴 수를 측정한 뒤 정식 한도를 정한다.)
export function canAskQuestion(_state: GameState): boolean {
  return true;
}

export function isOvertime(state: GameState): boolean {
  return state.turn >= state.maxTurns;
}

export function recordCompletedTurn(state: GameState): GameState {
  return { ...state, turn: state.turn + 1 };
}

export function presentEvidence(
  state: GameState,
  suspect: SuspectSheet,
  evidenceId: string,
): EvidencePresentationResult {
  const matched = matchEvidenceToSecrets(
    suspect,
    evidenceId,
    state.unlockedSecretIds,
  );
  const newlyUnlockedSecretIds = matched.map((secret) => secret.id);

  return {
    state: {
      ...state,
      presentedEvidenceIds: state.presentedEvidenceIds.includes(evidenceId)
        ? state.presentedEvidenceIds
        : [...state.presentedEvidenceIds, evidenceId],
      unlockedSecretIds: [
        ...state.unlockedSecretIds,
        ...newlyUnlockedSecretIds,
      ],
    },
    newlyUnlockedSecretIds,
  };
}
