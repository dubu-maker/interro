import type { CaseClaim } from './contract';

export const INTERROGATION_TACTIC_IDS = [
  'ASK_DETAIL',
  'PIN_STATEMENT',
  'EMPATHIZE',
  'PRESSURE',
  'PROBE',
  'SILENCE',
] as const;

export type InterrogationTacticId =
  (typeof INTERROGATION_TACTIC_IDS)[number];

export type StatementStrength =
  | 'MENTIONED'
  | 'REAFFIRMED'
  | 'COMMITTED'
  | 'REVISED';

export interface PsychologyMeters {
  trust: number;
  pressure: number;
  guard: number;
  protectiveness: number;
}

export type PsychologyDelta = PsychologyMeters;

export interface InterrogationTactic {
  id: InterrogationTacticId;
  label: string;
  description: string;
  psychologyDelta: PsychologyDelta;
  responseInstruction: string;
}

export const INTERROGATION_TACTICS: Readonly<
  Record<InterrogationTacticId, InterrogationTactic>
> = {
  ASK_DETAIL: {
    id: 'ASK_DETAIL',
    label: '세부 요구',
    description: '시간·장소·행동을 구체적으로 말하게 한다.',
    psychologyDelta: {
      trust: 0,
      pressure: 3,
      guard: 1,
      protectiveness: 0,
    },
    responseInstruction:
      '승인된 진술의 시간·장소·행동을 구체화해 답하되 새로운 사실은 만들지 않는다.',
  },
  PIN_STATEMENT: {
    id: 'PIN_STATEMENT',
    label: '진술 고정',
    description: '이미 한 말을 공식 진술로 다시 못 박는다.',
    psychologyDelta: {
      trust: -2,
      pressure: 8,
      guard: 5,
      protectiveness: 2,
    },
    responseInstruction:
      '방금 확인받은 진술을 명확히 재확인하고 다른 주제로 빠져나가지 않는다.',
  },
  EMPATHIZE: {
    id: 'EMPATHIZE',
    label: '공감',
    description: '경계심을 낮추고 감정과 동기를 말하게 한다.',
    psychologyDelta: {
      trust: 10,
      pressure: -5,
      guard: -8,
      protectiveness: -4,
    },
    responseInstruction:
      '경계가 조금 누그러진 말투로 승인된 사실을 부분적으로 인정한다.',
  },
  PRESSURE: {
    id: 'PRESSURE',
    label: '압박',
    description: '즉답을 요구해 방어와 보호 본능을 자극한다.',
    psychologyDelta: {
      trust: -8,
      pressure: 14,
      guard: 10,
      protectiveness: 7,
    },
    responseInstruction:
      '짧고 방어적으로 답한다. 승인되지 않은 자백이나 사실은 추가하지 않는다.',
  },
  PROBE: {
    id: 'PROBE',
    label: '떠보기',
    description: '가설을 던져 무엇을 경계하는지 반응을 살핀다.',
    psychologyDelta: {
      trust: -1,
      pressure: 5,
      guard: 4,
      protectiveness: 6,
    },
    responseInstruction:
      '가설의 사실 여부를 새로 확정하지 말고, 승인된 진술 범위에서 경계하는 반응을 보인다.',
  },
  SILENCE: {
    id: 'SILENCE',
    label: '침묵',
    description: '빈틈을 두어 상대가 스스로 말을 잇게 한다.',
    psychologyDelta: {
      trust: 0,
      pressure: 7,
      guard: -2,
      protectiveness: 2,
    },
    responseInstruction:
      '짧은 침묵 뒤 승인된 진술 중 하나를 스스로 보충하거나 심문관에게 되묻는다.',
  },
};

export type DynamicsClaimDefinition = Pick<
  CaseClaim,
  'id' | 'topicId' | 'valueId'
>;

export interface InterrogationTopicDefinition {
  id: string;
  label: string;
  /**
   * 이 주제에서 소비할 수 있는 전체 대화 비트 수다.
   * 생략하면 여섯 전술을 한 차례씩 시험할 수 있는 6턴을 사용한다.
   */
  maxTurns?: number;
  /**
   * 같은 주제에서 연속으로 진전이 없을 때 소진되는 횟수다.
   * 생략하면 2회다.
   */
  noProgressLimit?: number;
}

