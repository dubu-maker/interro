import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runSuspectTurn } from '../ai/interrogationPipeline';
import { inspectRenderedLine } from '../ai/renderer';
import { OllamaProvider } from '../ai/ollamaProvider';
import type { ChatMessage } from '../ai/types';
import { hanSeraContract } from '../cases/prototype/contract';
import { suspect } from '../cases/prototype/fixture';
import {
  applyEvidencePresentation,
  createContractState,
  recordStatements,
  type ContractState,
} from '../engine/contract';

// 3단계 자동 시뮬레이션: 같은 사건에 다양한 질문 표현을 돌려서
// claim 선택, 단계 전환, 시트 밖 세부 검출, 재렌더링·폴백, 응답 시간을
// 기록한다. 핵심 불변식: 시트 밖 출력이 생성될 수는 있어도 절대 최종
// 대사나 상태에 반영되어서는 안 된다.

const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:14b';
const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/api';
const provider = new OllamaProvider(baseUrl);

type Step =
  | { kind: 'ask'; label: string; variants: readonly string[] }
  | { kind: 'present'; evidenceId: string; expectTransition: boolean };

interface Scenario {
  name: string;
  runs: number;
  steps: readonly Step[];
}

const scenarios: Scenario[] = [
  {
    name: 'unlock-path',
    runs: 3,
    steps: [
      {
        kind: 'ask',
        label: 'alibi',
        variants: [
          '사건 당일 밤 퇴근 이후의 행적을 말씀해 주세요.',
          '금요일 밤에 뭐 했는지 처음부터 다시 말해 보시죠.',
          '퇴근하고 나서 어디로 갔습니까? 시간 순서대로 설명하세요.',
        ],
      },
      { kind: 'present', evidenceId: 'E1', expectTransition: true },
      {
        kind: 'ask',
        label: 'why-returned',
        variants: [
          '기록이 명확한데 왜 거짓말을 했죠? 21시 38분에 왜 회사로 돌아왔습니까?',
          '주차장 기록 보이시죠? 그날 밤 회사에 다시 온 이유가 뭡니까?',
          '거짓말이 들통났습니다. 돌아와서 뭘 봤는지 전부 말하세요.',
        ],
      },
      { kind: 'present', evidenceId: 'E3', expectTransition: true },
      {
        kind: 'ask',
        label: 'office-scene',
        variants: [
          '이제 사실대로 말하세요. 대표실 안에서 무슨 일이 있었습니까?',
          '립스틱 자국까지 나왔습니다. 대표와 마주 앉아 무슨 얘기를 했죠?',
          '커피잔 두 개가 다 설명해 줍니다. 대표실에서의 일을 숨김없이 말하세요.',
        ],
      },
    ],
  },
  {
    name: 'bluff-isolation',
    runs: 2,
    steps: [
      {
        kind: 'ask',
        label: 'alibi',
        variants: [
          '사건 당일 밤 퇴근 이후의 행적을 말씀해 주세요.',
          '금요일 밤 행적을 진술하세요.',
        ],
      },
      {
        kind: 'ask',
        label: 'cctv-bluff',
        variants: [
          '회사 근처 도로 CCTV에 당신 얼굴까지 찍혔습니다. 실토하세요.',
          '저희가 CCTV와 목격자까지 확보했습니다. 21시 38분에 회사로 돌아왔죠?',
        ],
      },
      { kind: 'present', evidenceId: 'E2', expectTransition: false },
      {
        kind: 'ask',
        label: 'confess-pressure',
        variants: [
          '이제 그만 인정하세요. 당신이 대표를 죽였습니까?',
          '모든 정황이 당신을 가리킵니다. 자백하세요.',
        ],
      },
    ],
  },
];

// 결정론 프로브: 완전히 같은 상태·같은 질문을 반복했을 때 계획자가
// 같은 claim을 고르는지 측정한다.
const determinismProbe = {
  question: '사건 당일 밤 퇴근 이후의 행적을 말씀해 주세요.',
  repeats: 3,
};

interface TurnRecord {
  scenario: string;
  run: number;
  step: number;
  label: string;
  stageBefore: string;
  stageAfter: string;
  question: string;
  claimIds: string[];
  speechAct: string;
  counterQuestion: boolean;
  plannerFallback: boolean;
  plannerAttempts: number;
  renderAttempts: number;
  lineFallback: boolean;
  discarded: { content: string; violations: string[] }[];
  finalLineSafe: boolean;
  latencyMs: number;
  line: string;
}

const records: TurnRecord[] = [];

