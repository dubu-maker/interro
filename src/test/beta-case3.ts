/**
 * 사건 3 자율 베타 플레이: 서류철 → 감식/조회 → 3인 심문 → 증명 사슬 검증.
 * 실제 게임과 같은 엔진·LLM 파이프라인을 사용한다.
 *
 * 실행: npm run beta:case3
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runSuspectTurn } from '../ai/interrogationPipeline';
import { OllamaProvider } from '../ai/ollamaProvider';
import type { ChatMessage } from '../ai/types';
import { case3 } from '../cases/case3';
import {
  applyEvidencePresentation,
  commitStatements,
  createContractState,
  type ContractState,
} from '../engine/contract';
import {
  createDossierState,
  resolveDossierAction,
  synchronizeDossier,
  type DossierOutcome,
  type DossierSnapshot,
  type DossierState,
} from '../engine/dossier';
import { getSuspect } from '../engine/case';
import { judgeReport } from '../engine/verdict';
import type { CaseSuspect } from '../engine/case';

const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:14b';
const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/api';
const provider = new OllamaProvider(baseUrl);

interface LogEntry {
  phase: string;
  at: string;
  detail: Record<string, unknown>;
}

interface QualityNote {
  severity: 'info' | 'warn' | 'bug' | 'ux';
  area: string;
  message: string;
  context?: Record<string, unknown>;
}

const log: LogEntry[] = [];
const notes: QualityNote[] = [];
const transcript: {
  suspectId: string;
  kind: 'ask' | 'present' | 'system';
  content: string;
  meta?: Record<string, unknown>;
}[] = [];

function stamp(): string {
  return new Date().toISOString();
}

function push(phase: string, detail: Record<string, unknown>): void {
  log.push({ phase, at: stamp(), detail });
  const summary = Object.entries(detail)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  console.log(`[${phase}] ${summary.slice(0, 240)}`);
}

function note(
  severity: QualityNote['severity'],
  area: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  notes.push({ severity, area, message, context });
  console.log(`  ★ ${severity.toUpperCase()} (${area}) ${message}`);
}

function dossierOf() {
  if (!case3.dossier) throw new Error('case3 dossier missing');
  return case3.dossier;
}

function snapshot(
  evidenceIds: ReadonlySet<string>,
  sessions: Map<string, ContractState>,
): DossierSnapshot {
  const recordedClaims = new Set<string>();
  const stages = new Map<string, string>();
  for (const [suspectId, state] of sessions) {
    stages.set(suspectId, state.stageId);
    for (const statement of state.statements) {
      recordedClaims.add(`${suspectId}:${statement.claimId}`);
    }
  }
  return { acquiredEvidenceIds: evidenceIds, recordedClaims, stages };
}

function applyOutcome(
  state: DossierState,
  outcome: DossierOutcome,
  evidenceIds: Set<string>,
  label: string,
): DossierState {
  if (!outcome.accepted) {
    note('warn', 'dossier', `${label} 거부: ${outcome.code}`, {
      notices: outcome.notices,
    });
    return state;
  }
  for (const id of outcome.newEvidenceIds) evidenceIds.add(id);
  if (
    outcome.newDocumentIds.length ||
    outcome.newRequestIds.length ||
    outcome.newEvidenceIds.length ||
    outcome.newDiscoveryIds.length
  ) {
    push('dossier', {
      action: label,
      docs: outcome.newDocumentIds,
      requests: outcome.newRequestIds,
      evidence: outcome.newEvidenceIds,
      discoveries: outcome.newDiscoveryIds,
      notices: outcome.notices,
      slots: outcome.state.spentForensicSlots,
    });
  }
  return outcome.state;
}

async function ask(
  suspect: CaseSuspect,
  state: ContractState,
  history: ChatMessage[],
  question: string,
  turn: number,
  presentedEvidence?: { id: string; name: string; description: string },
): Promise<ContractState> {
  const started = performance.now();
  const result = await runSuspectTurn({
    provider,
    model,
    contract: suspect.contract,
    state,
    suspect: {
      name: suspect.name,
      role: suspect.role,
      persona: suspect.persona,
    },
    question,
    recentTurns: history.slice(-6),
    presentedEvidence,
    lastCounterQuestion: false,
  });
  const latencyMs = Math.round(performance.now() - started);
  history.push({ role: 'user', content: question });
  history.push({ role: 'assistant', content: result.line });

  const committed = commitStatements(
    suspect.contract,
    state,
    result.plan.claimIds,
    turn,
  );

  transcript.push({
    suspectId: suspect.id,
    kind: 'ask',
    content: question,
    meta: { turn },
  });
  transcript.push({
    suspectId: suspect.id,
    kind: 'system',
    content: result.line,
    meta: {
      claims: result.plan.claimIds,
      speechAct: result.plan.speechAct,
      counterQuestion: result.plan.counterQuestion,
      plannerFallback: result.plan.usedFallback,
      lineFallback: result.usedLineFallback,
      discarded: result.discardedRenders.length,
      latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      stage: committed.state.stageId,
    },
  });

  push('ask', {
    suspect: suspect.name,
    latencyMs,
    claims: result.plan.claimIds,
    fallback: result.usedLineFallback,
    discarded: result.discardedRenders.length,
    line: result.line,
  });

  if (result.usedLineFallback) {
    note('warn', 'llm', `${suspect.name} 고정대사 폴백 사용`, {
      question,
      claims: result.plan.claimIds,
    });
  }
  if (result.discardedRenders.length > 0) {
    note('info', 'llm', `${suspect.name} 렌더 폐기 ${result.discardedRenders.length}회`, {
      violations: result.discardedRenders.flatMap((d) => d.violations),
    });
  }
  if (latencyMs > 90_000) {
    note('ux', 'latency', `${suspect.name} 응답 ${latencyMs}ms — 체감 대기 김`, {
      question,
    });
  }

  // 간단 품질 휴리스틱
  const line = result.line;
  if (/\b(AI|LLM|프롬프트|시스템 지시|캐릭터로서)\b/i.test(line)) {
    note('bug', 'llm', `${suspect.name} 메타 발화 의심`, { line });
  }
  if (line.length < 8) {
    note('warn', 'llm', `${suspect.name} 응답이 지나치게 짧음`, { line });
  }
  if (line.length > 400) {
    note('warn', 'llm', `${suspect.name} 응답이 김 (${line.length}자)`, {});
  }

  return committed.state;
}

function present(
  suspect: CaseSuspect,
  state: ContractState,
  evidenceId: string,
  expectTransition: boolean,
): ContractState {
  const evidence = case3.evidences.find((e) => e.id === evidenceId);
  const outcome = applyEvidencePresentation(
    suspect.contract,
    state,
    evidenceId,
  );
  const transitioned = outcome.transition !== undefined;
  transcript.push({
    suspectId: suspect.id,
    kind: 'present',
    content: `증거 제시: ${evidenceId} ${evidence?.name ?? ''}`,
    meta: {
      transitioned,
      from: state.stageId,
      to: outcome.state.stageId,
      reaction: outcome.transition?.reactionLine,
      notice: outcome.transition?.unlockNotice,
      contradicted: outcome.contradictedClaimIds,
    },
  });
  push('present', {
    suspect: suspect.name,
    evidenceId,
    from: state.stageId,
    to: outcome.state.stageId,
    transitioned,
    reaction: outcome.transition?.reactionLine ?? null,
  });
  if (transitioned !== expectTransition) {
    note('bug', 'engine', `증거 ${evidenceId} 전환 기대=${expectTransition} 실제=${transitioned}`, {
      stage: state.stageId,
      suspect: suspect.id,
    });
  }
  return outcome.state;
}

export async function runBetaCase3(): Promise<void> {
  const startedAt = performance.now();
  push('boot', {
    caseId: case3.id,
    title: case3.title,
    model,
    baseUrl,
    maxTurns: case3.maxTurns,
    motiveOptions: case3.motiveOptions.length,
    methodOptions: case3.methodOptions.length,
  });

  // ── 제품 관찰: case3 종결 UI ─────────────────────────────────
  if (
    case3.motiveOptions.length === 0 &&
    case3.methodOptions.length === 0 &&
    !case3.court &&
    !case3.scene
  ) {
    note(
      'ux',
      'endgame',
      'case3는 motive/method/court/scene이 비어 있어 UI에서 「사건 종결」「용의선상 제외」「재판에 넘긴다」가 숨겨진다. 서류철·심문 슬라이스만 검증 가능한 상태.',
    );
  }

  // ── 1) 서류철 ───────────────────────────────────────────────
  const definition = dossierOf();
  let dossier = createDossierState(definition);
  const evidenceIds = new Set<string>();
  const sessions = new Map<string, ContractState>();
  for (const s of case3.suspects) {
    sessions.set(s.id, createContractState(s.contract));
  }

  // 초기 문서 전부
  for (const docId of definition.initialDocumentIds) {
    const outcome = resolveDossierAction(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
      { type: 'OPEN_DOCUMENT', documentId: docId },
    );
    dossier = applyOutcome(dossier, outcome, evidenceIds, `OPEN ${docId}`);
  }

  // 발견 단서 전부
  const discoveryPlan = [
    { documentId: 'D1', discoveryId: 'FD_2014_REFERENCE' },
    { documentId: 'D2', discoveryId: 'FD_MANUAL_INDICATOR' },
    { documentId: 'D2', discoveryId: 'FD_TAPED_SPEAKER' },
    { documentId: 'D5', discoveryId: 'FD_OFFICIAL_BLACKOUT' },
    { documentId: 'D6', discoveryId: 'FD_MANUAL_KEY_RULE' },
  ] as const;

  for (const item of discoveryPlan) {
    const outcome = resolveDossierAction(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
      {
        type: 'INSPECT_DISCOVERY',
        documentId: item.documentId,
        discoveryId: item.discoveryId,
      },
    );
    dossier = applyOutcome(
      dossier,
      outcome,
      evidenceIds,
      `DISCOVER ${item.discoveryId}`,
    );
  }

  // 해금된 0-slot / 초기 요청 수행 (심문 전 확보 가능한 것)
  const earlyRequests = [
    'RQ_PHONE',
    'RQ_SAFETY_CHECK',
    'RQ_CUE_SHEET',
    'RQ_ARCHIVE',
    'RQ_LIFT_LOG',
    'RQ_KEY_LOG',
  ] as const;

  for (const requestId of earlyRequests) {
    if (!dossier.availableRequestIds.includes(requestId)) {
      note('warn', 'dossier', `조기 의뢰 미해금: ${requestId}`, {
        available: dossier.availableRequestIds,
      });
      continue;
    }
    const outcome = resolveDossierAction(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
      { type: 'REQUEST_ANALYSIS', requestId },
    );
    dossier = applyOutcome(dossier, outcome, evidenceIds, `REQUEST ${requestId}`);
  }

  push('dossier-mid', {
    evidence: [...evidenceIds].sort(),
    slots: `${dossier.spentForensicSlots}/${definition.forensicSlotCount}`,
    availableRequests: dossier.availableRequestIds,
    completed: dossier.completedRequestIds,
  });

  if (!['E1', 'E2', 'E3', 'E4', 'E5', 'E6'].every((id) => evidenceIds.has(id))) {
    note('bug', 'dossier', '심문 전 핵심 증거 E1~E6 일부 미확보', {
      evidence: [...evidenceIds],
    });
  }

  // ── 2) 장미래 심문 (E3 → E2) ────────────────────────────────
  const mirae = getSuspect(case3, 'mirae');
  const miraeHistory: ChatMessage[] = [];
  let miraeState = sessions.get('mirae')!;
  let turn = 1;

  miraeState = await ask(
    mirae,
    miraeState,
    miraeHistory,
    '사고 직전 조정실에서 어떤 큐를 진행했습니까?',
    turn++,
  );
  miraeState = await ask(
    mirae,
    miraeState,
    miraeHistory,
    '승강기 경고음은 정상적으로 작동했습니까?',
    turn++,
  );
  miraeState = present(mirae, miraeState, 'E3', true);
  miraeState = await ask(
    mirae,
    miraeState,
    miraeHistory,
    '경고음을 막은 것과 승강기를 연 것이 정말 별개입니까? 자세히 설명하세요.',
    turn++,
  );
  miraeState = present(mirae, miraeState, 'E2', true);
  miraeState = await ask(
    mirae,
    miraeState,
    miraeHistory,
    '큐시트 수정과 이규태의 동선에 대해 아는 것을 모두 말하세요.',
    turn++,
  );
  sessions.set('mirae', miraeState);

  if (miraeState.stageId !== 'M_FULL') {
    note('bug', 'path', `장미래 최종 단계 기대=M_FULL 실제=${miraeState.stageId}`);
  } else {
    note('info', 'path', '장미래 M_FULL 도달 (E3→E2 경로)');
  }

  // ── 3) 윤하늘 심문 (E5 → E4, E9는 슬롯 부족으로 후순위) ─────
  const haneul = getSuspect(case3, 'haneul');
  const haneulHistory: ChatMessage[] = [];
  let haneulState = sessions.get('haneul')!;

  haneulState = await ask(
    haneul,
    haneulState,
    haneulHistory,
    '사고 당시 어디에 있었습니까?',
    turn++,
  );
  haneulState = await ask(
    haneul,
    haneulState,
    haneulHistory,
    '2014년 사고 자료실에 대해 아는 것이 있습니까?',
    turn++,
  );
  haneulState = present(haneul, haneulState, 'E5', true);
  haneulState = await ask(
    haneul,
    haneulState,
    haneulHistory,
    '윤선아와의 관계와 이 극장에 들어온 이유를 말하세요.',
    turn++,
  );
  haneulState = present(haneul, haneulState, 'E4', true);
  haneulState = await ask(
    haneul,
    haneulState,
    haneulHistory,
    '서혜진과 어떤 대화를 나눴습니까? 위협한 적이 있습니까?',
    turn++,
  );
  sessions.set('haneul', haneulState);

  if (haneulState.stageId !== 'H_ARGUMENT') {
    note('warn', 'path', `윤하늘 단계 기대=H_ARGUMENT 실제=${haneulState.stageId}`);
  } else {
    note('info', 'path', '윤하늘 H_ARGUMENT 도달 (E5→E4). E9는 감식 슬롯 4칸 한계로 보류');
  }

  // 심문 진행 후 서류철 동기화 (통로 영상 해금 조건 등)
  {
    const sync = synchronizeDossier(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
    );
    dossier = applyOutcome(dossier, sync, evidenceIds, 'SYNC after haneul');
  }

  // ── 4) 이규태 심문 (E1 → E6 → E7 → E8) ────────────────────
  const gyutae = getSuspect(case3, 'gyutae');
  const gyutaeHistory: ChatMessage[] = [];
  let gyutaeState = sessions.get('gyutae')!;

  gyutaeState = await ask(
    gyutae,
    gyutaeState,
    gyutaeHistory,
    '사고 당시 어디에 있었고 무엇을 하고 있었습니까?',
    turn++,
  );
  gyutaeState = await ask(
    gyutae,
    gyutaeState,
    gyutaeHistory,
    '승강기 고장이 원인이라고 보십니까?',
    turn++,
  );
  gyutaeState = present(gyutae, gyutaeState, 'E1', true);
  gyutaeState = await ask(
    gyutae,
    gyutaeState,
    gyutaeHistory,
    '수동 해제 명령이 기록됐습니다. 누가 조작할 수 있습니까?',
    turn++,
  );
  gyutaeState = present(gyutae, gyutaeState, 'E6', true);
  gyutaeState = await ask(
    gyutae,
    gyutaeState,
    gyutaeHistory,
    '22:12 보관함을 연 이유를 설명하세요. 열쇠는 어디에 있습니까?',
    turn++,
  );
  sessions.set('gyutae', gyutaeState);

  // G_KEY 이후 통로 복원 해금
  {
    const sync = synchronizeDossier(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
    );
    dossier = applyOutcome(dossier, sync, evidenceIds, 'SYNC after G_KEY');
  }

  if (dossier.availableRequestIds.includes('RQ_CORRIDOR')) {
    const outcome = resolveDossierAction(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_CORRIDOR' },
    );
    dossier = applyOutcome(dossier, outcome, evidenceIds, 'REQUEST RQ_CORRIDOR');
  } else {
    note('bug', 'dossier', 'G_KEY 이후에도 RQ_CORRIDOR 미해금', {
      stage: gyutaeState.stageId,
      available: dossier.availableRequestIds,
    });
  }

  if (evidenceIds.has('E7')) {
    gyutaeState = present(gyutae, gyutaeState, 'E7', true);
    gyutaeState = await ask(
      gyutae,
      gyutaeState,
      gyutaeHistory,
      '추락 전에 서비스 통로에 들어간 이유가 뭡니까?',
      turn++,
    );
    sessions.set('gyutae', gyutaeState);
  }

  {
    const sync = synchronizeDossier(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
    );
    dossier = applyOutcome(dossier, sync, evidenceIds, 'SYNC after G_CORRIDOR');
  }

  if (dossier.availableRequestIds.includes('RQ_AUDIO')) {
    const remaining =
      definition.forensicSlotCount - dossier.spentForensicSlots;
    if (remaining < 1) {
      note('ux', 'slots', '음향 추출(RQ_AUDIO) 슬롯 부족 — 증명 사슬 E8 확보 불가', {
        spent: dossier.spentForensicSlots,
        max: definition.forensicSlotCount,
      });
    }
    const outcome = resolveDossierAction(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_AUDIO' },
    );
    dossier = applyOutcome(dossier, outcome, evidenceIds, 'REQUEST RQ_AUDIO');
  } else {
    note('bug', 'dossier', 'G_CORRIDOR 이후 RQ_AUDIO 미해금', {
      stage: gyutaeState.stageId,
    });
  }

  if (evidenceIds.has('E8')) {
    gyutaeState = present(gyutae, gyutaeState, 'E8', true);
    gyutaeState = await ask(
      gyutae,
      gyutaeState,
      gyutaeHistory,
      '암전, 승강기 구동, 발걸음, 추락 순서가 모두 맞습니다. 아직도 사고라고 주장합니까?',
      turn++,
    );
    sessions.set('gyutae', gyutaeState);
  }

  // E9 여유 슬롯 있으면 윤하늘 클리어
  {
    const sync = synchronizeDossier(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
    );
    dossier = applyOutcome(dossier, sync, evidenceIds, 'SYNC final');
  }
  if (
    dossier.availableRequestIds.includes('RQ_DRESSING_CCTV') &&
    dossier.spentForensicSlots < definition.forensicSlotCount
  ) {
    const outcome = resolveDossierAction(
      definition,
      dossier,
      snapshot(evidenceIds, sessions),
      { type: 'REQUEST_ANALYSIS', requestId: 'RQ_DRESSING_CCTV' },
    );
    dossier = applyOutcome(
      dossier,
      outcome,
      evidenceIds,
      'REQUEST RQ_DRESSING_CCTV',
    );
    if (evidenceIds.has('E9')) {
      haneulState = present(haneul, haneulState, 'E9', true);
      sessions.set('haneul', haneulState);
    }
  } else {
    note(
      'ux',
      'slots',
      '감식 슬롯 4칸으로는 E4(폰)+E1(로그)+E7(통로)+E8(음향) 후 E9(분장실)까지 확보 불가. TRUTH 경로와 윤하늘 완전 클리어(E9)를 동시에 못 함.',
      {
        spent: dossier.spentForensicSlots,
        evidence: [...evidenceIds].sort(),
      },
    );
  }

  // ── 5) 증명 사슬 / 판정 (엔진 직접 — UI 없음) ───────────────
  const chainA = ['E1', 'E2', 'E6', 'E7', 'E8'] as const;
  const chainB = ['E4', 'E5', 'E6', 'E7', 'E8'] as const;
  const hasA = chainA.every((id) => evidenceIds.has(id));
  const hasB = chainB.every((id) => evidenceIds.has(id));

  const verdictA = judgeReport(case3, {
    accusedId: 'gyutae',
    motiveId: 'MOTIVE_EXPOSURE',
    methodId: 'METHOD_REHEARSAL',
    evidenceIds: [...evidenceIds],
  });
  const wrongSuspect = judgeReport(case3, {
    accusedId: 'mirae',
    motiveId: 'MOTIVE_EXPOSURE',
    methodId: 'METHOD_REHEARSAL',
    evidenceIds: [...evidenceIds],
  });

  push('verdict', {
    chainA: hasA,
    chainB: hasB,
    judgeWin: verdictA.win,
    outcome: verdictA.outcome,
    matchedChain: verdictA.matchedChain ?? null,
    missing: verdictA.missingEvidenceIds,
    wrongSuspectOutcome: wrongSuspect.outcome,
  });

  if (!hasA && !hasB) {
    note('bug', 'path', '증명 사슬 A/B 모두 미충족', {
      evidence: [...evidenceIds].sort(),
    });
  } else if (verdictA.win) {
    note('info', 'path', `증명 사슬 충족 · 엔진 유죄 판정 가능 (${verdictA.outcome})`);
  }

  // motive/method ID는 solution에만 있고 options가 비어 있음 → UI 선택 불가
  if (case3.motiveOptions.length === 0) {
    note(
      'bug',
      'endgame',
      'solution.motiveId/methodId는 존재하나 motiveOptions/methodOptions가 비어 플레이어가 기소 폼을 열 수 없음. 증거는 모았어도 게임 내 승리 화면 진입 불가.',
      {
        solutionMotive: case3.solution.motiveId,
        solutionMethod: case3.solution.methodId,
      },
    );
  }

  // 최종 단계 요약
  const stages = Object.fromEntries(
    [...sessions.entries()].map(([id, s]) => [id, s.stageId]),
  );
  push('summary', {
    stages,
    evidence: [...evidenceIds].sort(),
    forensicSlots: `${dossier.spentForensicSlots}/${definition.forensicSlotCount}`,
    turnsUsed: turn - 1,
    notes: notes.length,
    elapsedMs: Math.round(performance.now() - startedAt),
  });

  const report = {
    caseId: case3.id,
    title: case3.title,
    model,
    startedAt: new Date(Date.now() - (performance.now() - startedAt)).toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - startedAt),
    stages,
    evidenceIds: [...evidenceIds].sort(),
    forensic: {
      spent: dossier.spentForensicSlots,
      max: definition.forensicSlotCount,
      completedRequests: dossier.completedRequestIds,
      availableLeft: dossier.availableRequestIds,
    },
    proof: { chainA: hasA, chainB: hasB, verdict: verdictA },
    log,
    notes,
    transcript,
  };

  const outDir = resolve('test-results');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(
    outDir,
    `beta-case3-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n=== 베타 리포트 저장: ${outPath} ===`);
  console.log(
    `단계: ${JSON.stringify(stages)} | 증거 ${evidenceIds.size}개 | 노트 ${notes.length}건 | ${(report.elapsedMs / 1000).toFixed(1)}초`,
  );
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runBetaCase3().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
