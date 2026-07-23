import { describe, expect, it } from 'vitest';
import {
  createDossierState,
  resolveDossierAction,
  synchronizeDossier,
  type DossierDefinition,
  type DossierDocument,
  type DossierSnapshot,
} from '../../engine/dossier';
import {
  allowedClaims,
  applyEvidencePresentation,
  createContractState,
} from '../../engine/contract';
import { judgeReport } from '../../engine/verdict';
import { case3 } from './index';

function contractFor(suspectId: string) {
  const suspect = case3.suspects.find((entry) => entry.id === suspectId);
  if (!suspect) {
    throw new Error(`사건 3 용의자를 찾을 수 없습니다: ${suspectId}`);
  }
  return suspect.contract;
}

function requireDossier(): DossierDefinition {
  if (!case3.dossier) throw new Error('사건 3 서류철 정의가 없습니다.');
  return case3.dossier;
}

function dossierSnapshot(
  options: {
    evidenceIds?: readonly string[];
    recordedClaims?: readonly string[];
    stages?: readonly (readonly [string, string])[];
  } = {},
): DossierSnapshot {
  return {
    acquiredEvidenceIds: new Set(options.evidenceIds ?? []),
    recordedClaims: new Set(options.recordedClaims ?? []),
    stages: new Map(options.stages ?? []),
  };
}

function documentSourceIds(document: DossierDocument): Set<string> {
  const ids = new Set<string>();
  for (const page of document.pages) {
    for (const block of page.blocks) {
      ids.add(block.id);
      if (block.type === 'fields' || block.type === 'table') {
        for (const row of block.rows) ids.add(row.id);
      } else if (block.type === 'photo') {
        for (const hotspot of block.hotspots) ids.add(hotspot.id);
      } else if (block.type === 'floor-plan') {
        for (const zone of block.zones) ids.add(zone.id);
      }
    }
  }
  return ids;
}

function expectUnique(ids: readonly string[], label: string): void {
  expect(new Set(ids).size, `${label} ID가 중복됐습니다.`).toBe(ids.length);
}

describe('사건 3 서류철 기본 구성', () => {
  it('현장 phase 없이 세 용의자와 D1~D7 서류만 지급한다', () => {
    const dossier = requireDossier();
    const dossierState = createDossierState(dossier);

    expect(case3.id).toBe('case3');
    expect(case3.title).toBe('22:17 — 마지막 리허설');
    expect(case3.scene).toBeUndefined();
    expect(case3.psychologyTrial).toBeUndefined();
    expect(case3.interrogationExperience).toBeUndefined();
    expect(case3.court).toBeUndefined();
    expect(case3.motiveOptions).toEqual([]);
    expect(case3.methodOptions).toEqual([]);
    expect(case3.suspects.map((suspect) => suspect.id)).toEqual([
      'mirae',
      'haneul',
      'gyutae',
    ]);
    expect(case3.initialSuspectIds).toEqual([
      'mirae',
      'haneul',
      'gyutae',
    ]);
    expect(case3.initialEvidenceIds).toEqual([]);
    expect(case3.unlocks).toEqual([]);
    expect(case3.evidences).toHaveLength(9);
    expect(
      case3.evidences.every((evidence) => evidence.view.type === 'document'),
    ).toBe(true);

    expect(dossier.openAtStart).toBe(true);
    expect(dossier.initialDocumentIds).toEqual([
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
    ]);
    expect(dossierState.acquiredDocumentIds).toEqual(
      dossier.initialDocumentIds,
    );
    expect(dossierState.availableRequestIds).toEqual(['RQ_PHONE']);
    expect(dossierState.spentForensicSlots).toBe(0);
  });
});