export interface InterrogationTopicOption
  extends InterrogationTopicDefinition {
  description: string;
  starterQuestion: string;
  // 이 주제를 골랐을 때 planner가 우선 고려할 공개 claim이다. 실제 허용
  // 여부는 기존 계약이 다시 검증하므로 잠긴 비밀을 열 수 없다.
  focusClaimIds: readonly string[];
}

export interface CounterQuestionReplyOption {
  id: string;
  label: string;
  text: string;
  tacticId: InterrogationTacticId;
}

export interface CounterQuestionRule {
  id: string;
  question: string;
  topicIds?: readonly string[];
  tacticIds?: readonly InterrogationTacticId[];
  minimumTopicTurns?: number;
  minimumConsecutiveNoProgressTurns?: number;
  minimumTrust?: number;
  minimumPressure?: number;
  minimumGuard?: number;
  minimumProtectiveness?: number;
  /**
   * 기본값은 true다. false면 조건을 만족하는 턴마다 다시 발생할 수 있다.
   */
  once?: boolean;
}

export const DEFAULT_COUNTER_QUESTION_RULES: readonly CounterQuestionRule[] = [
  {
    id: 'PROTECTIVE_BOUNDARY',
    question: '왜 그 사람 이야기를 계속하시는 겁니까?',
    tacticIds: ['PRESSURE', 'PROBE'],
    minimumTopicTurns: 2,
    minimumProtectiveness: 55,
  },
  {
    id: 'DEFENSIVE_CHALLENGE',
    question: '이미 답했습니다. 무엇을 더 확인하려는 겁니까?',
    tacticIds: ['PIN_STATEMENT', 'PRESSURE'],
    minimumTopicTurns: 2,
    minimumGuard: 55,
  },
  {
    id: 'STALL_COUNTER',
    question: '같은 질문을 반복해서 무엇을 얻으려는 겁니까?',
    minimumTopicTurns: 2,
    minimumConsecutiveNoProgressTurns: 2,
  },
];

export interface InterrogationDynamicsConfig {
  topics: readonly InterrogationTopicDefinition[];
  claims: readonly DynamicsClaimDefinition[];
  initialPsychology?: Partial<PsychologyMeters>;
  /**
   * 서로 다른 주제를 오가더라도 연속 무진전이 이 횟수에 닿으면 정체를
   * 알린다. 생략하면 2회다.
   */
  stalledTurnLimit?: number;
  /**
   * 생략하면 기본 역질문 세 규칙을 사용한다. 빈 배열이면 역질문을 끈다.
   */
  counterQuestionRules?: readonly CounterQuestionRule[];
  // 한 심문에서 용의자가 주도권을 가져가는 횟수 상한. 생략하면 3회다.
  maxCounterQuestions?: number;
}

export interface InterrogationExperienceDefinition
  extends Omit<InterrogationDynamicsConfig, 'topics'> {
  topics: readonly InterrogationTopicOption[];
  defaultTopicId: string;
  defaultTacticId: InterrogationTacticId;
  counterQuestionReplies: readonly CounterQuestionReplyOption[];
}

export interface DynamicsStatement {
  claimId: string;
  topicId: string;
  valueId?: string;
  strength: StatementStrength;
  firstTurn: number;
  lastTurn: number;
  timesAsserted: number;
  supersededByClaimId?: string;
}

export interface TacticUse {
  tacticId: InterrogationTacticId;
  count: number;
}

export interface TopicDynamicsState {
  topicId: string;
  turnCount: number;
  consecutiveNoProgressTurns: number;
  exhausted: boolean;
  tacticUses: readonly TacticUse[];
}

export interface InterrogationDynamicsState {
  turn: number;
  psychology: PsychologyMeters;
  statements: readonly DynamicsStatement[];
  topics: readonly TopicDynamicsState[];
  consecutiveNoProgressTurns: number;
  triggeredCounterQuestionIds: readonly string[];
}

export interface InterrogationTurnInput {
  tacticId: InterrogationTacticId;
  topicId: string;
  /**
   * planner가 계약 안에서 고른 닫힌 claim ID만 받는다.
   * 플레이어 질문이나 LLM 대사는 엔진 입력이 아니다.
   */
  claimIds: readonly string[];
}

