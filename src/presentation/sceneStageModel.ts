import { availableSpots } from '../engine/scene';
import type { SceneDefinition, SceneProgress } from '../engine/scene';

export type SceneStageZone = 'room' | 'offsite';

export interface SceneStagePlacement {
  spotId: string;
  x: number;
  y: number;
  zone?: SceneStageZone;
  focusZoom?: number;
}

export interface SceneStageVisual {
  backgroundUrl: string;
}

export interface SceneStageLayout {
  ariaLabel: string;
  locationLabel: string;
  ambientLabel: string;
  visual?: SceneStageVisual;
  placements: readonly SceneStagePlacement[];
}

export interface SceneStageSpotViewModel {
  id: string;
  label: string;
  hint: string;
  x: number;
  y: number;
  zone: SceneStageZone;
  focusZoom: number;
  status: 'available' | 'examined';
}

export interface SceneStageSnapshot {
  ariaLabel: string;
  locationLabel: string;
  ambientLabel: string;
  interactive: boolean;
  investigatedCount: number;
  spots: SceneStageSpotViewModel[];
}

const fallbackPositions = [
  { x: 0.22, y: 0.25 },
  { x: 0.5, y: 0.25 },
  { x: 0.78, y: 0.25 },
  { x: 0.22, y: 0.55 },
  { x: 0.5, y: 0.55 },
  { x: 0.78, y: 0.55 },
  { x: 0.35, y: 0.82 },
  { x: 0.65, y: 0.82 },
] as const;

export function createSceneStageSnapshot(
  scene: SceneDefinition,
  progress: SceneProgress,
  layout: SceneStageLayout,
  interactive: boolean,
): SceneStageSnapshot {
  const examined = new Set(progress.examinedSpotIds);
  const placements = new Map(
    layout.placements.map((placement) => [placement.spotId, placement]),
  );
  const spots = availableSpots(scene, examined).map((spot, index) => {
    const fallback =
      fallbackPositions[index % fallbackPositions.length] ??
      fallbackPositions[0];
    const placement = placements.get(spot.id);
    return {
      id: spot.id,
      label: spot.name,
      hint: spot.hint,
      x: placement?.x ?? fallback.x,
      y: placement?.y ?? fallback.y,
      zone: placement?.zone ?? 'room',
      focusZoom: placement?.focusZoom ?? 1.12,
      status: examined.has(spot.id) ? 'examined' : 'available',
    } satisfies SceneStageSpotViewModel;
  });

  return {
    ariaLabel: layout.ariaLabel,
    locationLabel: layout.locationLabel,
    ambientLabel: layout.ambientLabel,
    interactive,
    investigatedCount: progress.examinedSpotIds.length,
    spots,
  };
}

export function validateSceneStageLayout(
  scene: SceneDefinition,
  layout: SceneStageLayout,
): string[] {
  const errors: string[] = [];
  const sceneSpotIds = new Set(scene.spots.map((spot) => spot.id));
  const placementIds = new Set<string>();

  for (const placement of layout.placements) {
    if (placementIds.has(placement.spotId)) {
      errors.push(`중복 배치: ${placement.spotId}`);
    }
    placementIds.add(placement.spotId);
    if (!sceneSpotIds.has(placement.spotId)) {
      errors.push(`알 수 없는 조사 지점: ${placement.spotId}`);
    }
    if (placement.x < 0 || placement.x > 1 || placement.y < 0 || placement.y > 1) {
      errors.push(`배치 좌표 범위 오류: ${placement.spotId}`);
    }
  }
  for (const spot of scene.spots) {
    if (!placementIds.has(spot.id)) errors.push(`배치 누락: ${spot.id}`);
  }
  return errors;
}