describe('사건 3 데이터 무결성', () => {
  it('계약 단계·전환·힌트·정답 사슬의 모든 ID가 실제 데이터에 존재한다', () => {
    const evidenceIds = new Set(case3.evidences.map((evidence) => evidence.id));
    const suspectIds = new Set(case3.suspects.map((suspect) => suspect.id));

    expectUnique([...evidenceIds], '증거');
    expectUnique([...suspectIds], '용의자');
    expect(suspectIds.has(case3.solution.culpritId)).toBe(true);

    for (const suspect of case3.suspects) {
      const { contract } = suspect;
      const claimIds = new Set(contract.claims.map((claim) => claim.id));
      const stageIds = new Set(contract.stages.map((stage) => stage.id));

      expectUnique([...claimIds], `${suspect.id} 진술`);
      expectUnique([...stageIds], `${suspect.id} 단계`);
      expect(contract.suspectId).toBe(suspect.id);
      expect(stageIds.has(contract.initialStageId)).toBe(true);
      createContractState(contract);

      for (const claimId of contract.initialClaimIds ?? []) {
        expect(claimIds.has(claimId), `${suspect.id}:${claimId}`).toBe(true);
      }
      for (const stage of contract.stages) {
        for (const claimId of stage.allowedClaimIds) {
          expect(
            claimIds.has(claimId),
            `${suspect.id}:${stage.id}:${claimId}`,
          ).toBe(true);
        }
      }
      for (const transition of contract.transitions) {
        expect(stageIds.has(transition.from)).toBe(true);
        expect(stageIds.has(transition.to)).toBe(true);
        expect(
          evidenceIds.has(transition.whenEvidencePresented),
          `${suspect.id}:${transition.whenEvidencePresented}`,
        ).toBe(true);
      }
      for (const hint of contract.hints) {
        for (const stageId of hint.stageIds) {
          expect(stageIds.has(stageId), `${suspect.id}:${stageId}`).toBe(true);
        }
        if (hint.targetClaimId) {
          expect(claimIds.has(hint.targetClaimId)).toBe(true);
        }
        if (hint.targetEvidenceId) {
          expect(evidenceIds.has(hint.targetEvidenceId)).toBe(true);
        }
      }
      for (const claim of contract.claims) {
        for (const evidenceId of claim.contradictedBy ?? []) {
          expect(evidenceIds.has(evidenceId), claim.id).toBe(true);
        }
      }
    }

    for (const chain of case3.solution.proofEvidenceChains) {
      expect(chain.every((evidenceId) => evidenceIds.has(evidenceId))).toBe(
        true,
      );
    }
  });

  it('서류·발견·의뢰·인용·해금 그래프의 ID와 모든 참조가 닫혀 있다', () => {
    const dossier = requireDossier();
    const evidenceIds = new Set(case3.evidences.map((entry) => entry.id));
    const suspectIds = new Set(case3.suspects.map((entry) => entry.id));
    const documentIds = new Set(dossier.documents.map((entry) => entry.id));
    const discoveryIds = new Set(
      dossier.discoveries.map((entry) => entry.id),
    );
    const requestIds = new Set(dossier.requests.map((entry) => entry.id));
    const quoteIds = new Set(dossier.quotes.map((entry) => entry.id));
    const unlockIds = new Set(dossier.unlocks.map((entry) => entry.id));
    const pageIds = dossier.documents.flatMap((document) =>
      document.pages.map((page) => page.id),
    );
    const sourceIdsByDocument = new Map(
      dossier.documents.map((document) => [
        document.id,
        documentSourceIds(document),
      ]),
    );
    const allSourceIds = [...sourceIdsByDocument.values()].flatMap((ids) => [
      ...ids,
    ]);

    expectUnique([...documentIds], '서류');
    expectUnique([...discoveryIds], '발견');
    expectUnique([...requestIds], '의뢰');
    expectUnique([...quoteIds], '인용');
    expectUnique([...unlockIds], '해금 규칙');
    expectUnique(pageIds, '서류 페이지');
    expectUnique(allSourceIds, '서류 요소');

    expect(
      dossier.initialDocumentIds.every((id) => documentIds.has(id)),
    ).toBe(true);
    expect(dossier.initialRequestIds.every((id) => requestIds.has(id))).toBe(
      true,
    );

    const declaredDiscoveryIds = new Set<string>();
    const declaredQuoteIds = new Set<string>();
    for (const document of dossier.documents) {
      for (const page of document.pages) {
        for (const block of page.blocks) {
          if (block.type === 'paragraph') {
            if (block.discoveryId) {
              declaredDiscoveryIds.add(block.discoveryId);
            }
            if (block.quoteId) declaredQuoteIds.add(block.quoteId);
          } else if (block.type === 'fields' || block.type === 'table') {
            for (const row of block.rows) {
              if (row.discoveryId) {
                declaredDiscoveryIds.add(row.discoveryId);
              }
              if (row.quoteId) declaredQuoteIds.add(row.quoteId);
            }
          } else if (block.type === 'photo') {
            for (const hotspot of block.hotspots) {
              declaredDiscoveryIds.add(hotspot.discoveryId);
            }
          }
        }
      }
    }

    expect([...declaredDiscoveryIds].sort()).toEqual(
      [...discoveryIds].sort(),
    );
    expect([...declaredQuoteIds].sort()).toEqual([...quoteIds].sort());

    for (const discovery of dossier.discoveries) {
      expect(documentIds.has(discovery.documentId), discovery.id).toBe(true);
      expect(
        sourceIdsByDocument
          .get(discovery.documentId)
          ?.has(discovery.sourceId),
        discovery.id,
      ).toBe(true);
    }

    const requestedEvidenceIds: string[] = [];
    for (const request of dossier.requests) {
      for (const evidenceId of request.resultEvidenceIds) {
        requestedEvidenceIds.push(evidenceId);
        expect(evidenceIds.has(evidenceId), request.id).toBe(true);
      }
    }
    expectUnique(requestedEvidenceIds, '의뢰 결과 증거');
    expect([...requestedEvidenceIds].sort()).toEqual(
      [...evidenceIds].sort(),
    );

    for (const quote of dossier.quotes) {
      expect(documentIds.has(quote.documentId), quote.id).toBe(true);
      expect(
        sourceIdsByDocument.get(quote.documentId)?.has(quote.sourceId),
        quote.id,
      ).toBe(true);
      if (!quote.mapping) continue;
      expect(suspectIds.has(quote.mapping.suspectId), quote.id).toBe(true);
      expect(
        contractFor(quote.mapping.suspectId).claims.some(
          (claim) => claim.id === quote.mapping?.claimId,
        ),
        quote.id,
      ).toBe(true);
    }

    for (const unlock of dossier.unlocks) {
      const predicates = [
        ...(unlock.when.allOf ?? []),
        ...(unlock.when.anyOf ?? []),
      ];
      for (const predicate of predicates) {
        if (predicate.type === 'document-opened') {
          expect(documentIds.has(predicate.documentId), unlock.id).toBe(true);
        } else if (predicate.type === 'discovery-found') {
          expect(discoveryIds.has(predicate.discoveryId), unlock.id).toBe(true);
        } else if (predicate.type === 'request-completed') {
          expect(requestIds.has(predicate.requestId), unlock.id).toBe(true);
        } else if (predicate.type === 'evidence-acquired') {
          expect(evidenceIds.has(predicate.evidenceId), unlock.id).toBe(true);
        } else if (predicate.type === 'claim-recorded') {
          expect(suspectIds.has(predicate.suspectId), unlock.id).toBe(true);
          expect(
            contractFor(predicate.suspectId).claims.some(
              (claim) => claim.id === predicate.claimId,
            ),
            unlock.id,
          ).toBe(true);
        } else {
          expect(suspectIds.has(predicate.suspectId), unlock.id).toBe(true);
          expect(
            contractFor(predicate.suspectId).stages.some(
              (stage) => stage.id === predicate.stageId,
            ),
            unlock.id,
          ).toBe(true);
        }
      }

      for (const grant of unlock.grants) {
        if (grant.type === 'document') {
          expect(documentIds.has(grant.documentId), unlock.id).toBe(true);
        } else if (grant.type === 'request') {
          expect(requestIds.has(grant.requestId), unlock.id).toBe(true);
        } else {
          expect(evidenceIds.has(grant.evidenceId), unlock.id).toBe(true);
        }
      }
    }

    const privateEvidenceIds = dossier.requests
      .filter((request) => request.privateResult)
      .flatMap((request) => request.resultEvidenceIds);
    expect(privateEvidenceIds).toEqual(['E8']);
    expect(
      case3.evidences
        .filter((evidence) => evidence.presentationMode === 'probe')
        .map((evidence) => evidence.id),
    ).toEqual(privateEvidenceIds);
  });

  it('언락 전 프롬프트 표면에는 핵심 비밀 claim이 없다', () => {
    const sealedBySuspect: Record<string, readonly string[]> = {
      mirae: ['M_TAPED_WARNING', 'M_KEY_REQUIRED', 'M_GYUTAE_ACCESS'],
      haneul: [
        'H_SUNA_MOTHER',
        'H_THREAT_WORDS',
        'H_HEARD_GYUTAE_MEETING',
      ],
      gyutae: [
        'G_KEY_ROUTINE_CHECK',
        'G_WENT_CORRIDOR',
        'G_CLOCKS_UNSYNCED',
      ],
    };

    for (const suspect of case3.suspects) {
      const initialStage = suspect.contract.stages.find(
        (stage) => stage.id === suspect.contract.initialStageId,
      );
      expect(initialStage).toBeDefined();
      for (const sealedClaimId of sealedBySuspect[suspect.id] ?? []) {
        expect(initialStage?.allowedClaimIds).not.toContain(sealedClaimId);
      }
    }

    const mirae = contractFor('mirae');
    expect(mirae.initialClaimIds).not.toContain('M_CUE_MARK_EXISTED');
    expect(
      mirae.stages.find((stage) => stage.id === 'M_COVER')?.allowedClaimIds,
    ).toContain('M_CUE_MARK_EXISTED');

    const haneul = contractFor('haneul');
    expect(haneul.initialClaimIds).not.toContain('H_ARCHIVE_MATERIAL');
    expect(
      haneul.stages.find((stage) => stage.id === 'H_COVER')?.allowedClaimIds,
    ).toContain('H_ARCHIVE_MATERIAL');
  });
});