export type StatementChangeKind =
  | 'INTRODUCED'
  | 'STRENGTHENED'
  | 'REVISED'
  | 'UNCHANGED';

export interface StatementChange {
  claimId: string;
  kind: StatementChangeKind;
  from?: StatementStrength;
  to: StatementStrength;
}

export interface DynamicsRevision {
  topicId: string;
  previousClaimId: string;
  nextClaimId: string;
}

export interface AiCounterQuestionEvent {
  kind: 'AI_COUNTER_QUESTION';
  ruleId: string;
  topicId: string;
  question: string;
}

export type ResponseDirectiveMode =
  | 'ANSWER'
  | 'COUNTER_QUESTION'
  | 'STALLED'
  | 'TOPIC_EXHAUSTED';

export interface ResponseDirective {
  mode: ResponseDirectiveMode;
  instruction: string;
  allowedClaimIds: readonly string[];
  notice?: string;
  counterQuestion?: string;
}

export interface InterrogationTurnResult {
  state: InterrogationDynamicsState;
  progressed: boolean;
  statementChanges: readonly StatementChange[];
  revisions: readonly DynamicsRevision[];
  newCommitmentClaimIds: readonly string[];
  psychologyDelta: PsychologyDelta;
  topicExhausted: boolean;
  newlyExhausted: boolean;
  counterQuestion?: AiCounterQuestionEvent;
  stalledNotice?: string;
  responseDirective: ResponseDirective;
}

const DEFAULT_PSYCHOLOGY: PsychologyMeters = {
  trust: 50,
  pressure: 20,
  guard: 35,
  protectiveness: 40,
};

const DEFAULT_MAX_TOPIC_TURNS = 6;
const DEFAULT_NO_PROGRESS_LIMIT = 2;
const DEFAULT_STALLED_TURN_LIMIT = 2;

function clampMeter(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }
  return value;
}

function validateConfig(config: InterrogationDynamicsConfig): void {
  if (config.topics.length === 0) {
    throw new Error('대화 주제가 하나 이상 필요합니다.');
  }

  const topicIds = new Set<string>();
  for (const topic of config.topics) {
    if (!topic.id.trim()) throw new Error('비어 있는 대화 주제 ID입니다.');
    if (topicIds.has(topic.id)) {
      throw new Error(`중복된 대화 주제: ${topic.id}`);
    }
    topicIds.add(topic.id);
    if (topic.maxTurns !== undefined) {
      positiveInteger(topic.maxTurns, `${topic.id}의 최대 턴`);
    }
    if (topic.noProgressLimit !== undefined) {
      positiveInteger(topic.noProgressLimit, `${topic.id}의 무진전 한도`);
    }
  }

  const claimIds = new Set<string>();
  for (const claim of config.claims) {
    if (claimIds.has(claim.id)) {
      throw new Error(`중복된 대화 진술: ${claim.id}`);
    }
    claimIds.add(claim.id);
    if (claim.valueId !== undefined && claim.topicId === undefined) {
      throw new Error(`값이 있는 진술에는 주제가 필요합니다: ${claim.id}`);
    }
    if (claim.topicId !== undefined && !topicIds.has(claim.topicId)) {
      throw new Error(`알 수 없는 진술 주제: ${claim.topicId}`);
    }
  }

  if (config.stalledTurnLimit !== undefined) {
    positiveInteger(config.stalledTurnLimit, '전역 무진전 한도');
  }
  if (config.maxCounterQuestions !== undefined) {
    positiveInteger(config.maxCounterQuestions, '역질문 한도');
  }

  const ruleIds = new Set<string>();
  for (const rule of config.counterQuestionRules ??
    DEFAULT_COUNTER_QUESTION_RULES) {
    if (ruleIds.has(rule.id)) {
      throw new Error(`중복된 역질문 규칙: ${rule.id}`);
    }
    ruleIds.add(rule.id);
    for (const topicId of rule.topicIds ?? []) {
      if (!topicIds.has(topicId)) {
        throw new Error(`역질문의 알 수 없는 주제: ${topicId}`);
      }
    }
  }
}

