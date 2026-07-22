import type { SceneStageLayout } from '../../presentation/sceneStageModel';
import officeEntryWideUrl from './assets/office-entry-wide.webp?url';

export const case1SceneStageLayout: SceneStageLayout = {
  ariaLabel: '니어라이트 본사 대표실 눈높이 현장',
  locationLabel: '니어라이트 본사 · 7층 대표실 · 토요일 07:40',
  ambientLabel: '빗소리 · 형광등 진동음',
  visual: { backgroundUrl: officeEntryWideUrl },
  placements: [
    { spotId: 'window', x: 0.49, y: 0.34, focusZoom: 1.16 },
    { spotId: 'rear-door', x: 0.18, y: 0.42, focusZoom: 1.2 },
    { spotId: 'shelf', x: 0.84, y: 0.34, focusZoom: 1.2 },
    { spotId: 'desk', x: 0.67, y: 0.55, focusZoom: 1.18 },
    { spotId: 'body', x: 0.38, y: 0.73, focusZoom: 1.24 },
    { spotId: 'trash', x: 0.52, y: 0.63, focusZoom: 1.22 },
    { spotId: 'security', x: 0.2, y: 0.9, zone: 'offsite' },
    { spotId: 'coroner', x: 0.45, y: 0.9, zone: 'offsite' },
    { spotId: 'phone-cradle', x: 0.55, y: 0.51, focusZoom: 1.26 },
  ],
};