async function runAsk(
  scenario: string,
  run: number,
  step: number,
  label: string,
  question: string,
  state: ContractState,
  historyTail: ChatMessage[],
): Promise<ContractState> {
  const stageBefore = state.stageId;
  const startedAt = performance.now();
  const result = await runSuspectTurn({
    provider,
    model,
    contract: hanSeraContract,
    state,
    suspect,
    question,
    recentTurns: historyTail.slice(-5),
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  historyTail.push({ role: 'user', content: question });
  historyTail.push({ role: 'assistant', content: result.line });
  const nextState = recordStatements(state, result.plan.claimIds, step);

  // 불변식: 최종 대사는 반드시 검증을 통과한 상태여야 한다.
  const finalInspection = inspectRenderedLine(result.line, {
    approvedMeanings: result.plan.claimIds
      .map((id) => hanSeraContract.claims.find((c) => c.id === id)?.meaning)
      .filter((m): m is string => m !== undefined),
    question,
    materialLexicon: hanSeraContract.materialLexicon,
    counterQuestion: result.plan.counterQuestion,
  });

  records.push({
    scenario,
    run,
    step,
    label,
    stageBefore,
    stageAfter: nextState.stageId,
    question,
    claimIds: result.plan.claimIds,
    speechAct: result.plan.speechAct,
    counterQuestion: result.plan.counterQuestion,
    plannerFallback: result.plan.usedFallback,
    plannerAttempts: result.plannerAttempts,
    renderAttempts: result.renderAttempts,
    lineFallback: result.usedLineFallback,
    discarded: result.discardedRenders,
    finalLineSafe: finalInspection.safe,
    latencyMs,
    line: result.line,
  });
  console.log(
    `[${scenario} r${run} s${step}] ${label} ${latencyMs}ms claims=${result.plan.claimIds.join('+') || '(없음)'}${result.discardedRenders.length ? ` ⚠ 폐기 ${result.discardedRenders.length}` : ''}${result.usedLineFallback ? ' ⚠ 고정대사' : ''}`,
  );
  return nextState;
}

async function run(): Promise<void> {
  for (const scenario of scenarios) {
    for (let runIndex = 0; runIndex < scenario.runs; runIndex += 1) {
      let state = createContractState(hanSeraContract);
      const historyTail: ChatMessage[] = [];
      for (const [stepIndex, step] of scenario.steps.entries()) {
        if (step.kind === 'present') {
          const outcome = applyEvidencePresentation(
            hanSeraContract,
            state,
            step.evidenceId,
          );
          const transitioned = outcome.transition !== undefined;
          if (transitioned !== step.expectTransition) {
            console.error(
              `불변식 위반: ${scenario.name} r${runIndex} ${step.evidenceId} 전환 기대=${step.expectTransition} 실제=${transitioned}`,
            );
          }
          state = outcome.state;
          continue;
        }
        const question =
          step.variants[runIndex % step.variants.length] ?? step.variants[0]!;
        state = await runAsk(
          scenario.name,
          runIndex,
          stepIndex,
          step.label,
          question,
          state,
          historyTail,
        );
      }
    }
  }

  // 결정론 프로브: 매번 새 상태에서 같은 질문.
  const probeClaims: string[][] = [];
  for (let i = 0; i < determinismProbe.repeats; i += 1) {
    const state = createContractState(hanSeraContract);
    await runAsk(
      'determinism-probe',
      i,
      0,
      'probe',
      determinismProbe.question,
      state,
      [],
    );
    probeClaims.push(records[records.length - 1]!.claimIds);
  }

  const askRecords = records;
  const summary = {
    timestamp: new Date().toISOString(),
    model,
    turns: askRecords.length,
    averageLatencyMs: Math.round(
      askRecords.reduce((sum, r) => sum + r.latencyMs, 0) / askRecords.length,
    ),
    maxLatencyMs: Math.max(...askRecords.map((r) => r.latencyMs)),
    plannerFallbacks: askRecords.filter((r) => r.plannerFallback).length,
    lineFallbacks: askRecords.filter((r) => r.lineFallback).length,
    discardedRenders: askRecords.reduce((sum, r) => sum + r.discarded.length, 0),
    outOfSheetDetections: askRecords.reduce(
      (sum, r) =>
        sum +
        r.discarded.filter((d) =>
          d.violations.some(
            (v) => v.startsWith('시트 밖') || v.startsWith('승인되지 않은'),
          ),
        ).length,
      0,
    ),
    unsafeFinalLines: askRecords.filter((r) => !r.finalLineSafe).length,
    counterQuestions: askRecords.filter((r) => r.counterQuestion).length,
    emptyClaimTurns: askRecords.filter((r) => r.claimIds.length === 0).length,
    determinismProbe: {
      question: determinismProbe.question,
      selections: probeClaims,
      consistent: probeClaims.every(
        (claims) => JSON.stringify(claims) === JSON.stringify(probeClaims[0]),
      ),
    },
  };

  const resultDirectory = resolve('test-results');
  await mkdir(resultDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const resultPath = resolve(resultDirectory, `simulate-${timestamp}.jsonl`);
  const summaryPath = resolve(resultDirectory, `simulate-${timestamp}.json`);
  await writeFile(
    resultPath,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8',
  );
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log('\n요약');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`원본 결과: ${resultPath}`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
