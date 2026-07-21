// 현장 수사(1막): 사고처럼 보이는 현장을 조사해 증거를 "찾고",
// 사고·자살·타살을 판단해 사건을 입건한다. 조사와 판정은 전부 결정론이며
// LLM은 관여하지 않는다.

export type DeathRulingChoice = 'accident' | 'suicide' | 'homicide';

export interface SceneSpot {
  id: string;
  name: string;
  // 카드에 보이는 짧은 설명.
  hint: string;
  // 조사 시 출력되는 저작 서술.
  examText: string;
  // 조사로 입수되는 증거 (없으면 순수 관찰/분위기).
  grantsEvidenceId?: string;
  // 먼저 조사해야 하는 지점들 (조사 사슬 — 찾는 재미).
  requiresSpotIds?: readonly string[];
}

export interface SceneDefinition {
  // 현장 도입 서술.
  intro: string;
  spots: readonly SceneSpot[];
  // 정답은 항상 타살(homicide)이라고 가정하지 않는다 — 사건마다 저작.
  truth: DeathRulingChoice;
  // 타살 판단을 승인받기 위한 근거 사슬 (any_of, 각 사슬은 모두 필요).
  rulingChains: readonly (readonly string[])[];
  // 오판 시 보여줄 저작 결말 (사건 조기 종결 = 패배).
  wrongRulingEpilogue: string;
  // 입건 성공 시 다음 막으로 넘어가는 브리지 서술.
  openingLine: string;
}

export function availableSpots(
  scene: SceneDefinition,
  examinedSpotIds: ReadonlySet<string>,
): SceneSpot[] {
  return scene.spots.filter((spot) =>
    (spot.requiresSpotIds ?? []).every((id) => examinedSpotIds.has(id)),
  );
}

export type SceneRuling =
  | { outcome: 'OPENED' }
  | { outcome: 'REJECTED'; missingEvidenceIds: string[] }
  | { outcome: 'CLOSED_WRONG' };

// 현장 판단: 타살 + 근거 사슬 충족 → 입건(다음 막). 타살인데 근거 부족 →
// 반려(계속 조사 가능). 사고·자살로 판단 → 사건 조기 종결(패배).
export function judgeSceneRuling(
  scene: SceneDefinition,
  choice: DeathRulingChoice,
  evidenceIds: readonly string[],
): SceneRuling {
  if (choice !== scene.truth) {
    return { outcome: 'CLOSED_WRONG' };
  }
  const submitted = new Set(evidenceIds);
  const matched = scene.rulingChains.some((chain) =>
    chain.every((id) => submitted.has(id)),
  );
  if (matched) return { outcome: 'OPENED' };

  let missing: string[] = [];
  let fewest = Number.POSITIVE_INFINITY;
  for (const chain of scene.rulingChains) {
    const gap = chain.filter((id) => !submitted.has(id));
    if (gap.length < fewest) {
      fewest = gap.length;
      missing = gap;
    }
  }
  return { outcome: 'REJECTED', missingEvidenceIds: missing };
}
