import { describe, expect, it } from 'vitest';
import { suspect } from '../cases/prototype/fixture';
import {
  createGameState,
  presentEvidence,
  recordCompletedTurn,
} from './gameState';

describe('gameState', () => {
  it('정확한 증거만 비밀을 해금한다', () => {
    const initial = createGameState(12);
    const redHerring = presentEvidence(initial, suspect, 'E3');
    expect(redHerring.newlyUnlockedSecretIds).toEqual([]);

    const matched = presentEvidence(redHerring.state, suspect, 'E1');
    expect(matched.newlyUnlockedSecretIds).toEqual(['S1']);
    expect(matched.state.unlockedSecretIds).toEqual(['S1']);
    expect(suspect.secrets[0]?.unlockNotice).not.toContain('태블릿');
  });

  it('이미 열린 비밀을 중복 해금하지 않는다', () => {
    const first = presentEvidence(createGameState(12), suspect, 'E1');
    const second = presentEvidence(first.state, suspect, 'E1');
    expect(second.newlyUnlockedSecretIds).toEqual([]);
    expect(second.state.unlockedSecretIds).toEqual(['S1']);
  });

  it('완료된 응답만 턴으로 기록한다', () => {
    const initial = createGameState(2);
    expect(recordCompletedTurn(initial).turn).toBe(1);
    expect(initial.turn).toBe(0);
  });
});