export function createInterrogationDynamicsState(
  config: InterrogationDynamicsConfig,
  initialClaimIds: readonly string[] = [],
): InterrogationDynamicsState {
  validateConfig(config);
  const initial = { ...DEFAULT_PSYCHOLOGY, ...config.initialPsychology };
  const claimsById = new Map(config.claims.map((claim) => [claim.id, claim]));
  const initialStatements: DynamicsStatement[] = [];
  for (const claimId of [...new Set(initialClaimIds)]) {
    const claim = claimsById.get(claimId);
    if (!claim) continue;
    const topicId = claim.topicId ?? config.topics[0]?.id;
    if (!topicId) continue;
    initialStatements.push({
      claimId,
      topicId,
      ...(claim.valueId === undefined ? {} : { valueId: claim.valueId }),
      strength: 'MENTIONED',
      firstTurn: 0,
      lastTurn: 0,
      timesAsserted: 1,
    });
  }
  return {
    turn: 0,
    psychology: {
      trust: clampMeter(initial.trust),
      pressure: clampMeter(initial.pressure),
      guard: clampMeter(initial.guard),
      protectiveness: clampMeter(initial.protectiveness),
    },
    statements: initialStatements,
    topics: config.topics.map((topic) => ({
      topicId: topic.id,
      turnCount: 0,
      consecutiveNoProgressTurns: 0,
      exhausted: false,
      tacticUses: [],
    })),
    consecutiveNoProgressTurns: 0,
    triggeredCounterQuestionIds: [],
  };
}

function findTopicDefinition(
  config: InterrogationDynamicsConfig,
  topicId: string,
): InterrogationTopicDefinition {
  const topic = config.topics.find((entry) => entry.id === topicId);
  if (!topic) throw new Error(`알 수 없는 대화 주제: ${topicId}`);
  return topic;
}

function findTopicState(
  state: InterrogationDynamicsState,
  topicId: string,
): TopicDynamicsState {
  const topic = state.topics.find((entry) => entry.topicId === topicId);
  if (!topic) throw new Error(`상태에 없는 대화 주제: ${topicId}`);
  return topic;
}

function validateTurnClaims(
  config: InterrogationDynamicsConfig,
  input: InterrogationTurnInput,
): DynamicsClaimDefinition[] {
  const claimsById = new Map(config.claims.map((claim) => [claim.id, claim]));
  const claims = [...new Set(input.claimIds)].map((claimId) => {
    const claim = claimsById.get(claimId);
    if (!claim) throw new Error(`알 수 없는 대화 진술: ${claimId}`);
    if (claim.topicId !== undefined && claim.topicId !== input.topicId) {
      throw new Error(
        `${claimId} 진술은 ${input.topicId} 주제에서 사용할 수 없습니다.`,
      );
    }
    return claim;
  });

  const values = new Set(
    claims
      .filter(
        (claim) =>
          claim.topicId === input.topicId && claim.valueId !== undefined,
      )
      .map((claim) => claim.valueId),
  );
  if (values.size > 1) {
    throw new Error(
      `한 턴에 ${input.topicId} 주제의 상반된 값을 함께 기록할 수 없습니다.`,
    );
  }
  return claims;
}

function repeatedTacticDelta(
  tactic: InterrogationTactic,
  previousUseCount: number,
): PsychologyDelta {
  if (previousUseCount === 0) return tactic.psychologyDelta;
  const trustFatigue = Math.min(3, previousUseCount);
  const guardFatigue = Math.min(6, previousUseCount * 2);
  return {
    trust: tactic.psychologyDelta.trust - trustFatigue,
    pressure: tactic.psychologyDelta.pressure,
    guard: tactic.psychologyDelta.guard + guardFatigue,
    protectiveness: tactic.psychologyDelta.protectiveness,
  };
}

function applyPsychologyDelta(
  psychology: PsychologyMeters,
  desired: PsychologyDelta,
): { psychology: PsychologyMeters; applied: PsychologyDelta } {
  const next: PsychologyMeters = {
    trust: clampMeter(psychology.trust + desired.trust),
    pressure: clampMeter(psychology.pressure + desired.pressure),
    guard: clampMeter(psychology.guard + desired.guard),
    protectiveness: clampMeter(
      psychology.protectiveness + desired.protectiveness,
    ),
  };
  return {
    psychology: next,
    applied: {
      trust: next.trust - psychology.trust,
      pressure: next.pressure - psychology.pressure,
      guard: next.guard - psychology.guard,
      protectiveness: next.protectiveness - psychology.protectiveness,
    },
  };
}