describe('사건 3 결정론적 서류철 경로', () => {
  it('D2 제어판 표시등을 발견하고 감식하면 E1을 입수한다', () => {
    const dossier = requireDossier();
    const snapshot = dossierSnapshot();
    let state = createDossierState(dossier);

    let result = resolveDossierAction(dossier, state, snapshot, {
      type: 'OPEN_DOCUMENT',
      documentId: 'D2',
    });
    expect(result.accepted).toBe(true);
    state = result.state;

    result = resolveDossierAction(dossier, state, snapshot, {
      type: 'INSPECT_DISCOVERY',
      documentId: 'D2',
      discoveryId: 'FD_MANUAL_INDICATOR',
    });
    expect(result.newDiscoveryIds).toEqual(['FD_MANUAL_INDICATOR']);
    expect(result.newRequestIds).toContain('RQ_LIFT_LOG');
    state = result.state;

    result = resolveDossierAction(dossier, state, snapshot, {
      type: 'REQUEST_ANALYSIS',
      requestId: 'RQ_LIFT_LOG',
    });
    expect(result.newEvidenceIds).toEqual(['E1']);
    expect(result.state.spentForensicSlots).toBe(1);
  });

  it('D6 열쇠 규칙을 읽고 조회하면 슬롯 소모 없이 E6을 입수한다', () => {
    const dossier = requireDossier();
    const snapshot = dossierSnapshot();
    let state = createDossierState(dossier);

    let result = resolveDossierAction(dossier, state, snapshot, {
      type: 'OPEN_DOCUMENT',
      documentId: 'D6',
    });
    state = result.state;

    result = resolveDossierAction(dossier, state, snapshot, {
      type: 'INSPECT_DISCOVERY',
      documentId: 'D6',
      discoveryId: 'FD_MANUAL_KEY_RULE',
    });
    expect(result.newRequestIds).toContain('RQ_KEY_LOG');
    state = result.state;

    result = resolveDossierAction(dossier, state, snapshot, {
      type: 'REQUEST_ANALYSIS',
      requestId: 'RQ_KEY_LOG',
    });
    expect(result.newEvidenceIds).toEqual(['E6']);
    expect(result.state.spentForensicSlots).toBe(0);
  });

  it('G_KEY 단계는 통로 복원을 열고 의뢰 결과 E7을 지급한다', () => {
    const dossier = requireDossier();
    const snapshot = dossierSnapshot({
      stages: [['gyutae', 'G_KEY']],
    });
    const synchronized = synchronizeDossier(
      dossier,
      createDossierState(dossier),
      snapshot,
    );

    expect(synchronized.newRequestIds).toEqual(['RQ_CORRIDOR']);
    const requested = resolveDossierAction(
      dossier,
      synchronized.state,
      snapshot,
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_CORRIDOR' },
    );
    expect(requested.newEvidenceIds).toEqual(['E7']);
    expect(requested.state.spentForensicSlots).toBe(1);
  });

  it('G_CORRIDOR 단계는 비공개 음향 분석을 열고 E8을 지급한다', () => {
    const dossier = requireDossier();
    const snapshot = dossierSnapshot({
      stages: [['gyutae', 'G_CORRIDOR']],
    });
    const synchronized = synchronizeDossier(
      dossier,
      createDossierState(dossier),
      snapshot,
    );

    expect(synchronized.newRequestIds).toEqual(['RQ_AUDIO']);
    const requested = resolveDossierAction(
      dossier,
      synchronized.state,
      snapshot,
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_AUDIO' },
    );
    expect(requested.newEvidenceIds).toEqual(['E8']);
    expect(case3.evidences.find((evidence) => evidence.id === 'E8')).toMatchObject(
      { presentationMode: 'probe' },
    );
  });

  it('안전 선행 claim도 큐시트와 과거 기록 조회를 각각 연다', () => {
    const dossier = requireDossier();

    const cue = synchronizeDossier(
      dossier,
      createDossierState(dossier),
      dossierSnapshot({
        recordedClaims: ['mirae:M_CUE_MARK_EXISTED'],
      }),
    );
    expect(cue.newRequestIds).toContain('RQ_CUE_SHEET');

    const archive = synchronizeDossier(
      dossier,
      createDossierState(dossier),
      dossierSnapshot({
        recordedClaims: ['haneul:H_ARCHIVE_MATERIAL'],
      }),
    );
    expect(archive.newRequestIds).toContain('RQ_ARCHIVE');
  });
});

