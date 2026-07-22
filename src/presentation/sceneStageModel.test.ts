import { describe, expect, it } from 'vitest';
import { case1 } from '../cases/case1';
import { case1SceneStageLayout } from '../cases/case1/sceneStage';
import {
  createSceneStageSnapshot,
  validateSceneStageLayout,
} from './sceneStageModel';

const scene = case1.scene!;

describe('현장 표현 스냅샷', () => {
  it('잠긴 지점과 비밀 저작 정보는 Phaser에 전달하지 않는다', () => {
    const snapshot = createSceneStageSnapshot(
      scene,
      { examinedSpotIds: [] },
      case1SceneStageLayout,
      true,
    );
    expect(snapshot.spots.some((spot) => spot.id === 'coroner')).toBe(false);
    expect(Object.keys(snapshot.spots[0] ?? {}).sort()).toEqual(
      ['focusZoom', 'hint', 'id', 'label', 'status', 'x', 'y', 'zone'].sort(),
    );
    expect(JSON.stringify(snapshot)).not.toContain('grantsEvidenceId');
    expect(JSON.stringify(snapshot)).not.toContain('examText');
    expect(JSON.stringify(snapshot)).not.toContain('rulingChains');
  });

  it('선행 조사를 마치면 후속 지점만 새 스냅샷에 나타난다', () => {
    const snapshot = createSceneStageSnapshot(
      scene,
      { examinedSpotIds: ['body'] },
      case1SceneStageLayout,
      true,
    );
    expect(snapshot.spots.find((spot) => spot.id === 'body')?.status).toBe(
      'examined',
    );
    expect(snapshot.spots.some((spot) => spot.id === 'coroner')).toBe(true);
  });

  it('사건 1의 모든 조사 지점에 유효한 배치가 있다', () => {
    expect(validateSceneStageLayout(scene, case1SceneStageLayout)).toEqual([]);
    expect(case1SceneStageLayout.visual?.backgroundUrl).toMatch(/\.webp(?:\?|$)/);
  });
});
