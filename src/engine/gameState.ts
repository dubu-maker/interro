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

export function canAskQuestion(state: GameState): boolean {
  return state.turn < state.maxTurns;
}

export function recordCompletedTurn(state: GameState): GameState {
  if (!canAskQuestion(state)) {
    throw new Error('남은 심문 턴이 없습니다.');
  }

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