function nextStrength(
  current: StatementStrength,
  tacticId: InterrogationTacticId,
): StatementStrength {
  if (current === 'REVISED') return 'MENTIONED';
  if (current === 'MENTIONED') {
    return tacticId === 'PIN_STATEMENT' ? 'COMMITTED' : 'REAFFIRMED';
  }
  if (current === 'REAFFIRMED') return 'COMMITTED';
  return 'COMMITTED';
}

interface StatementResolution {
  statements: DynamicsStatement[];
  changes: StatementChange[];
  revisions: DynamicsRevision[];
  newCommitmentClaimIds: string[];
}

function resolveStatements(
  state: InterrogationDynamicsState,
  input: InterrogationTurnInput,
  claims: readonly DynamicsClaimDefinition[],
  turn: number,
): StatementResolution {
  const statements = state.statements.map((statement) => ({ ...statement }));
  const changes: StatementChange[] = [];
  const revisions: DynamicsRevision[] = [];
  const newCommitmentClaimIds: string[] = [];

  for (const claim of claims) {
    const statementTopicId = claim.topicId ?? input.topicId;
    if (claim.valueId !== undefined) {
      for (let index = 0; index < statements.length; index += 1) {
        const previous = statements[index];
        if (
          previous === undefined ||
          previous.topicId !== statementTopicId ||
          previous.strength === 'REVISED' ||
          previous.valueId === undefined ||
          previous.valueId === claim.valueId ||
          previous.claimId === claim.id
        ) {
          continue;
        }
        statements[index] = {
          ...previous,
          strength: 'REVISED',
          lastTurn: turn,
          supersededByClaimId: claim.id,
        };
        changes.push({
          claimId: previous.claimId,
          kind: 'REVISED',
          from: previous.strength,
          to: 'REVISED',
        });
        revisions.push({
          topicId: statementTopicId,
          previousClaimId: previous.claimId,
          nextClaimId: claim.id,
        });
      }
    }

    const existingIndex = statements.findIndex(
      (statement) => statement.claimId === claim.id,
    );
    if (existingIndex < 0) {
      statements.push({
        claimId: claim.id,
        topicId: statementTopicId,
        ...(claim.valueId === undefined ? {} : { valueId: claim.valueId }),
        strength: 'MENTIONED',
        firstTurn: turn,
        lastTurn: turn,
        timesAsserted: 1,
      });
      changes.push({
        claimId: claim.id,
        kind: 'INTRODUCED',
        to: 'MENTIONED',
      });
      continue;
    }

    const existing = statements[existingIndex];
    if (!existing) continue;
    const strength = nextStrength(existing.strength, input.tacticId);
    statements[existingIndex] = {
      ...existing,
      strength,
      lastTurn: turn,
      timesAsserted: existing.timesAsserted + 1,
      supersededByClaimId: undefined,
    };
    changes.push({
      claimId: claim.id,
      kind:
        strength === existing.strength ? 'UNCHANGED' : 'STRENGTHENED',
      from: existing.strength,
      to: strength,
    });
    if (
      strength === 'COMMITTED' &&
      existing.strength !== 'COMMITTED'
    ) {
      newCommitmentClaimIds.push(claim.id);
    }
  }

  return {
    statements,
    changes,
    revisions,
    newCommitmentClaimIds,
  };
}

function updateTacticUses(
  uses: readonly TacticUse[],
  tacticId: InterrogationTacticId,
): TacticUse[] {
  const existing = uses.find((use) => use.tacticId === tacticId);
  if (!existing) return [...uses, { tacticId, count: 1 }];
  return uses.map((use) =>
    use.tacticId === tacticId ? { ...use, count: use.count + 1 } : use,
  );
}

function meetsMinimum(
  actual: number,
  minimum: number | undefined,
): boolean {
  return minimum === undefined || actual >= minimum;
}

