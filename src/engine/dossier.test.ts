import { describe, expect, it } from 'vitest';
import {
  createDossierState,
  resolveDossierAction,
  resolveDossierQuote,
  synchronizeDossier,
  type DossierDefinition,
  type DossierSnapshot,
  type DossierState,
} from './dossier';

const definition: DossierDefinition = {
  title: '테스트 사건철',
  caseNumber: 'TEST-001',
  officialTheory: '기계 오작동 추정',
  forensicSlotCount: 2,
  initialDocumentIds: ['D_INITIAL'],
  initialRequestIds: ['RQ_FREE', 'RQ_SLOT_A', 'RQ_SLOT_B'],
  documents: [
    {
      id: 'D_INITIAL',
      group: 'INITIAL',
      kind: 'OFFICIAL_REPORT',
      title: '초동 보고서',
      pages: [
        {
          id: 'D_INITIAL_P1',
          label: '첫 장',
          blocks: [
            {
              type: 'paragraph',
              id: 'D_INITIAL_OFFICIAL',
              text: '기계 오작동으로 추정한다.',
              quoteId: 'Q_UNMAPPED',
            },
            {
              type: 'paragraph',
              id: 'D_INITIAL_STATEMENT',
              text: '사고 당시 기계실에 있었습니다.',
              quoteId: 'Q_MAPPED',
            },
            {
              type: 'photo',
              id: 'D_INITIAL_PHOTO',
              assetPath: '/fixture.jpg',
              alt: '표시등이 찍힌 테스트 사진',
              caption: '현장 사진',
              hotspots: [
                {
                  id: 'D_INITIAL_HOTSPOT',
                  label: '작은 표시등',
                  rect: { x: 10, y: 20, width: 15, height: 15 },
                  discoveryId: 'FD_INDICATOR',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'D_CHAIN',
      group: 'EXAMINATION',
      kind: 'LOG',
      title: '연쇄 해금 문서',
      pages: [
        {
          id: 'D_CHAIN_P1',
          label: '결과',
          blocks: [
            {
              type: 'paragraph',
              id: 'D_CHAIN_RESULT',
              text: '연쇄 해금으로 입수한 결과다.',
              quoteId: 'Q_CHAIN',
            },
          ],
        },
      ],
    },
    {
      id: 'D_RESULT',
      group: 'RESULT',
      kind: 'LOG',
      title: '감식 결과 문서',
      pages: [
        {
          id: 'D_RESULT_P1',
          label: '결과',
          blocks: [
            {
              type: 'paragraph',
              id: 'D_RESULT_BODY',
              text: '감식 완료 뒤 사건 서류에 추가된 결과다.',
            },
          ],
        },
      ],
    },
  ],
  discoveries: [
    {
      id: 'FD_INDICATOR',
      documentId: 'D_INITIAL',
      sourceId: 'D_INITIAL_HOTSPOT',
      observation: '사진 속 표시등이 켜져 있다.',
      note: '제어 기록을 분석할 수 있다.',
    },
  ],
  requests: [
    {
      id: 'RQ_FREE',
      label: '무료 기록 조회',
      description: '슬롯을 쓰지 않는 기록 조회다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: ['D_RESULT'],
      resultEvidenceIds: ['E_FREE'],
      resultNotice: '무료 조회가 끝났다.',
      lockedReason: '',
    },
    {
      id: 'RQ_SLOT_A',
      label: '감식 A',
      description: '첫 번째 슬롯 감식이다.',
      kind: 'FORENSIC',
      slotCost: 1,
      resultDocumentIds: [],
      resultEvidenceIds: ['E_SLOT_A'],
      resultNotice: '감식 A가 끝났다.',
      lockedReason: '',
    },
    {
      id: 'RQ_SLOT_B',
      label: '감식 B',
      description: '두 번째 슬롯 감식이다.',
      kind: 'FORENSIC',
      slotCost: 1,
      resultDocumentIds: [],
      resultEvidenceIds: ['E_SLOT_B'],
      resultNotice: '감식 B가 끝났다.',
      lockedReason: '',
    },
    {
      id: 'RQ_OPENED',
      label: '문서 개봉 후 조회',
      description: '초동 보고서를 열어야 보인다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: [],
      resultEvidenceIds: [],
      resultNotice: '문서 개봉 후 조회가 끝났다.',
      lockedReason: '문서를 먼저 열어야 한다.',
    },
    {
      id: 'RQ_DISCOVERY',
      label: '표시등 정밀 감식',
      description: '사진 속 표시등을 발견해야 의뢰할 수 있다.',
      kind: 'FORENSIC',
      slotCost: 1,
      resultDocumentIds: [],
      resultEvidenceIds: ['E_DISCOVERY'],
      resultNotice: '표시등 정밀 감식이 끝났다.',
      lockedReason: '표시등을 먼저 찾아야 한다.',
    },
    {
      id: 'RQ_CHAIN',
      label: '연쇄 후속 조회',
      description: '첫 감식 완료 뒤 열리는 후속 조회다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: [],
      resultEvidenceIds: [],
      resultNotice: '후속 조회가 끝났다.',
      lockedReason: '선행 감식이 필요하다.',
    },
    {
      id: 'RQ_CLAIM',
      label: '진술 기반 조회',
      description: '닫힌 진술 ID로 열린다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: [],
      resultEvidenceIds: [],
      resultNotice: '진술 기반 조회가 끝났다.',
      lockedReason: '진술이 필요하다.',
    },
    {
      id: 'RQ_STAGE',
      label: '단계 기반 조회',
      description: '결정론적 방어 단계에서 열린다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: [],
      resultEvidenceIds: [],
      resultNotice: '단계 기반 조회가 끝났다.',
      lockedReason: '심문 단계가 부족하다.',
    },
  ],
  quotes: [
    {
      id: 'Q_UNMAPPED',
      documentId: 'D_INITIAL',
      sourceId: 'D_INITIAL_OFFICIAL',
      text: '기계 오작동으로 추정한다.',
      unmappedReactionLine: '그건 초동 보고서의 추정일 뿐입니다.',
    },
    {
      id: 'Q_MAPPED',
      documentId: 'D_INITIAL',
      sourceId: 'D_INITIAL_STATEMENT',
      text: '사고 당시 기계실에 있었습니다.',
      mapping: { suspectId: 'suspect-a', claimId: 'C_MACHINE_ROOM' },
      unmappedReactionLine: '제 진술서가 아닙니다.',
    },
    {
      id: 'Q_CHAIN',
      documentId: 'D_CHAIN',
      sourceId: 'D_CHAIN_RESULT',
      text: '연쇄 해금으로 입수한 결과다.',
    },
  ],
  unlocks: [
    // 의도적으로 원인 규칙보다 앞에 둔다. 고정점 평가가 다음 순회에서
    // E_BRIDGE를 보고 D_CHAIN을 열어야 한다.
    {
      id: 'DU_EVIDENCE_CHAIN',
      when: {
        allOf: [{ type: 'evidence-acquired', evidenceId: 'E_BRIDGE' }],
      },
      grants: [{ type: 'document', documentId: 'D_CHAIN' }],
      notice: '연쇄 증거로 후속 문서가 열렸다.',
    },
    {
      id: 'DU_OPENED',
      when: {
        allOf: [{ type: 'document-opened', documentId: 'D_INITIAL' }],
      },
      grants: [{ type: 'request', requestId: 'RQ_OPENED' }],
      notice: '초동 보고서를 읽어 후속 조회가 열렸다.',
    },
    {
      id: 'DU_DISCOVERY',
      when: {
        allOf: [{ type: 'discovery-found', discoveryId: 'FD_INDICATOR' }],
      },
      grants: [{ type: 'request', requestId: 'RQ_DISCOVERY' }],
      notice: '표시등을 근거로 정밀 감식을 의뢰할 수 있다.',
    },
    {
      id: 'DU_REQUEST_CHAIN',
      when: {
        allOf: [
          { type: 'request-completed', requestId: 'RQ_DISCOVERY' },
        ],
      },
      grants: [
        { type: 'evidence', evidenceId: 'E_BRIDGE' },
        { type: 'request', requestId: 'RQ_CHAIN' },
      ],
      notice: '정밀 감식 결과가 후속 조회로 이어졌다.',
    },
    {
      id: 'DU_CLAIM',
      when: {
        allOf: [
          {
            type: 'claim-recorded',
            suspectId: 'suspect-a',
            claimId: 'C_MACHINE_ROOM',
          },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_CLAIM' }],
    },
    {
      id: 'DU_STAGE',
      when: {
        allOf: [
          { type: 'stage', suspectId: 'suspect-a', stageId: 'S_EXPOSED' },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_STAGE' }],
    },
  ],
};

function snapshot(
  evidenceIds: readonly string[] = [],
  recordedClaims: readonly string[] = [],
  stages: ReadonlyMap<string, string> = new Map(),
): DossierSnapshot {
  return {
    acquiredEvidenceIds: new Set(evidenceIds),
    recordedClaims: new Set(recordedClaims),
    stages,
  };
}

function openInitial(
  state = createDossierState(definition),
): DossierState {
  return resolveDossierAction(
    definition,
    state,
    snapshot(),
    { type: 'OPEN_DOCUMENT', documentId: 'D_INITIAL' },
  ).state;
}

function discoverIndicator(
  state = openInitial(),
): DossierState {
  return resolveDossierAction(
    definition,
    state,
    snapshot(),
    {
      type: 'INSPECT_DISCOVERY',
      documentId: 'D_INITIAL',
      discoveryId: 'FD_INDICATOR',
    },
  ).state;
}

describe('사건 서류철 결정론적 상태', () => {
  it('초기 문서와 요청만 지급하고 진행 상태와 슬롯을 비운다', () => {
    expect(createDossierState(definition)).toEqual({
      acquiredDocumentIds: ['D_INITIAL'],
      openedDocumentIds: [],
      foundDiscoveryIds: [],
      availableRequestIds: ['RQ_FREE', 'RQ_SLOT_A', 'RQ_SLOT_B'],
      completedRequestIds: [],
      firedUnlockRuleIds: [],
      spentForensicSlots: 0,
    });
  });

  it('획득한 문서를 열고 문서 열람 조건의 요청을 해금한다', () => {
    const initial = createDossierState(definition);
    const result = resolveDossierAction(
      definition,
      initial,
      snapshot(),
      { type: 'OPEN_DOCUMENT', documentId: 'D_INITIAL' },
    );

    expect(result.accepted).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.state.openedDocumentIds).toEqual(['D_INITIAL']);
    expect(result.newRequestIds).toEqual(['RQ_OPENED']);
    expect(result.state.availableRequestIds).toContain('RQ_OPENED');

    const locked = resolveDossierAction(
      definition,
      result.state,
      snapshot(),
      { type: 'OPEN_DOCUMENT', documentId: 'D_CHAIN' },
    );
    expect(locked.accepted).toBe(false);
    expect(locked.code).toBe('LOCKED');
    expect(locked.state).toBe(result.state);
  });

  it('열지 않은 문서의 발견을 막고 유효한 hotspot 발견만 기록한다', () => {
    const initial = createDossierState(definition);
    const locked = resolveDossierAction(
      definition,
      initial,
      snapshot(),
      {
        type: 'INSPECT_DISCOVERY',
        documentId: 'D_INITIAL',
        discoveryId: 'FD_INDICATOR',
      },
    );
    expect(locked.accepted).toBe(false);
    expect(locked.code).toBe('LOCKED');

    const opened = openInitial(initial);
    const found = resolveDossierAction(
      definition,
      opened,
      snapshot(),
      {
        type: 'INSPECT_DISCOVERY',
        documentId: 'D_INITIAL',
        discoveryId: 'FD_INDICATOR',
      },
    );
    expect(found.accepted).toBe(true);
    expect(found.newDiscoveryIds).toEqual(['FD_INDICATOR']);
    expect(found.state.foundDiscoveryIds).toEqual(['FD_INDICATOR']);
    expect(found.newRequestIds).toEqual(['RQ_DISCOVERY']);
    expect(found.notices).toEqual(
      expect.arrayContaining([
        '사진 속 표시등이 켜져 있다.',
        '표시등을 근거로 정밀 감식을 의뢰할 수 있다.',
      ]),
    );

    const invalid = resolveDossierAction(
      definition,
      opened,
      snapshot(),
      {
        type: 'INSPECT_DISCOVERY',
        documentId: 'D_CHAIN',
        discoveryId: 'FD_INDICATOR',
      },
    );
    expect(invalid.accepted).toBe(false);
    expect(invalid.code).toBe('INVALID');
  });

  it('요청 완료와 그 결과 증거를 같은 호출에서 고정점까지 연쇄 해금한다', () => {
    const ready = discoverIndicator();
    const result = resolveDossierAction(
      definition,
      ready,
      snapshot(),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_DISCOVERY' },
    );

    expect(result.accepted).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.newEvidenceIds).toEqual(['E_DISCOVERY', 'E_BRIDGE']);
    expect(result.newRequestIds).toContain('RQ_CHAIN');
    expect(result.newDocumentIds).toEqual(['D_CHAIN']);
    expect(result.state.acquiredDocumentIds).toContain('D_CHAIN');
    expect(result.state.completedRequestIds).toContain('RQ_DISCOVERY');
    expect(result.state.spentForensicSlots).toBe(1);
    expect(result.state.firedUnlockRuleIds).toEqual(
      expect.arrayContaining([
        'DU_REQUEST_CHAIN',
        'DU_EVIDENCE_CHAIN',
      ]),
    );
  });

  it('외부의 확정 진술과 방어 단계도 synchronize에서만 닫힌 ID로 해금한다', () => {
    const initial = createDossierState(definition);
    const result = synchronizeDossier(
      definition,
      initial,
      snapshot(
        [],
        ['suspect-a:C_MACHINE_ROOM'],
        new Map([['suspect-a', 'S_EXPOSED']]),
      ),
    );

    expect(result.newRequestIds).toEqual(
      expect.arrayContaining(['RQ_CLAIM', 'RQ_STAGE']),
    );
    expect(result.state.availableRequestIds).toEqual(
      expect.arrayContaining(['RQ_CLAIM', 'RQ_STAGE']),
    );
    expect(result.newEvidenceIds).toEqual([]);
  });

  it('아직 해금되지 않은 요청을 거절하고 원본 상태를 그대로 돌려준다', () => {
    const initial = createDossierState(definition);
    const result = resolveDossierAction(
      definition,
      initial,
      snapshot(),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_DISCOVERY' },
    );

    expect(result.accepted).toBe(false);
    expect(result.code).toBe('LOCKED');
    expect(result.state).toBe(initial);
    expect(initial.completedRequestIds).toEqual([]);
    expect(initial.spentForensicSlots).toBe(0);
  });

  it('유료 감식은 슬롯 상한을 넘지 못하고 무료 조회는 상한에서도 허용한다', () => {
    const initial = createDossierState(definition);
    const first = resolveDossierAction(
      definition,
      initial,
      snapshot(),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_SLOT_A' },
    );
    const second = resolveDossierAction(
      definition,
      first.state,
      snapshot(['E_SLOT_A']),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_SLOT_B' },
    );
    expect(second.state.spentForensicSlots).toBe(2);

    const ready = discoverIndicator(openInitial(second.state));
    const noSlots = resolveDossierAction(
      definition,
      ready,
      snapshot(['E_SLOT_A', 'E_SLOT_B']),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_DISCOVERY' },
    );
    expect(noSlots.accepted).toBe(false);
    expect(noSlots.code).toBe('NO_SLOTS');
    expect(noSlots.state).toBe(ready);
    expect(noSlots.state.completedRequestIds).not.toContain('RQ_DISCOVERY');

    const free = resolveDossierAction(
      definition,
      ready,
      snapshot(['E_SLOT_A', 'E_SLOT_B']),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_FREE' },
    );
    expect(free.accepted).toBe(true);
    expect(free.newDocumentIds).toEqual(['D_RESULT']);
    expect(free.state.acquiredDocumentIds).toContain('D_RESULT');
    expect(free.newEvidenceIds).toEqual(['E_FREE']);
    expect(free.state.spentForensicSlots).toBe(2);
  });

  it('문서 열기·발견·요청을 반복해도 상태나 결과를 중복시키지 않는다', () => {
    const opened = openInitial();
    const openedAgain = resolveDossierAction(
      definition,
      opened,
      snapshot(),
      { type: 'OPEN_DOCUMENT', documentId: 'D_INITIAL' },
    );
    expect(openedAgain.code).toBe('ALREADY_DONE');
    expect(openedAgain.state).toBe(opened);
    expect(openedAgain.newRequestIds).toEqual([]);

    const found = discoverIndicator(opened);
    const foundAgain = resolveDossierAction(
      definition,
      found,
      snapshot(),
      {
        type: 'INSPECT_DISCOVERY',
        documentId: 'D_INITIAL',
        discoveryId: 'FD_INDICATOR',
      },
    );
    expect(foundAgain.code).toBe('ALREADY_DONE');
    expect(foundAgain.state).toBe(found);
    expect(foundAgain.newDiscoveryIds).toEqual([]);

    const requested = resolveDossierAction(
      definition,
      found,
      snapshot(),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_FREE' },
    );
    const requestedAgain = resolveDossierAction(
      definition,
      requested.state,
      snapshot(['E_FREE']),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_FREE' },
    );
    expect(requestedAgain.code).toBe('ALREADY_DONE');
    expect(requestedAgain.state).toBe(requested.state);
    expect(requestedAgain.newDocumentIds).toEqual([]);
    expect(requestedAgain.newEvidenceIds).toEqual([]);
    expect(
      requestedAgain.state.acquiredDocumentIds.filter(
        (documentId) => documentId === 'D_RESULT',
      ),
    ).toEqual(['D_RESULT']);
    expect(requestedAgain.state.completedRequestIds).toEqual(['RQ_FREE']);
  });
});

describe('사건 서류철 인용 매핑', () => {
  it('열어 본 문서의 저작 quote만 대상 용의자의 claim ID로 매핑한다', () => {
    const initial = createDossierState(definition);
    expect(
      resolveDossierQuote(definition, initial, 'suspect-a', 'Q_MAPPED'),
    ).toEqual({ valid: false });

    const opened = openInitial(initial);
    const mapped = resolveDossierQuote(
      definition,
      opened,
      'suspect-a',
      'Q_MAPPED',
    );
    expect(mapped.valid).toBe(true);
    expect(mapped.mappedClaimId).toBe('C_MACHINE_ROOM');
    expect(mapped.reactionLine).toBeUndefined();

    const otherSuspect = resolveDossierQuote(
      definition,
      opened,
      'suspect-b',
      'Q_MAPPED',
    );
    expect(otherSuspect.valid).toBe(true);
    expect(otherSuspect.mappedClaimId).toBeUndefined();
    expect(otherSuspect.reactionLine).toBe('제 진술서가 아닙니다.');

    const unmapped = resolveDossierQuote(
      definition,
      opened,
      'suspect-a',
      'Q_UNMAPPED',
    );
    expect(unmapped.valid).toBe(true);
    expect(unmapped.mappedClaimId).toBeUndefined();
    expect(unmapped.reactionLine).toBe(
      '그건 초동 보고서의 추정일 뿐입니다.',
    );
    expect(
      resolveDossierQuote(definition, opened, 'suspect-a', 'Q_UNKNOWN'),
    ).toEqual({ valid: false });
  });

  it('연쇄 획득한 문서도 실제로 연 뒤에만 인용할 수 있다', () => {
    const ready = discoverIndicator();
    const chained = resolveDossierAction(
      definition,
      ready,
      snapshot(),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_DISCOVERY' },
    );

    expect(
      resolveDossierQuote(definition, chained.state, 'suspect-a', 'Q_CHAIN'),
    ).toEqual({ valid: false });

    const opened = resolveDossierAction(
      definition,
      chained.state,
      snapshot(chained.newEvidenceIds),
      { type: 'OPEN_DOCUMENT', documentId: 'D_CHAIN' },
    );
    expect(
      resolveDossierQuote(definition, opened.state, 'suspect-a', 'Q_CHAIN')
        .valid,
    ).toBe(true);
  });
});

describe('사건 서류철 불변성', () => {
  it('성공한 액션과 동기화가 입력 state와 snapshot을 변경하지 않는다', () => {
    const base = createDossierState(definition);
    const state: DossierState = Object.freeze({
      ...base,
      acquiredDocumentIds: Object.freeze([...base.acquiredDocumentIds]),
      openedDocumentIds: Object.freeze([...base.openedDocumentIds]),
      foundDiscoveryIds: Object.freeze([...base.foundDiscoveryIds]),
      availableRequestIds: Object.freeze([...base.availableRequestIds]),
      completedRequestIds: Object.freeze([...base.completedRequestIds]),
      firedUnlockRuleIds: Object.freeze([...base.firedUnlockRuleIds]),
    });
    const context = snapshot(
      ['E_EXISTING'],
      ['suspect-a:C_MACHINE_ROOM'],
      new Map([['suspect-a', 'S_EXPOSED']]),
    );
    const stateBefore = JSON.stringify(state);
    const evidenceBefore = [...context.acquiredEvidenceIds];
    const claimsBefore = [...context.recordedClaims];
    const stagesBefore = [...context.stages];

    const opened = resolveDossierAction(
      definition,
      state,
      context,
      { type: 'OPEN_DOCUMENT', documentId: 'D_INITIAL' },
    );
    const synchronized = synchronizeDossier(
      definition,
      state,
      context,
    );

    expect(opened.state).not.toBe(state);
    expect(synchronized.state).not.toBe(state);
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect([...context.acquiredEvidenceIds]).toEqual(evidenceBefore);
    expect([...context.recordedClaims]).toEqual(claimsBefore);
    expect([...context.stages]).toEqual(stagesBefore);
  });
});