describe('사건 3 결정론적 심문 경로', () => {
  it('장미래는 E3와 E2를 어느 순서로 제시해도 모든 과실을 인정한다', () => {
    const contract = contractFor('mirae');

    let tapeFirst = createContractState(contract);
    tapeFirst = applyEvidencePresentation(contract, tapeFirst, 'E3').state;
    expect(tapeFirst.stageId).toBe('M_TAPE');
    tapeFirst = applyEvidencePresentation(contract, tapeFirst, 'E2').state;
    expect(tapeFirst.stageId).toBe('M_FULL');

    let cueFirst = createContractState(contract);
    cueFirst = applyEvidencePresentation(contract, cueFirst, 'E2').state;
    expect(cueFirst.stageId).toBe('M_CUE');
    cueFirst = applyEvidencePresentation(contract, cueFirst, 'E3').state;
    expect(cueFirst.stageId).toBe('M_FULL');
    expect(
      allowedClaims(contract, cueFirst).map((claim) => claim.id),
    ).toEqual(
      expect.arrayContaining(['M_TAPED_WARNING', 'M_GYUTAE_ACCESS']),
    );
  });

  it('윤하늘은 과거 기록과 성명 초안 뒤 알리바이 영상으로 배제된다', () => {
    const contract = contractFor('haneul');
    let state = createContractState(contract);

    state = applyEvidencePresentation(contract, state, 'E5').state;
    expect(state.stageId).toBe('H_IDENTITY');
    state = applyEvidencePresentation(contract, state, 'E4').state;
    expect(state.stageId).toBe('H_ARGUMENT');
    state = applyEvidencePresentation(contract, state, 'E9').state;
    expect(state.stageId).toBe('H_CLEARED');
    expect(
      allowedClaims(contract, state).map((claim) => claim.id),
    ).toContain('H_ALIBI_CONFIRMED');
  });

  it('이규태는 로그·열쇠·통로·비공개 음향 순서로 최후 변명까지 간다', () => {
    const contract = contractFor('gyutae');
    let state = createContractState(contract);

    for (const [evidenceId, stageId] of [
      ['E1', 'G_MANUAL'],
      ['E6', 'G_KEY'],
      ['E7', 'G_CORRIDOR'],
      ['E8', 'G_TIMELINE'],
    ] as const) {
      state = applyEvidencePresentation(contract, state, evidenceId).state;
      expect(state.stageId).toBe(stageId);
    }
    expect(
      allowedClaims(contract, state).map((claim) => claim.id),
    ).toContain('G_CLOCKS_UNSYNCED');
  });

  it('자백 없이도 올바른 증거 사슬로 이규태를 유죄 판정한다', () => {
    const verdict = judgeReport(case3, {
      accusedId: 'gyutae',
      motiveId: 'MOTIVE_EXPOSURE',
      methodId: 'METHOD_REHEARSAL',
      evidenceIds: ['E1', 'E2', 'E6', 'E7', 'E8'],
    });

    expect(verdict.outcome).toBe('CONVICTED');
    expect(verdict.win).toBe(true);
    expect(verdict.matchedChain).toEqual(['E1', 'E2', 'E6', 'E7', 'E8']);
  });
});