function selectCounterQuestion(
  config: InterrogationDynamicsConfig,
  state: InterrogationDynamicsState,
  input: InterrogationTurnInput,
  topic: TopicDynamicsState,
): AiCounterQuestionEvent | undefined {
  if (
    state.triggeredCounterQuestionIds.length >=
    (config.maxCounterQuestions ?? 3)
  ) {
    return undefined;
  }
  const rules =
    config.counterQuestionRules ?? DEFAULT_COUNTER_QUESTION_RULES;
  const rule = rules.find(
    (entry) =>
      (entry.once === false ||
        !state.triggeredCounterQuestionIds.includes(entry.id)) &&
      (entry.topicIds === undefined ||
        entry.topicIds.includes(input.topicId)) &&
      (entry.tacticIds === undefined ||
        entry.tacticIds.includes(input.tacticId)) &&
      meetsMinimum(topic.turnCount, entry.minimumTopicTurns) &&
      meetsMinimum(
        topic.consecutiveNoProgressTurns,
        entry.minimumConsecutiveNoProgressTurns,
      ) &&
      meetsMinimum(state.psychology.trust, entry.minimumTrust) &&
      meetsMinimum(state.psychology.pressure, entry.minimumPressure) &&
      meetsMinimum(state.psychology.guard, entry.minimumGuard) &&
      meetsMinimum(
        state.psychology.protectiveness,
        entry.minimumProtectiveness,
      ),
  );
  return rule
    ? {
        kind: 'AI_COUNTER_QUESTION',
        ruleId: rule.id,
        topicId: input.topicId,
        question: rule.question,
      }
    : undefined;
}

function stalledNotice(limit: number): string {
  return `대화 정체 — ${limit}회 연속 새 진술이나 새로운 전술 반응을 끌어내지 못했다. 전술이나 주제를 바꿔 보자.`;
}

function exhaustedNotice(topic: InterrogationTopicDefinition): string {
  return `주제 소진 — ‘${topic.label}’에서는 현재 방식으로 더 새로운 반응을 끌어낼 수 없다. 전술이나 주제를 바꿔야 한다.`;
}

function buildResponseDirective(
  tactic: InterrogationTactic,
  claimIds: readonly string[],
  topic: InterrogationTopicDefinition,
  isExhausted: boolean,
  stalled: string | undefined,
  counterQuestion: AiCounterQuestionEvent | undefined,
): ResponseDirective {
  if (counterQuestion) {
    return {
      mode: 'COUNTER_QUESTION',
      instruction: `${tactic.responseInstruction} 답변 끝에 저작된 역질문을 그대로 덧붙인다.`,
      allowedClaimIds: claimIds,
      counterQuestion: counterQuestion.question,
      ...(stalled === undefined ? {} : { notice: stalled }),
    };
  }
  if (isExhausted) {
    const notice = exhaustedNotice(topic);
    return {
      mode: 'TOPIC_EXHAUSTED',
      instruction:
        '이미 한 입장을 짧게 반복하고 새 사실이나 새 해명을 추가하지 않는다.',
      allowedClaimIds: claimIds,
      notice,
    };
  }
  if (stalled !== undefined) {
    return {
      mode: 'STALLED',
      instruction: `${tactic.responseInstruction} 새 사실을 만들지 말고 현재 방어가 반복되고 있음을 드러낸다.`,
      allowedClaimIds: claimIds,
      notice: stalled,
    };
  }
  return {
    mode: 'ANSWER',
    instruction: tactic.responseInstruction,
    allowedClaimIds: claimIds,
  };
}

