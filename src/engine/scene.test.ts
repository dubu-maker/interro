import { describe, expect, it } from 'vitest';
import { case1 } from '../cases/case1';
import {
  availableSpots,
  createSceneProgress,
  examineSceneSpot,
  judgeSceneRuling,
} from './scene';

const scene = case1.scene!;

describe('현장 수사 (사건 1)', () => {
  it('조사 사슬: 검시 인계는 시신 조사 후에만 나타난다', () => {
    const before = availableSpots(scene, new Set());
    expect(before.some((spot) => spot.id === 'coroner')).toBe(false);
    const after = availableSpots(scene, new Set(['body']));
    expect(after.some((spot) => spot.id === 'coroner')).toBe(true);
  });

  it('잠긴 조사 지점은 UI를 우회해 요청해도 엔진이 거부한다', () => {
    const result = examineSceneSpot(scene, createSceneProgress(), 'coroner');
    expect(result).toEqual({
      outcome: 'REJECTED',
      reason: 'LOCKED',
      progress: { examinedSpotIds: [] },
    });
  });

  it('조사 성공은 진행 상태와 새로 열린 지점만 반환한다', () => {
    const result = examineSceneSpot(scene, createSceneProgress(), 'body');
    expect(result.outcome).toBe('EXAMINED');
    if (result.outcome === 'EXAMINED') {
      expect(result.progress.examinedSpotIds).toEqual(['body']);
      expect(result.newlyAvailableSpotIds).toContain('coroner');
    }
  });

  it('알 수 없거나 이미 조사한 지점은 거부한다', () => {
    expect(
      examineSceneSpot(scene, createSceneProgress(), 'missing'),
    ).toMatchObject({ outcome: 'REJECTED', reason: 'UNKNOWN' });
    expect(
      examineSceneSpot(scene, { examinedSpotIds: ['body'] }, 'body'),
    ).toMatchObject({ outcome: 'REJECTED', reason: 'ALREADY_EXAMINED' });
  });

  it('조사 지점이 주는 증거가 모두 실제 증거 목록에 존재한다', () => {
    const evidenceIds = new Set(case1.evidences.map((entry) => entry.id));
    for (const spot of scene.spots) {
      if (spot.grantsEvidenceId) {
        expect(evidenceIds.has(spot.grantsEvidenceId)).toBe(true);
      }
      for (const requirement of spot.requiresSpotIds ?? []) {
        expect(scene.spots.some((entry) => entry.id === requirement)).toBe(
          true,
        );
      }
    }
  });

  it('타살 + 모순 증거 2개면 입건된다', () => {
    expect(
      judgeSceneRuling(scene, 'homicide', ['S_WOUND', 'S_TROPHY']).outcome,
    ).toBe('OPENED');
    expect(
      judgeSceneRuling(scene, 'homicide', ['S_TROPHY', 'S_REAR_DOOR', 'E3'])
        .outcome,
    ).toBe('OPENED');
  });

  it('타살인데 근거가 부족하면 반려되고 빠진 고리를 알려준다', () => {
    const ruling = judgeSceneRuling(scene, 'homicide', ['S_WOUND', 'E3']);
    expect(ruling.outcome).toBe('REJECTED');
    if (ruling.outcome === 'REJECTED') {
      expect(ruling.missingEvidenceIds.length).toBeGreaterThan(0);
    }
  });

  it('사고사·자살로 판단하면 사건이 조기 종결된다 (오판)', () => {
    expect(
      judgeSceneRuling(scene, 'accident', ['S_WOUND', 'S_TROPHY']).outcome,
    ).toBe('CLOSED_WRONG');
    expect(judgeSceneRuling(scene, 'suicide', ['S_WOUND']).outcome).toBe(
      'CLOSED_WRONG',
    );
  });

  it('현장 판단 사슬은 현장에서 입수 가능한 증거로만 구성된다', () => {
    const grantable = new Set(
      scene.spots
        .map((spot) => spot.grantsEvidenceId)
        .filter((id): id is string => id !== undefined),
    );
    for (const chain of scene.rulingChains) {
      for (const evidenceId of chain) {
        expect(grantable.has(evidenceId)).toBe(true);
      }
    }
  });
});