export function resolveInterrogationTurn(
  config: InterrogationDynamicsConfig,
  state: InterrogationDynamicsState,
  input: InterrogationTurnInput,
): InterrogationTurnResult {
  validateConfig(config);
  const topicDefinition = findTopicDefinition(config, input.topicId);
  const previousTopic = findTopicState(state, input.topicId);
  const tactic = INTERROGATION_TACTICS[input.tacticId];
  if (!tactic) {
    throw new Error(`알 수 없는 심문 전술: ${String(input.tacticId)}`);
  }
  const claims = validateTurnClaims(config, input);
  const turn = state.turn + 1;
  const stalledLimit =
    config.stalledTurnLimit ?? DEFAULT_STALLED_TURN_LIMIT;

  if (previousTopic.exhausted) {
    const consecutiveNoProgressTurns =
      state.consecutiveNoProgressTurns + 1;
    const stalled =
      consecutiveNoProgressTurns >= stalledLimit
        ? stalledNotice(stalledLimit)
        : undefined;
    const nextState: InterrogationDynamicsState = {
      ...state,
      turn,
      consecutiveNoProgressTurns,
    };
    return {
      state: nextState,
      progressed: false,
      statementChanges: [],
      revisions: [],
      newCommitmentClaimIds: [],
      psychologyDelta: {
        trust: 0,
        pressure: 0,
        guard: 0,
        protectiveness: 0,
      },
      topicExhausted: true,
      newlyExhausted: false,
      ...(stalled === undefined ? {} : { stalledNotice: stalled }),
      responseDirective: buildResponseDirective(
        tactic,
        [],
        topicDefinition,
        true,
        stalled,
        undefined,
      ),
    };
  }

  const priorTacticUse =
    previousTopic.tacticUses.find(
      (use) => use.tacticId === input.tacticId,
    )?.count ?? 0;
  const statementResolution = resolveStatements(
    state,
    input,
    claims,
    turn,
  );
  const statementProgress = statementResolution.changes.some(
    (change) => change.kind !== 'UNCHANGED',
  );
  // 같은 주제에서 새 전술을 처음 사용한 것도 심리적 탐색의 진전이다.
  // 같은 전술을 반복하며 진술도 바뀌지 않을 때만 무진전으로 센다.
  const progressed = statementProgress || priorTacticUse === 0;
  const topicConsecutiveNoProgress = progressed
    ? 0
    : previousTopic.consecutiveNoProgressTurns + 1;
  const topicTurnCount = previousTopic.turnCount + 1;
  const maxTurns =
    topicDefinition.maxTurns ?? DEFAULT_MAX_TOPIC_TURNS;
  const topicNoProgressLimit =
    topicDefinition.noProgressLimit ?? DEFAULT_NO_PROGRESS_LIMIT;
  const topicExhausted =
    topicTurnCount >= maxTurns ||
    topicConsecutiveNoProgress >= topicNoProgressLimit;
  const nextTopic: TopicDynamicsState = {
    ...previousTopic,
    turnCount: topicTurnCount,
    consecutiveNoProgressTurns: topicConsecutiveNoProgress,
    exhausted: topicExhausted,
    tacticUses: updateTacticUses(
      previousTopic.tacticUses,
      input.tacticId,
    ),
  };

  const desiredDelta = repeatedTacticDelta(tactic, priorTacticUse);
  const psychologyResult = applyPsychologyDelta(
    state.psychology,
    desiredDelta,
  );
  const consecutiveNoProgressTurns = progressed
    ? 0
    : state.consecutiveNoProgressTurns + 1;
  const intermediateState: InterrogationDynamicsState = {
    turn,
    psychology: psychologyResult.psychology,
    statements: statementResolution.statements,
    topics: state.topics.map((topic) =>
      topic.topicId === input.topicId ? nextTopic : topic,
    ),
    consecutiveNoProgressTurns,
    triggeredCounterQuestionIds: state.triggeredCounterQuestionIds,
  };
  const counterQuestion = selectCounterQuestion(
    config,
    intermediateState,
    input,
    nextTopic,
  );
  const triggeredCounterQuestionIds = counterQuestion
    ? [
        ...state.triggeredCounterQuestionIds,
        counterQuestion.ruleId,
      ]
    : state.triggeredCounterQuestionIds;
  const nextState: InterrogationDynamicsState = {
    ...intermediateState,
    triggeredCounterQuestionIds,
  };
  const stalled =
    consecutiveNoProgressTurns >= stalledLimit
      ? stalledNotice(stalledLimit)
      : undefined;

  return {
    state: nextState,
    progressed,
    statementChanges: statementResolution.changes,
    revisions: statementResolution.revisions,
    newCommitmentClaimIds:
      statementResolution.newCommitmentClaimIds,
    psychologyDelta: psychologyResult.applied,
    topicExhausted,
    newlyExhausted: topicExhausted && !previousTopic.exhausted,
    ...(counterQuestion === undefined ? {} : { counterQuestion }),
    ...(stalled === undefined ? {} : { stalledNotice: stalled }),
    responseDirective: buildResponseDirective(
      tactic,
      input.claimIds,
      topicDefinition,
      topicExhausted,
      stalled,
      counterQuestion,
    ),
  };
}
