import './style.css';
import { DesktopModelProvider } from './ai/desktopModelProvider';
import { runSuspectTurn } from './ai/interrogationPipeline';
import { OllamaProvider } from './ai/ollamaProvider';
import type { ChatMessage } from './ai/types';
import { case1, resolveCase } from './cases';
import { case1SceneStageLayout } from './cases/case1/sceneStage';
import {
  evaluateUnlocks,
  getSuspect,
  type CaseSuspect,
} from './engine/case';
import {
  judgeRelease,
  judgeReport,
  type VerdictResult,
} from './engine/verdict';
import {
  judgeCourt,
  type CourtArgument,
  type CourtVerdict,
} from './engine/court';
import {
  canStartForensics,
  commitForensicSelection,
  createPsychologyTrialState,
  enterCourt,
  resolveConfrontation,
  resolveFinale,
  resolveProbe,
  resolveStatementCommitments,
  toggleForensicOption,
  type PsychologyProgressResult,
  type PsychologyTrialState,
} from './engine/psychologyTrial';
import {
  availableSpots,
  createSceneProgress,
  examineSceneSpot,
  judgeSceneRuling,
  type DeathRulingChoice,
  type SceneProgress,
} from './engine/scene';
import {
  applyEvidencePresentation,
  commitStatements,
  createContractState,
  getClaim,
  selectHint,
  type ContractState,
} from './engine/contract';
import {
  canAskQuestion,
  createGameState,
  isOvertime,
  recordCompletedTurn,
} from './engine/gameState';
import type { Evidence, EvidenceView } from './engine/types';
import type { PhaserSceneStage as PhaserSceneStageInstance } from './presentation/sceneStage';
import {
  createSceneStageSnapshot,
  type SceneStageLayout,
} from './presentation/sceneStageModel';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app 요소를 찾을 수 없습니다.');

const ollamaBaseUrl =
  import.meta.env.VITE_OLLAMA_BASE_URL ?? '/api/ollama';
const desktopModel = window.interroDesktop?.model;
const defaultModel = desktopModel?.defaultModel ??
  import.meta.env.VITE_OLLAMA_MODEL ??
  'qwen2.5:14b';
const provider = window.interroDesktop
  ? new DesktopModelProvider(window.interroDesktop)
  : new OllamaProvider(ollamaBaseUrl);
const isOpenAiDesktop = desktopModel?.provider === 'openai';
const modelFieldLabel = isOpenAiDesktop
  ? 'OpenAI API 모델'
  : window.interroDesktop
    ? '로컬 AI 모델'
    : 'Ollama 모델';
const sessionLabel = isOpenAiDesktop ? 'OpenAI API 세션' : '로컬 세션';

// 사건 선택: ?case=case1 또는 ?case=case2. 지정하지 않으면 언어별
// 기술 프로토타입으로 돌아간다.
const urlParams = new URLSearchParams(window.location.search);
const activeCase = resolveCase(
  urlParams.get('case'),
  urlParams.get('lang') === 'en' ? 'en' : 'ko',
);

const sceneStageLayout: SceneStageLayout =
  activeCase.id === case1.id
    ? case1SceneStageLayout
    : {
        ariaLabel: '사건 현장 조사 배치도',
        locationLabel: '사건 현장',
        ambientLabel: '현장 환경음',
        placements: [],
      };

let gameState = createGameState(activeCase.maxTurns);
let isWaiting = false;
let totalInputTokens = 0;
let totalOutputTokens = 0;
let lastLatencyMs: number | undefined;
let guardRetryCount = 0;
// 용의자별 심문 세션. 계약 상태·대화 이력·정체 카운터를 분리 보관한다.
interface SuspectSession {
  contractState: ContractState;
  history: ChatMessage[];
  messages: { kind: string; content: string }[];
  presentedEvidenceIds: string[];
  stalledTurns: number;
  shownHintIds: string[];
  followUpQuestions: string[];
  lastCounterQuestion: boolean;
}

const sessions = new Map<string, SuspectSession>();
let activeSuspectId = activeCase.suspects[0]?.id ?? '';

function activeSuspect(): CaseSuspect {
  return getSuspect(activeCase, activeSuspectId);
}

function session(): SuspectSession {
  let entry = sessions.get(activeSuspectId);
  if (!entry) {
    const current = activeSuspect();
    entry = {
      contractState: createContractState(current.contract),
      history: [],
      messages: [{ kind: 'system', content: current.introLine }],
      presentedEvidenceIds: [],
      stalledTurns: 0,
      shownHintIds: [],
      followUpQuestions: [],
      lastCounterQuestion: false,
    };
    sessions.set(activeSuspectId, entry);
  }
  return entry;
}

// 증거 제시로 확정된 새 사실 알림 (사건 전체 공유, 전환 순서대로).
const unlockedNotices: string[] = [];
// 점진 공개 상태: 입수한 증거와 열린 용의자.
const acquiredEvidenceIds = new Set<string>(activeCase.initialEvidenceIds);
const unlockedSuspectIds = new Set<string>(activeCase.initialSuspectIds);
// 판정이 내려지면 심문은 종료된다.
let verdict: VerdictResult | undefined;
const psychologyDefinition = activeCase.psychologyTrial;
let psychologyState: PsychologyTrialState | undefined = psychologyDefinition
  ? createPsychologyTrialState(psychologyDefinition)
  : undefined;
let courtVerdict: CourtVerdict | undefined;
let courtCandidateId = '';
let courtChargeId = '';
const courtArgumentSelections = new Map<string, string>();
// 플레이어가 용의선상에서 제외한 인물.
const releasedSuspectIds = new Set<string>();
// 최종 보고서에서 고른 값.
let reportChoice = { accusedId: '', motiveId: '', methodId: '' };
let lastAccusedName = '';
const reportEvidenceIds = new Set<string>();
let selectedEvidence: Evidence | undefined;
// 탁자 위에 올려 둔 증거. 다음 추궁(질문 전송)과 함께 작동한다.
let slottedEvidence: Evidence | undefined;
// 막 구조: 현장(1막)이 있으면 현장에서 시작하고, 타살 입건 후 심문(2막).
let phase: 'scene' | 'interrogation' = activeCase.scene
  ? 'scene'
  : 'interrogation';
let caseOpened = !activeCase.scene;
let sceneProgress: SceneProgress = createSceneProgress();
// 현장 오판(사고·자살 종결) 시 저장되는 결말.
let sceneEnd: { title: string; epilogue: string } | undefined;
let sceneRulingChoice: DeathRulingChoice | '' = '';
const sceneRulingEvidenceIds = new Set<string>();

function isCaseEnded(): boolean {
  return (
    verdict !== undefined ||
    sceneEnd !== undefined ||
    courtVerdict !== undefined
  );
}
let parkingPlaybackTimer: ReturnType<typeof setInterval> | undefined;

app.innerHTML = `
  <main id="game-shell" class="game-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">INTERRO / 기술 검증용 사건</p>
        <h1>${activeCase.title}</h1>
      </div>
      <div class="status-row">
        <div class="session-status">
          <span id="turn-status"></span>
          <span id="session-metrics">${sessionLabel}</span>
        </div>
        <label class="model-field">
          <span>${modelFieldLabel}</span>
          <input id="model-input" value="${defaultModel}" />
        </label>
        <button id="phase-toggle-button" class="reset-button" type="button" hidden>현장 재조사</button>
        <button id="report-button" class="report-button" type="button">사건 종결</button>
        <button id="reset-button" class="reset-button" type="button">새 심문</button>
      </div>
    </header>

    <section class="briefing-panel">
      <h2>사건 브리핑</h2>
      <p>${activeCase.briefing}</p>
    </section>

    <div class="workspace">
      <section class="interrogation-panel">
        <div id="scene-panel" class="scene-panel" hidden>
          <header class="scene-stage-header">
            <div>
              <p class="eyebrow">ACT I · 현장 수사</p>
              <h2>${activeCase.title}</h2>
              <p id="scene-location" class="scene-location"></p>
            </div>
            <div class="scene-stage-status">
              <span id="scene-progress">조사 기록 0</span>
              <button id="scene-audio-button" class="scene-audio-button" type="button" aria-pressed="false">
                환경음 켜기
              </button>
            </div>
          </header>
          <div class="scene-stage-frame">
            <div id="scene-stage-host" class="scene-stage-host"></div>
            <div class="scene-stage-overlay">
              <p id="scene-ambient" class="scene-ambient"></p>
              <p id="scene-intro" class="scene-intro"></p>
            </div>
          </div>
          <div id="scene-log" class="scene-log" aria-live="polite"></div>
          <details id="scene-accessibility" class="scene-accessibility">
            <summary>터치·키보드·스크린리더용 텍스트 조사</summary>
            <div id="scene-spots" class="scene-spots"></div>
          </details>
        </div>
        <div id="suspect-tabs" class="suspect-tabs"></div>
        <div class="suspect-card">
          <div id="suspect-portrait" class="portrait" aria-hidden="true"></div>
          <div>
            <p class="eyebrow">심문 대상</p>
            <h2 id="suspect-name"></h2>
            <p id="suspect-role"></p>
          </div>
          <div class="suspect-actions">
            <button id="indict-button" class="indict-button" type="button">재판에 넘긴다</button>
            <button id="release-button" class="release-button" type="button">용의선상 제외</button>
          </div>
        </div>

        <section id="psychology-progress" class="psychology-progress" aria-live="polite" aria-label="심리 공방 진행" hidden>
          <div>
            <p class="eyebrow">심리 공방</p>
            <strong id="psychology-stage"></strong>
            <p id="psychology-cue" class="psychology-cue"></p>
          </div>
          <div id="contradiction-list" class="contradiction-list"></div>
          <button id="psychology-action" type="button"></button>
        </section>

        <div id="chat-log" class="chat-log" aria-live="polite"></div>

        <div id="evidence-slot" class="evidence-slot" hidden></div>

        <div id="starter-questions" class="starter-questions"></div>

        <form id="question-form" class="question-form">
          <textarea
            id="question-input"
            rows="2"
            maxlength="500"
            placeholder="용의자에게 질문한다…"
            required
          ></textarea>
          <button id="send-button" type="submit">질문</button>
        </form>
      </section>

      <aside class="evidence-panel">
        <div>
          <p class="eyebrow">사건 기록</p>
          <h2>증거</h2>
        </div>
        <div id="evidence-list" class="evidence-list"></div>
        <div class="unlocked-panel">
          <h3>확인된 새 사실</h3>
          <ul id="unlocked-list"><li>아직 없음</li></ul>
        </div>
        <div class="statements-panel">
          <h3>용의자 진술</h3>
          <p class="panel-note">용의자의 주장일 뿐, 확인된 사실이 아니다.</p>
          <ul id="statements-list"><li>아직 없음</li></ul>
        </div>
      </aside>
    </div>

    <dialog id="evidence-dialog" class="evidence-dialog" aria-labelledby="viewer-title">
      <div class="evidence-viewer">
        <header class="viewer-header">
          <div>
            <p class="eyebrow">증거물 열람</p>
            <h2 id="viewer-title"></h2>
          </div>
          <button id="viewer-close" class="viewer-close" type="button" aria-label="닫기">×</button>
        </header>
        <div id="viewer-content" class="viewer-content"></div>
        <footer class="viewer-footer">
          <span>열람만으로는 심문 상태가 바뀌지 않습니다.</span>
          <button id="viewer-present" type="button">이 증거 제시</button>
        </footer>
      </div>
    </dialog>

    <dialog id="forensic-dialog" class="evidence-dialog" aria-labelledby="forensic-title">
      <div class="evidence-viewer">
        <header class="viewer-header">
          <div>
            <p class="eyebrow">감식 인터미션</p>
            <h2 id="forensic-title">의뢰할 감식 ${psychologyDefinition?.forensicSelectionCount ?? 3}개를 고르세요</h2>
          </div>
          <button id="forensic-close" class="viewer-close" type="button" aria-label="닫기">×</button>
        </header>
        <div id="forensic-content" class="viewer-content"></div>
        <footer class="viewer-footer">
          <span id="forensic-note">선택하지 않은 감식 결과는 이번 플레이에서 얻을 수 없습니다.</span>
          <button id="forensic-submit" type="button">감식 의뢰 확정</button>
        </footer>
      </div>
    </dialog>

    <dialog id="finale-dialog" class="evidence-dialog" aria-labelledby="finale-title">
      <div class="evidence-viewer">
        <header class="viewer-header">
          <div>
            <p class="eyebrow">심문 피날레</p>
            <h2 id="finale-title">마지막 한마디</h2>
          </div>
          <button id="finale-close" class="viewer-close" type="button" aria-label="닫기">×</button>
        </header>
        <div id="finale-content" class="viewer-content"></div>
        <footer class="viewer-footer">
          <span>이 선택은 증거가 아니라, 법정에 이르는 사람의 태도를 바꿉니다.</span>
        </footer>
      </div>
    </dialog>

    <dialog id="report-dialog" class="evidence-dialog" aria-labelledby="report-title">
      <div class="evidence-viewer report-viewer">
        <header class="viewer-header">
          <div>
            <p id="report-eyebrow" class="eyebrow">최종 수사 보고서</p>
            <h2 id="report-title">사건을 종결합니다</h2>
          </div>
          <button id="report-close" class="viewer-close" type="button" aria-label="닫기">×</button>
        </header>
        <div id="report-content" class="viewer-content"></div>
        <footer class="viewer-footer">
          <span id="report-note">자백이 아니라 증거가 사건을 끝냅니다.</span>
          <button id="report-submit" type="button">기소한다</button>
        </footer>
      </div>
    </dialog>
  </main>
`;

const chatLog = getElement<HTMLDivElement>('chat-log');
const gameShell = getElement<HTMLElement>('game-shell');
const scenePanel = getElement<HTMLDivElement>('scene-panel');
const sceneIntro = getElement<HTMLParagraphElement>('scene-intro');
const sceneLog = getElement<HTMLDivElement>('scene-log');
const sceneSpots = getElement<HTMLDivElement>('scene-spots');
const sceneStageHost = getElement<HTMLDivElement>('scene-stage-host');
const sceneLocation = getElement<HTMLParagraphElement>('scene-location');
const sceneProgressLabel = getElement<HTMLSpanElement>('scene-progress');
const sceneAmbient = getElement<HTMLParagraphElement>('scene-ambient');
const sceneAudioButton = getElement<HTMLButtonElement>('scene-audio-button');
const sceneAccessibility = getElement<HTMLDetailsElement>('scene-accessibility');
const phaseToggleButton = getElement<HTMLButtonElement>('phase-toggle-button');
const suspectTabs = getElement<HTMLDivElement>('suspect-tabs');
const suspectPortrait = getElement<HTMLDivElement>('suspect-portrait');
const suspectName = getElement<HTMLHeadingElement>('suspect-name');
const suspectRole = getElement<HTMLParagraphElement>('suspect-role');
const releaseButton = getElement<HTMLButtonElement>('release-button');
const indictButton = getElement<HTMLButtonElement>('indict-button');
const psychologyProgress = getElement<HTMLElement>('psychology-progress');
const psychologyStage = getElement<HTMLElement>('psychology-stage');
const psychologyCue = getElement<HTMLParagraphElement>('psychology-cue');
const contradictionList = getElement<HTMLDivElement>('contradiction-list');
const psychologyAction = getElement<HTMLButtonElement>('psychology-action');
const evidenceList = getElement<HTMLDivElement>('evidence-list');
const starterQuestionsBox = getElement<HTMLDivElement>('starter-questions');
const evidenceSlot = getElement<HTMLDivElement>('evidence-slot');
const questionForm = getElement<HTMLFormElement>('question-form');
const questionInput = getElement<HTMLTextAreaElement>('question-input');
const sendButton = getElement<HTMLButtonElement>('send-button');
const modelInput = getElement<HTMLInputElement>('model-input');
modelInput.readOnly = isOpenAiDesktop;
const turnStatus = getElement<HTMLSpanElement>('turn-status');
const sessionMetrics = getElement<HTMLSpanElement>('session-metrics');
const unlockedList = getElement<HTMLUListElement>('unlocked-list');
const statementsList = getElement<HTMLUListElement>('statements-list');
const resetButton = getElement<HTMLButtonElement>('reset-button');
const reportButton = getElement<HTMLButtonElement>('report-button');
const reportDialog = getElement<HTMLDialogElement>('report-dialog');
const reportContent = getElement<HTMLDivElement>('report-content');
const reportSubmit = getElement<HTMLButtonElement>('report-submit');
const reportClose = getElement<HTMLButtonElement>('report-close');
const reportNote = getElement<HTMLSpanElement>('report-note');
const reportEyebrow = getElement<HTMLParagraphElement>('report-eyebrow');
const reportTitle = getElement<HTMLHeadingElement>('report-title');
const forensicDialog = getElement<HTMLDialogElement>('forensic-dialog');
const forensicContent = getElement<HTMLDivElement>('forensic-content');
const forensicSubmit = getElement<HTMLButtonElement>('forensic-submit');
const forensicClose = getElement<HTMLButtonElement>('forensic-close');
const forensicNote = getElement<HTMLSpanElement>('forensic-note');
const finaleDialog = getElement<HTMLDialogElement>('finale-dialog');
const finaleContent = getElement<HTMLDivElement>('finale-content');
const finaleClose = getElement<HTMLButtonElement>('finale-close');
const evidenceDialog = getElement<HTMLDialogElement>('evidence-dialog');
const viewerTitle = getElement<HTMLHeadingElement>('viewer-title');
const viewerContent = getElement<HTMLDivElement>('viewer-content');
const viewerClose = getElement<HTMLButtonElement>('viewer-close');
const viewerPresent = getElement<HTMLButtonElement>('viewer-present');

if (window.matchMedia('(pointer: coarse)').matches) {
  sceneAccessibility.open = true;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
  return element as T;
}

let sceneAudioEnabled = false;
let sceneStage: PhaserSceneStageInstance | undefined;
let sceneStageDisposed = false;

function showSceneStageFailure(error: unknown): void {
  console.error('현장 렌더링을 시작하지 못했습니다.', error);
  sceneStageHost.classList.add('unavailable');
  sceneStageHost.textContent =
    '현장 그래픽을 표시하지 못했습니다. 아래 텍스트 조사 목록을 이용해 주세요.';
  sceneAccessibility.open = true;
}

if (activeCase.scene) {
  void import('./presentation/sceneStage')
    .then(({ PhaserSceneStage }) => {
      if (sceneStageDisposed) return;
      sceneStageHost.replaceChildren();
      try {
        sceneStage = new PhaserSceneStage(
          sceneStageHost,
          {
            onIntent: (intent) => {
              if (intent.type === 'examine-spot') examineSpot(intent.spotId);
            },
          },
          sceneStageLayout.visual,
        );
      } catch (error) {
        showSceneStageFailure(error);
        return;
      }
      renderSceneSpots();
      sceneStage.setActive(phase === 'scene');
      sceneStage.setAudioEnabled(sceneAudioEnabled);
      sceneStage.setBusy(isWaiting);
      if (phase === 'scene') {
        window.requestAnimationFrame(() => sceneStage?.refresh());
      }
    })
    .catch((error: unknown) => showSceneStageFailure(error));
}

function appendMessage(
  kind: 'detective' | 'suspect' | 'system' | 'error' | 'hint',
  content: string,
  record = true,
): HTMLDivElement {
  const message = document.createElement('div');
  message.className = `message ${kind}`;
  message.textContent = content;
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
  // 용의자 전환 시 대화를 복원할 수 있도록 세션에도 기록한다.
  if (record) {
    session().messages.push({ kind, content });
  }
  return message;
}

// 용의자 전환 시 세션에 기록된 메시지로 대화창을 다시 그린다.
function rebuildChatLog(): void {
  chatLog.replaceChildren();
  for (const message of session().messages) {
    const element = document.createElement('div');
    element.className = `message ${message.kind}`;
    element.textContent = message.content;
    chatLog.append(element);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderSuspectCard(): void {
  const current = activeSuspect();
  suspectPortrait.textContent = current.portrait;
  suspectName.textContent = current.name;
  suspectRole.textContent = current.role;
  questionInput.placeholder = `${current.name}에게 질문한다…`;

  // 용의선상 제외: 남은 턴을 아끼는 대신, 진범을 놓아주면 그대로 패배한다.
  releaseButton.hidden =
    activeCase.court !== undefined ||
    activeCase.motiveOptions.length === 0 ||
    isCaseEnded();
  releaseButton.disabled =
    isWaiting || releasedSuspectIds.has(current.id) || isCaseEnded();
  releaseButton.textContent = releasedSuspectIds.has(current.id)
    ? '제외됨'
    : '용의선상 제외';
  // 재판 회부: 이 사람을 범인으로 고정하고 기소한다.
  indictButton.hidden = activeCase.court ? isCaseEnded() : releaseButton.hidden;
  indictButton.disabled =
    isWaiting ||
    isCaseEnded() ||
    (activeCase.court !== undefined &&
      psychologyState?.phase === 'SESSION_ONE');
  indictButton.textContent = activeCase.court ? '공판 논증' : '재판에 넘긴다';
}

function renderSuspectTabs(): void {
  suspectTabs.replaceChildren();
  const visible = activeCase.suspects.filter((entry) =>
    unlockedSuspectIds.has(entry.id),
  );
  if (visible.length <= 1) {
    suspectTabs.hidden = true;
    return;
  }
  suspectTabs.hidden = false;
  for (const entry of visible) {
    const tab = document.createElement('button');
    tab.type = 'button';
    const released = releasedSuspectIds.has(entry.id);
    tab.className = `suspect-tab${entry.id === activeSuspectId ? ' active' : ''}${released ? ' released' : ''}`;
    tab.textContent = released ? `${entry.name} (제외)` : entry.name;
    tab.disabled = isWaiting;
    tab.addEventListener('click', () => switchSuspect(entry.id));
    suspectTabs.append(tab);
  }
}

// ── 1막: 현장 수사 ─────────────────────────────────────────────
function appendSceneEntry(title: string, text: string): void {
  const entry = document.createElement('div');
  entry.className = 'scene-entry';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const body = document.createElement('p');
  body.textContent = text;
  entry.append(heading, body);
  sceneLog.append(entry);
  sceneLog.scrollTop = sceneLog.scrollHeight;
}

function renderSceneSpots(): void {
  if (!activeCase.scene) return;
  const examinedSpotIds = new Set(sceneProgress.examinedSpotIds);
  sceneSpots.replaceChildren();
  for (const spot of availableSpots(activeCase.scene, examinedSpotIds)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scene-spot${examinedSpotIds.has(spot.id) ? ' examined' : ''}`;
    const name = document.createElement('strong');
    name.textContent = spot.name;
    const hint = document.createElement('span');
    hint.textContent = examinedSpotIds.has(spot.id) ? '조사 완료' : spot.hint;
    button.append(name, hint);
    button.disabled = examinedSpotIds.has(spot.id) || isCaseEnded();
    button.addEventListener('click', () => examineSpot(spot.id));
    sceneSpots.append(button);
  }

  const snapshot = createSceneStageSnapshot(
    activeCase.scene,
    sceneProgress,
    sceneStageLayout,
    phase === 'scene' && !isCaseEnded(),
  );
  sceneLocation.textContent = snapshot.locationLabel;
  sceneAmbient.textContent = `환경음 · ${snapshot.ambientLabel}`;
  sceneProgressLabel.textContent = `조사 기록 ${snapshot.investigatedCount}`;
  sceneStageHost.setAttribute('aria-label', snapshot.ariaLabel);
  sceneStage?.update(snapshot);
}

function examineSpot(spotId: string): void {
  const scene = activeCase.scene;
  if (!scene || isCaseEnded()) return;
  const examination = examineSceneSpot(scene, sceneProgress, spotId);
  if (examination.outcome === 'REJECTED') return;
  sceneProgress = examination.progress;
  const spot = examination.spot;
  appendSceneEntry(spot.name, spot.examText);
  let evidenceName: string | undefined;
  if (spot.grantsEvidenceId && !acquiredEvidenceIds.has(spot.grantsEvidenceId)) {
    acquiredEvidenceIds.add(spot.grantsEvidenceId);
    const evidence = activeCase.evidences.find(
      (entry) => entry.id === spot.grantsEvidenceId,
    );
    evidenceName = evidence?.name ?? spot.grantsEvidenceId;
    appendSceneEntry('증거 확보', evidenceName);
    renderEvidence();
  }
  renderSceneSpots();
  sceneStage?.play({
    type: 'spot-examined',
    spotId,
    evidenceName,
    newlyAvailableSpotIds: examination.newlyAvailableSpotIds,
  });
}

// 막 전환에 따라 패널 표시를 전환한다.
function applyPhaseVisibility(): void {
  const inScene = phase === 'scene';
  gameShell.dataset.phase = phase;
  scenePanel.hidden = !inScene;
  sceneStage?.setActive(inScene);
  if (inScene) suspectTabs.hidden = true;
  const interrogationBlocks = [
    document.querySelector('.suspect-card'),
    psychologyProgress,
    chatLog,
    evidenceSlot,
    starterQuestionsBox,
    questionForm,
  ];
  for (const block of interrogationBlocks) {
    if (block instanceof HTMLElement) block.hidden = inScene;
  }
  if (inScene && activeCase.scene) {
    sceneIntro.textContent = activeCase.scene.intro;
    renderSceneSpots();
    window.requestAnimationFrame(() => sceneStage?.refresh());
  }
  phaseToggleButton.hidden =
    !activeCase.scene || !caseOpened || isCaseEnded();
  phaseToggleButton.textContent =
    phase === 'scene' ? '심문으로 돌아가기' : '현장 재조사';
}

function switchPhase(): void {
  if (!caseOpened || isWaiting) return;
  phase = phase === 'scene' ? 'interrogation' : 'scene';
  applyPhaseVisibility();
  renderStatus();
  renderEvidence();
  if (phase === 'interrogation') {
    renderSuspectTabs();
    renderSuspectCard();
    renderPsychologyProgress();
  }
}

// 현장 판단 폼: 사고사·자살·타살 + 근거 증거.
function renderSceneRulingForm(): void {
  reportEyebrow.textContent = '현장 판단';
  reportTitle.textContent = '이 죽음을 분류합니다';
  reportContent.replaceChildren();
  reportSubmit.hidden = false;
  reportSubmit.textContent = '판단 제출';
  reportNote.textContent = '오판하면 사건은 그대로 종결된다.';

  const deathOptions: { id: DeathRulingChoice; label: string }[] = [
    { id: 'accident', label: '사고사 — 넘어지며 책상에 부딪힌 사고로 종결' },
    { id: 'suicide', label: '자살 — 자해로 판단하고 종결' },
    { id: 'homicide', label: '타살 — 살인 사건으로 입건하고 수사를 확대' },
  ];
  const heading = document.createElement('h3');
  heading.className = 'report-heading';
  heading.textContent = '이 죽음은 무엇입니까';
  reportContent.append(
    heading,
    optionRow('death-type', deathOptions, sceneRulingChoice, (id) => {
      sceneRulingChoice = id as DeathRulingChoice;
      reportSubmit.disabled = !sceneRulingReady();
    }),
  );

  const evidenceHeading = document.createElement('h3');
  evidenceHeading.className = 'report-heading';
  evidenceHeading.textContent = '판단의 근거';
  reportContent.append(
    evidenceHeading,
    optionRow(
      'ruling-evidence',
      activeCase.evidences
        .filter((entry) => acquiredEvidenceIds.has(entry.id))
        .map((entry) => ({ id: entry.id, label: entry.name })),
      '',
      (id) => {
        if (sceneRulingEvidenceIds.has(id)) sceneRulingEvidenceIds.delete(id);
        else sceneRulingEvidenceIds.add(id);
        reportSubmit.disabled = !sceneRulingReady();
      },
      true,
    ),
  );
  reportSubmit.disabled = !sceneRulingReady();
}

function sceneRulingReady(): boolean {
  return sceneRulingChoice !== '' && sceneRulingEvidenceIds.size > 0;
}

function renderSceneEnd(): void {
  if (!sceneEnd) return;
  reportEyebrow.textContent = '현장 판단 결과';
  reportTitle.textContent = sceneEnd.title;
  reportContent.replaceChildren();
  reportSubmit.hidden = true;
  reportNote.textContent = '';
  const heading = document.createElement('h3');
  heading.className = 'verdict-title lose';
  heading.textContent = sceneEnd.title;
  const epilogue = document.createElement('p');
  epilogue.className = 'verdict-epilogue';
  epilogue.textContent = sceneEnd.epilogue;
  reportContent.append(heading, epilogue);
}

function submitSceneRuling(): void {
  const scene = activeCase.scene;
  if (!scene || !sceneRulingReady() || sceneRulingChoice === '') return;
  const ruling = judgeSceneRuling(scene, sceneRulingChoice, [
    ...sceneRulingEvidenceIds,
  ]);
  if (ruling.outcome === 'OPENED') {
    caseOpened = true;
    phase = 'interrogation';
    reportDialog.close();
    appendSceneEntry('입건', scene.openingLine);
    session();
    appendMessage('system', scene.openingLine);
    applyPhaseVisibility();
    renderSuspectTabs();
    renderSuspectCard();
    renderStatus();
    renderEvidence();
    return;
  }
  if (ruling.outcome === 'REJECTED') {
    reportNote.textContent = `입건 반려 — 근거가 부족하다. 부족한 고리: ${ruling.missingEvidenceIds
      .map((id) => activeCase.evidences.find((e) => e.id === id)?.name ?? id)
      .join(', ') || '결정적 모순 증거'}`;
    return;
  }
  sceneEnd = {
    title:
      sceneRulingChoice === 'accident'
        ? '사고사 종결 — 오판'
        : '자살 종결 — 오판',
    epilogue: scene.wrongRulingEpilogue,
  };
  renderSceneEnd();
  appendSceneEntry('사건 종결', sceneEnd.title);
  renderSceneSpots();
  renderStatus();
}

// 심문 결과(진술·단계)가 새 증거·새 용의자를 여는지 평가하고 알린다.
function runDiscovery(): void {
  const recordedClaims = new Set<string>();
  const stages = new Map<string, string>();
  for (const [suspectId, entry] of sessions) {
    stages.set(suspectId, entry.contractState.stageId);
    for (const statement of entry.contractState.statements) {
      recordedClaims.add(`${suspectId}:${statement.claimId}`);
    }
  }
  const fired = evaluateUnlocks(activeCase, {
    acquiredEvidenceIds,
    unlockedSuspectIds,
    recordedClaims,
    stages,
  });
  for (const unlock of fired) {
    if (unlock.evidenceId) {
      acquiredEvidenceIds.add(unlock.evidenceId);
      const evidence = activeCase.evidences.find(
        (entry) => entry.id === unlock.evidenceId,
      );
      appendMessage(
        'hint',
        `새 증거 입수 — ${evidence?.name ?? unlock.evidenceId}: ${unlock.notice}`,
      );
    }
    if (unlock.suspectId) {
      unlockedSuspectIds.add(unlock.suspectId);
      const target = getSuspect(activeCase, unlock.suspectId);
      appendMessage('hint', `새 용의자 — ${target.name}: ${unlock.notice}`);
    }
  }
  if (fired.length > 0) {
    renderEvidence();
    renderSuspectTabs();
  }
}

function switchSuspect(suspectId: string): void {
  if (isWaiting || suspectId === activeSuspectId) return;
  if (!unlockedSuspectIds.has(suspectId)) return;
  activeSuspectId = suspectId;
  session();
  slottedEvidence = undefined;
  renderEvidenceSlot();
  renderSuspectCard();
  renderSuspectTabs();
  rebuildChatLog();
  renderStatus();
  renderEvidence();
  renderStatements();
}

// 검증을 통과한 답변만 타자기 효과로 공개한다. 모델 원문을 스트리밍으로
// 바로 노출하면 반려될 답변(날조·누설 후보)을 플레이어가 먼저 읽게 된다.
function revealSuspectAnswer(bubble: HTMLDivElement, content: string): void {
  const revealStartedAt = performance.now();
  const charsPerSecond = 80;
  const step = (): void => {
    const elapsedSeconds = (performance.now() - revealStartedAt) / 1000;
    const index = Math.min(
      content.length,
      Math.ceil(elapsedSeconds * charsPerSecond),
    );
    bubble.textContent = content.slice(0, index);
    chatLog.scrollTop = chatLog.scrollHeight;
    if (index < content.length) {
      window.setTimeout(step, 24);
    } else {
      bubble.classList.remove('streaming');
    }
  };
  bubble.textContent = '';
  step();
}

// 빈 입력창이 부담스러운 플레이어를 위한 시작 질문 제안. 첫 질문을
// 보내면 사라진다. 클릭하면 입력창에 채워질 뿐 자동 제출하지 않는다 —
// 직접 질문을 쓰는 기본 조작을 가르치기 위해서다.
function renderStarterQuestions(): void {
  starterQuestionsBox.replaceChildren();
  const active = session();
  const questions =
    active.history.length === 0
      ? activeSuspect().contract.starterQuestions
      : active.followUpQuestions;
  if (questions.length === 0) {
    starterQuestionsBox.hidden = true;
    return;
  }
  starterQuestionsBox.hidden = false;
  for (const question of questions) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'starter-chip';
    chip.textContent =
      active.history.length === 0 ? question : `번복 추궁 · ${question}`;
    chip.addEventListener('click', () => {
      questionInput.value = question;
      questionInput.focus();
    });
    starterQuestionsBox.append(chip);
  }
}

const psychologyStageCopy: Readonly<
  Record<string, { label: string; cue: string }>
> = {
  ST_CONFESSION: {
    label: '완성된 자백',
    cue: '준비한 문장을 흔들림 없이 되풀이한다.',
  },
  ST_PATCH: {
    label: '임시 해명',
    cue: '객관 기록마다 짧은 설명을 덧대기 시작한다.',
  },
  ST_RIGID: {
    label: '완강한 침묵',
    cue: '답이 짧아지고, 기록보다 자백을 믿어 달라고 한다.',
  },
  ST_DILEMMA: {
    label: '보호자의 딜레마',
    cue: '자백을 지키려면 자신의 삶까지 부정해야 한다.',
  },
  ST_COLLAPSE: {
    label: '자백의 붕괴',
    cue: '운전자가 아니라는 사실은 인정하면서도 이름은 말하지 않는다.',
  },
  ST_SINCERE: {
    label: '진심',
    cue: '처벌을 대신 받는 것보다 진실을 말할 준비를 한다.',
  },
};

function renderPsychologyProgress(): void {
  const definition = psychologyDefinition;
  const state = psychologyState;
  if (!definition || !state || phase === 'scene') {
    psychologyProgress.hidden = true;
    return;
  }

  psychologyProgress.hidden = false;
  const stageCopy = psychologyStageCopy[state.stageId];
  psychologyStage.textContent = stageCopy?.label ?? state.stageId;
  psychologyCue.textContent = stageCopy?.cue ?? '상대의 반응을 관찰한다.';

  contradictionList.replaceChildren();
  if (
    state.confirmedContradictionIds.length === 0 &&
    state.lockedContradictionIds.length === 0
  ) {
    const empty = document.createElement('span');
    empty.className = 'contradiction-chip empty';
    empty.textContent = '확정 모순 0';
    contradictionList.append(empty);
  }
  for (const contradictionId of state.lockedContradictionIds) {
    const rule = definition.contradictions.find(
      (entry) => entry.id === contradictionId,
    );
    const chip = document.createElement('span');
    chip.className = 'contradiction-chip locked';
    chip.textContent = `${contradictionId} · 열쇠 미확보`;
    chip.title = rule?.label ?? '검증 가능한 진술이 고착됨';
    contradictionList.append(chip);
  }
  for (const contradictionId of state.confirmedContradictionIds) {
    const rule = definition.contradictions.find(
      (entry) => entry.id === contradictionId,
    );
    const chip = document.createElement('span');
    chip.className = `contradiction-chip ${rule?.kind.toLocaleLowerCase() ?? ''}`;
    chip.textContent = `${contradictionId} · ${rule?.label ?? '확정 모순'}`;
    contradictionList.append(chip);
  }

  psychologyAction.hidden = false;
  psychologyAction.disabled = isWaiting || isCaseEnded();
  if (state.phase === 'SESSION_ONE') {
    const ready = canStartForensics(definition, state, gameState.turn);
    psychologyAction.disabled ||= !ready;
    psychologyAction.textContent = ready
      ? `감식 ${definition.forensicSelectionCount}개 의뢰`
      : `심문 ${definition.minimumTurnsBeforeForensics}턴 후 감식`;
  } else if (state.phase === 'SESSION_TWO') {
    psychologyAction.textContent = '수사를 마치고 공판으로';
  } else if (state.phase === 'FINALE') {
    psychologyAction.textContent = '마지막 응답 선택';
  } else {
    psychologyAction.textContent = '공판 논증 열기';
  }
}

function applyPsychologyProgress(result: PsychologyProgressResult): void {
  if (!psychologyDefinition) return;
  const previousStageId = psychologyState?.stageId;
  psychologyState = result.state;

  const active = session();
  active.contractState = {
    ...active.contractState,
    stageId: result.state.stageId,
  };

  for (const contradictionId of result.newlyLockedContradictionIds) {
    const rule = psychologyDefinition.contradictions.find(
      (entry) => entry.id === contradictionId,
    );
    const notice =
      rule?.commitment?.notice ??
      '검증 가능한 진술을 확보했지만 확정할 물증이 아직 없다.';
    appendMessage(
      'hint',
      `진술 고착 — ${contradictionId} · 열쇠 미확보\n${notice}`,
    );
  }
  if (result.specialEvent) {
    unlockedNotices.push(result.specialEvent.notice);
    appendMessage('system', `특수 전환 — ${result.specialEvent.notice}`);
  }

  for (const evidenceId of result.unlockedEvidenceIds) {
    const wasAcquired = acquiredEvidenceIds.has(evidenceId);
    acquiredEvidenceIds.add(evidenceId);
    const evidence = activeCase.evidences.find((entry) => entry.id === evidenceId);
    if (!wasAcquired) {
      const automatic = result.automaticEvidenceIds.includes(evidenceId);
      const notice = automatic
        ? `후속 영장 집행 — ${evidence?.name ?? evidenceId}`
        : `논증 확정 — ${evidence?.name ?? evidenceId}`;
      unlockedNotices.push(notice);
      appendMessage('hint', notice);
    }

    // 확정 모순 카드도 계약에 다시 제시해 기존 자백 문장을 모순 처리한다.
    active.contractState = applyEvidencePresentation(
      activeSuspect().contract,
      active.contractState,
      evidenceId,
    ).state;
  }

  if (previousStageId !== result.state.stageId) {
    const stage = psychologyStageCopy[result.state.stageId];
    appendMessage(
      'system',
      `심리 단계 변화 — ${stage?.label ?? result.state.stageId}`,
    );
  }
  renderStatements();
  renderEvidence();
  renderPsychologyProgress();
}

function renderForensicDialog(): void {
  const definition = psychologyDefinition;
  const state = psychologyState;
  if (!definition || !state || state.phase !== 'SESSION_ONE') return;
  forensicContent.replaceChildren();

  const selected = new Set(state.selectedForensicOptionIds);
  const atLimit = selected.size >= definition.forensicSelectionCount;
  const counter = document.createElement('p');
  counter.className = 'forensic-counter';
  counter.textContent = `${selected.size} / ${definition.forensicSelectionCount} 선택`;
  const grid = document.createElement('div');
  grid.className = 'forensic-grid';

  for (const option of definition.forensicOptions) {
    const row = document.createElement('label');
    row.className = `forensic-option${selected.has(option.id) ? ' selected' : ''}`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selected.has(option.id);
    input.disabled = atLimit && !selected.has(option.id);
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = option.label;
    const kind = document.createElement('span');
    kind.className = `forensic-kind ${option.resolution.toLocaleLowerCase()}`;
    kind.textContent =
      option.resolution === 'DIRECT'
        ? '단독 확정'
        : option.resolution === 'COMBINATION'
          ? '조합 확정'
          : '보조 정황';
    const description = document.createElement('small');
    description.textContent = option.description;
    const target = document.createElement('small');
    target.className = 'forensic-impact';
    const targetRule = definition.contradictions.find(
      (entry) => entry.id === option.targetContradictionId,
    );
    target.textContent = option.targetContradictionId
      ? `목표 · ${option.targetContradictionId} ${targetRule?.label ?? ''}`
      : '목표 · 즉시 확정 없음';
    const requirement = document.createElement('small');
    requirement.className = 'forensic-requirement';
    const requiredNames = option.requiredEvidenceIds.map(
      (evidenceId) =>
        activeCase.evidences.find((entry) => entry.id === evidenceId)?.name ??
        evidenceId,
    );
    requirement.textContent =
      requiredNames.length > 0
        ? `필요 조합 · ${requiredNames.join(' + ')}`
        : option.resolution === 'SUPPORT'
          ? '확정 조건 · 단독 모순 없음'
          : '필요 조합 · 기록된 진술';
    const opportunityCost = document.createElement('small');
    opportunityCost.className = 'forensic-cost';
    opportunityCost.textContent = `선택 판단 · ${option.opportunityCost}`;
    copy.append(
      name,
      kind,
      description,
      target,
      requirement,
      opportunityCost,
    );
    input.addEventListener('change', () => {
      if (!psychologyState) return;
      psychologyState = toggleForensicOption(
        definition,
        psychologyState,
        option.id,
      );
      renderForensicDialog();
      renderPsychologyProgress();
    });
    row.append(input, copy);
    grid.append(row);
  }

  forensicContent.append(counter, grid);
  forensicSubmit.disabled =
    selected.size !== definition.forensicSelectionCount;
  forensicNote.textContent = atLimit
    ? '선택 완료. 확정하면 심문 2회차가 시작됩니다.'
    : `앞으로 ${definition.forensicSelectionCount - selected.size}개를 더 고르세요.`;
}

function openForensicDialog(): void {
  const definition = psychologyDefinition;
  const state = psychologyState;
  if (
    !definition ||
    !state ||
    !canStartForensics(definition, state, gameState.turn)
  ) {
    return;
  }
  renderForensicDialog();
  forensicDialog.showModal();
}

function commitForensics(): void {
  const definition = psychologyDefinition;
  if (!definition || !psychologyState) return;
  const result = commitForensicSelection(
    definition,
    psychologyState,
    gameState.turn,
  );
  psychologyState = result.state;
  const names: string[] = [];
  for (const evidenceId of result.evidenceIds) {
    acquiredEvidenceIds.add(evidenceId);
    names.push(
      activeCase.evidences.find((entry) => entry.id === evidenceId)?.name ??
        evidenceId,
    );
  }
  appendMessage('system', `감식 결과 도착 — ${names.join(' · ')}`);
  forensicDialog.close();
  renderEvidence();
  renderStatus();
}

function renderFinaleDialog(): void {
  const definition = psychologyDefinition;
  const state = psychologyState;
  if (!definition || !state || state.phase !== 'FINALE') return;
  finaleContent.replaceChildren();
  const anchor = document.createElement('blockquote');
  anchor.className = 'finale-anchor';
  anchor.textContent = definition.finaleAnchorLine;
  const choices = document.createElement('div');
  choices.className = 'finale-choices';
  for (const choice of definition.finaleChoices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      if (!psychologyState) return;
      const resolution = resolveFinale(definition, psychologyState, choice.id);
      psychologyState = resolution.state;
      session().contractState = {
        ...session().contractState,
        stageId: resolution.state.stageId,
      };
      appendMessage('system', `마지막 선택 — ${choice.label}`);
      appendMessage('suspect', resolution.responseLine);
      session().history.push({
        role: 'assistant',
        content: resolution.responseLine,
      });
      finaleDialog.close();
      renderPsychologyProgress();
      renderStatus();
      openCourtBoard();
    });
    choices.append(button);
  }
  finaleContent.append(anchor, choices);
}

function openFinaleDialog(): void {
  if (psychologyState?.phase !== 'FINALE') return;
  renderFinaleDialog();
  finaleDialog.showModal();
}

function renderStatus(): void {
  renderStarterQuestions();
  renderPsychologyProgress();
  sceneStage?.setBusy(isWaiting);
  turnStatus.textContent =
    phase === 'scene'
      ? '현장 수사'
      : `심문 ${gameState.turn} / ${gameState.maxTurns}${isOvertime(gameState) ? ' · 초과 수사' : ''}`;
  const psychologyLocked =
    psychologyState?.phase === 'FINALE' ||
    psychologyState?.phase === 'COURT';
  const locked = isWaiting || isCaseEnded() || psychologyLocked;
  questionInput.disabled = locked || !canAskQuestion(gameState);
  sendButton.disabled = locked || !canAskQuestion(gameState);
  modelInput.disabled = locked;
  viewerPresent.disabled = locked;
  sendButton.textContent = isWaiting
    ? '답변 중…'
    : isCaseEnded()
      ? '종결됨'
      : '질문';
  // 정답 판정이 있는 사건에서만 종결 버튼을 노출한다.
  reportButton.hidden =
    activeCase.court === undefined &&
    activeCase.motiveOptions.length === 0 &&
    !activeCase.scene;
  reportButton.disabled =
    isWaiting ||
    (activeCase.court !== undefined &&
      psychologyState?.phase === 'SESSION_ONE');
  reportButton.textContent = isCaseEnded()
    ? activeCase.court
      ? '판결 결과'
      : '수사 결과'
    : phase === 'scene'
      ? '현장 판단'
      : activeCase.court
        ? psychologyState?.phase === 'FINALE'
          ? '마지막 응답'
          : '공판 준비'
        : '사건 종결';
  phaseToggleButton.hidden = !activeCase.scene || !caseOpened || isCaseEnded();
  sessionMetrics.textContent = lastLatencyMs
    ? `${(lastLatencyMs / 1000).toFixed(1)}초 · 입력 ${totalInputTokens.toLocaleString()} · 출력 ${totalOutputTokens.toLocaleString()} 토큰${guardRetryCount > 0 ? ` · 정정 ${guardRetryCount}` : ''}`
    : sessionLabel;

  unlockedList.replaceChildren();
  if (unlockedNotices.length === 0) {
    const item = document.createElement('li');
    item.textContent = '아직 없음';
    unlockedList.append(item);
  } else {
    for (const notice of unlockedNotices) {
      const item = document.createElement('li');
      item.textContent = notice;
      unlockedList.append(item);
    }
  }
}

// 진술 패널은 렌더링된 자연어를 재분석하지 않고, 계획자가 선택한
// claim ID에서 직접 생성한다. 대화창·패널·엔진 상태가 같은 세계를 가리킨다.
function renderStatements(): void {
  statementsList.replaceChildren();
  if (session().contractState.statements.length === 0) {
    const item = document.createElement('li');
    item.textContent = '아직 없음';
    statementsList.append(item);
    return;
  }
  for (const statement of session().contractState.statements) {
    const claim = getClaim(activeSuspect().contract, statement.claimId);
    if (!claim) continue;
    const item = document.createElement('li');
    item.textContent = `${statement.turn}턴 · ${claim.meaning}`;
    if (statement.status === 'CONTRADICTED') {
      item.classList.add('contradicted');
      item.textContent += ' (모순)';
    } else if (statement.status === 'REVISED') {
      item.classList.add('revised');
      item.textContent += ' (번복됨)';
    }
    statementsList.append(item);
  }
  statementsList.scrollTop = statementsList.scrollHeight;
}

function stopParkingPlayback(): void {
  if (parkingPlaybackTimer !== undefined) {
    clearInterval(parkingPlaybackTimer);
    parkingPlaybackTimer = undefined;
  }
}

function startParkingPlayback(
  view: Extract<EvidenceView, { type: 'parking' }>,
): void {
  stopParkingPlayback();
  const time = document.querySelector<HTMLSpanElement>('#playback-time');
  const event = document.querySelector<HTMLSpanElement>('#playback-event');
  const car = document.querySelector<HTMLDivElement>('.parking-car');
  if (!time || !event || !car) return;

  let frameIndex = 0;
  const renderFrame = (): void => {
    const row = view.rows[frameIndex];
    if (!row) return;
    time.textContent = `${view.date} ${row.time}`;
    event.textContent = `${row.action} 감지 · ${row.lane}`;
    car.dataset.direction = row.action;
    car.classList.remove('playing');
    void car.offsetWidth;
    car.classList.add('playing');
    frameIndex = (frameIndex + 1) % view.rows.length;
  };

  renderFrame();
  parkingPlaybackTimer = setInterval(renderFrame, 1900);
}

function renderEvidenceView(view: EvidenceView): void {
  stopParkingPlayback();

  if (view.type === 'parking') {
    const rows = view.rows
      .map(
        (row) => `
          <tr>
            <td>${row.time}</td>
            <td><span class="record-action">${row.action}</span></td>
            <td>${row.lane}</td>
            <td>${row.confidence}</td>
          </tr>`,
      )
      .join('');
    viewerContent.innerHTML = `
      <section class="cctv-frame" aria-label="주차장 CCTV 재생 화면">
        <div class="cctv-overlay">
          <span class="recording-dot">● REC</span>
          <span>${view.camera}</span>
        </div>
        <div class="parking-lane">
          <span class="lane-mark lane-mark-one"></span>
          <span class="lane-mark lane-mark-two"></span>
          <div class="parking-car" aria-hidden="true">
            <span></span><i></i><i></i>
          </div>
          <div class="barrier" aria-hidden="true"></div>
        </div>
        <div class="cctv-caption">
          <span id="playback-time"></span>
          <strong id="playback-event"></strong>
        </div>
      </section>
      <section class="record-sheet">
        <div class="record-heading">
          <div>
            <span>차량번호</span><strong>${view.vehicle}</strong>
          </div>
          <div>
            <span>등록자</span><strong>${view.owner}</strong>
          </div>
        </div>
        <table>
          <thead><tr><th>인식 시각</th><th>구분</th><th>차로</th><th>인식률</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="record-footnote">LPR 자동 인식 원본 · 관리자 수정 이력 없음</p>
      </section>`;
    startParkingPlayback(view);
    return;
  }

  if (view.type === 'document') {
    const fields = view.fields
      .map(
        (field) => `
          <div class="report-field">
            <dt>${field.label}</dt><dd>${field.value}</dd>
          </div>`,
      )
      .join('');
    viewerContent.innerHTML = `
      <article class="forensic-report">
        <div class="report-mark">${view.title ?? '법의학 감정서'}</div>
        <p class="report-organization">${view.organization}</p>
        <p class="report-number">문서번호 ${view.documentNumber}</p>
        <dl>${fields}</dl>
        <p class="report-note">${view.note}</p>
        <div class="report-stamp" aria-hidden="true">감정<br>완료</div>
      </article>`;
    return;
  }

  viewerContent.innerHTML = `
    <figure class="scene-photo">
      <div class="desk-scene" aria-label="책상 위 커피잔 두 개를 촬영한 현장 사진">
        <div class="case-marker">7</div>
        <div class="coffee-cup cup-one"><span></span></div>
        <div class="coffee-cup cup-two"><span class="lipstick-mark"></span></div>
        <div class="photo-scale">0&nbsp;&nbsp;&nbsp;5&nbsp;&nbsp;&nbsp;10 cm</div>
      </div>
      <figcaption>
        <strong>${view.location}</strong>
        <span>${view.capturedAt}</span>
        <p>${view.caption}</p>
      </figcaption>
    </figure>`;
}

function openEvidence(evidence: Evidence): void {
  selectedEvidence = evidence;
  viewerTitle.textContent = evidence.name;
  viewerPresent.disabled =
    isWaiting ||
    isCaseEnded() ||
    phase === 'scene' ||
    psychologyState?.phase === 'FINALE' ||
    psychologyState?.phase === 'COURT';
  renderEvidenceView(evidence.view);
  evidenceDialog.showModal();
}

// 증거를 탁자에 올린다. 전환·반응은 일어나지 않는다 — 플레이어가 직접
// 추궁 문장을 보내는 순간 증거가 작동한다.
function handlePresentEvidence(evidence: Evidence): void {
  if (
    isCaseEnded() ||
    isWaiting ||
    phase === 'scene' ||
    psychologyState?.phase === 'FINALE' ||
    psychologyState?.phase === 'COURT'
  ) {
    return;
  }
  slottedEvidence = slottedEvidence?.id === evidence.id ? undefined : evidence;
  renderEvidenceSlot();
  renderEvidence();
  questionInput.focus();
}

function renderEvidenceSlot(): void {
  evidenceSlot.replaceChildren();
  if (!slottedEvidence) {
    evidenceSlot.hidden = true;
    questionInput.placeholder = `${activeSuspect().name}에게 질문한다…`;
    return;
  }
  evidenceSlot.hidden = false;
  const label = document.createElement('span');
  label.textContent = `탁자 위 증거 — ${slottedEvidence.name}`;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'slot-clear';
  clear.textContent = '×';
  clear.setAttribute('aria-label', '증거 내리기');
  clear.addEventListener('click', () => {
    slottedEvidence = undefined;
    renderEvidenceSlot();
    renderEvidence();
  });
  evidenceSlot.append(label, clear);
  questionInput.placeholder = `${slottedEvidence.name}을(를) 들이밀며 추궁한다…`;
}

function renderEvidence(): void {
  evidenceList.replaceChildren();
  for (const evidence of activeCase.evidences) {
    if (!acquiredEvidenceIds.has(evidence.id)) continue;
    const card = document.createElement('article');
    card.className = 'evidence-card';

    const title = document.createElement('h3');
    title.textContent = evidence.name;
    const description = document.createElement('p');
    description.textContent = evidence.description;
    const actions = document.createElement('div');
    actions.className = 'evidence-actions';
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'view-button';
    viewButton.textContent = '열람';
    viewButton.addEventListener('click', () => openEvidence(evidence));

    const presentButton = document.createElement('button');
    presentButton.type = 'button';
    presentButton.disabled =
      isWaiting ||
      isCaseEnded() ||
      psychologyState?.phase === 'FINALE' ||
      psychologyState?.phase === 'COURT';
    presentButton.textContent =
      slottedEvidence?.id === evidence.id
        ? '내려놓기'
        : session().presentedEvidenceIds.includes(evidence.id)
          ? '다시 제시'
          : '제시';
    if (slottedEvidence?.id === evidence.id) {
      presentButton.classList.add('slotted');
    }
    presentButton.addEventListener('click', () => handlePresentEvidence(evidence));
    actions.append(viewButton, presentButton);

    const probe = psychologyDefinition?.probes.find(
      (entry) => entry.evidenceId === evidence.id,
    );
    if (
      probe &&
      psychologyState &&
      (psychologyState.phase === 'SESSION_ONE' ||
        psychologyState.phase === 'SESSION_TWO')
    ) {
      const probeButton = document.createElement('button');
      probeButton.type = 'button';
      probeButton.className = 'probe-button';
      const used = psychologyState.usedProbeIds.includes(probe.id);
      probeButton.textContent = used ? '떠보기 완료' : '떠보기';
      probeButton.disabled = isWaiting || used || isCaseEnded();
      probeButton.addEventListener('click', () => useProbe(probe.id));
      actions.append(probeButton);
    }

    card.append(title, description, actions);
    evidenceList.append(card);
  }
}

function useProbe(probeId: string): void {
  const definition = psychologyDefinition;
  const state = psychologyState;
  if (
    !definition ||
    !state ||
    isWaiting ||
    isCaseEnded() ||
    !canAskQuestion(gameState)
  ) {
    return;
  }

  const probe = definition.probes.find((entry) => entry.id === probeId);
  if (!probe || state.usedProbeIds.includes(probe.id)) return;
  const active = session();
  const result = resolveProbe(
    definition,
    state,
    probe.id,
    active.contractState.statements.map((statement) => statement.claimId),
  );
  appendMessage('detective', probe.question);
  active.history.push({ role: 'user', content: probe.question });
  appendMessage('suspect', result.reactionLine);
  active.history.push({ role: 'assistant', content: result.reactionLine });
  if (!active.presentedEvidenceIds.includes(probe.evidenceId)) {
    active.presentedEvidenceIds.push(probe.evidenceId);
  }
  gameState = recordCompletedTurn(gameState);
  applyPsychologyProgress(result);
  renderStatus();
  renderEvidence();
}

// ── 최종 보고서 ────────────────────────────────────────────────
// 자백이 아니라 증거 사슬로 사건을 끝낸다. 진범이 끝까지 부인해도
// 올바른 증거를 모으면 유죄가 나오고, 진범을 놓아주면 그 자리에서 패배한다.

interface CourtArgumentOption {
  key: string;
  argument: CourtArgument;
  label: string;
}

function courtArgumentOptions(): CourtArgumentOption[] {
  const court = activeCase.court;
  if (!court) return [];
  const confirmed = new Set(
    psychologyState?.confirmedContradictionIds ?? [],
  );
  const options = new Map<string, CourtArgumentOption>();
  for (const issue of court.issues) {
    for (const accepted of issue.acceptedArguments) {
      if (!confirmed.has(accepted.contradictionId)) continue;
      if (
        !accepted.requiredEvidenceIds.every((id) =>
          acquiredEvidenceIds.has(id),
        )
      ) {
        continue;
      }
      const argument: CourtArgument = {
        issueId: '',
        contradictionId: accepted.contradictionId,
        evidenceIds: [...accepted.requiredEvidenceIds],
      };
      const key = JSON.stringify({
        contradictionId: argument.contradictionId,
        evidenceIds: argument.evidenceIds,
      });
      if (options.has(key)) continue;
      const contradiction = psychologyDefinition?.contradictions.find(
        (entry) => entry.id === accepted.contradictionId,
      );
      const evidenceNames = accepted.requiredEvidenceIds.map(
        (id) => activeCase.evidences.find((entry) => entry.id === id)?.name ?? id,
      );
      options.set(key, {
        key,
        argument,
        label: `${accepted.contradictionId} · ${contradiction?.label ?? '확정 모순'} → ${evidenceNames.join(' + ')}`,
      });
    }
  }
  return [...options.values()];
}

function courtReady(): boolean {
  const court = activeCase.court;
  if (!court || courtCandidateId === '') return false;
  return (
    courtCandidateId === court.noProsecutionCandidateId ||
    courtChargeId !== ''
  );
}

function createCourtIssueBoard(): HTMLElement {
  const court = activeCase.court;
  const board = document.createElement('div');
  board.className = 'court-issues';
  if (!court) return board;
  const argumentOptions = courtArgumentOptions();

  for (const issue of court.issues) {
    const card = document.createElement('section');
    card.className = `court-issue ${issue.kind.toLocaleLowerCase()}`;
    const label = document.createElement('label');
    const title = document.createElement('strong');
    title.textContent = issue.label;
    const description = document.createElement('small');
    description.textContent = issue.description;
    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = argumentOptions.length
      ? '확정 사실을 배치하세요'
      : '사용할 수 있는 확정 사실이 없습니다';
    select.append(empty);
    for (const option of argumentOptions) {
      const element = document.createElement('option');
      element.value = option.key;
      element.textContent = option.label;
      select.append(element);
    }
    select.value = courtArgumentSelections.get(issue.id) ?? '';
    select.disabled = argumentOptions.length === 0;
    select.addEventListener('change', () => {
      if (select.value) courtArgumentSelections.set(issue.id, select.value);
      else courtArgumentSelections.delete(issue.id);
    });
    label.append(title, description, select);
    card.append(label);
    board.append(card);
  }
  return board;
}

function renderCourtForm(): void {
  const court = activeCase.court;
  if (!court) return;
  reportEyebrow.textContent = '핵심 공판 · 최종 논고';
  reportTitle.textContent = '자백보다 강한 논증을 만드세요';
  reportContent.replaceChildren();
  reportSubmit.hidden = false;
  reportSubmit.textContent = '최종 논고 제출';
  reportNote.textContent =
    '확보한 사실만 법정에서 쓸 수 있습니다. 법률 적용은 게임적으로 각색됐습니다.';

  const intro = document.createElement('p');
  intro.className = 'court-intro';
  intro.textContent =
    '기소 대상과 죄명을 정한 뒤, 세 쟁점에 확정 사실을 하나씩 배치하세요. 같은 모순도 쟁점에 따라 요구되는 뒷받침 증거가 다릅니다.';
  reportContent.append(intro);

  const candidateHeading = document.createElement('h3');
  candidateHeading.className = 'report-heading';
  candidateHeading.textContent = '누구를 기소합니까';
  const candidateOptions = optionRow(
    'court-candidate',
    court.candidates.map((entry) => ({
      id: entry.id,
      label: `${entry.label} · ${entry.description}`,
    })),
    courtCandidateId,
    (id) => {
      courtCandidateId = id;
      reportSubmit.disabled = !courtReady();
    },
  );
  candidateOptions.setAttribute('role', 'radiogroup');
  candidateOptions.setAttribute('aria-label', '기소 대상');
  reportContent.append(candidateHeading, candidateOptions);

  const chargeHeading = document.createElement('h3');
  chargeHeading.className = 'report-heading';
  chargeHeading.textContent = '어떤 죄명으로 공소를 구성합니까';
  const chargeOptions = optionRow(
    'court-charge',
    court.charges.map((entry) => ({
      id: entry.id,
      label: `${entry.label} · ${entry.description}`,
    })),
    courtChargeId,
    (id) => {
      courtChargeId = id;
      reportSubmit.disabled = !courtReady();
    },
  );
  chargeOptions.setAttribute('role', 'radiogroup');
  chargeOptions.setAttribute('aria-label', '적용 죄명');
  reportContent.append(chargeHeading, chargeOptions);

  const issuesHeading = document.createElement('h3');
  issuesHeading.className = 'report-heading';
  issuesHeading.textContent = `공판 쟁점 ${court.issues.length}개`;
  reportContent.append(issuesHeading, createCourtIssueBoard());
  reportSubmit.disabled = !courtReady();
}

function renderCourtVerdict(result: CourtVerdict): void {
  const court = activeCase.court;
  reportEyebrow.textContent = '판결';
  reportTitle.textContent = result.copy.title;
  reportContent.replaceChildren();
  reportSubmit.hidden = true;
  reportNote.textContent = '사건이 종결됐습니다.';

  const heading = document.createElement('h3');
  heading.className = `verdict-title ${result.win ? 'win' : 'lose'}`;
  heading.textContent = result.copy.title;
  const summary = document.createElement('p');
  summary.className = 'verdict-line';
  summary.textContent = result.copy.summary;
  reportContent.append(heading, summary);

  if (court && result.satisfiedIssueIds.length > 0) {
    const issueHeading = document.createElement('h3');
    issueHeading.className = 'report-heading';
    issueHeading.textContent = '재판부가 받아들인 쟁점';
    const list = document.createElement('ul');
    list.className = 'court-result-list';
    for (const issueId of result.satisfiedIssueIds) {
      const item = document.createElement('li');
      item.textContent =
        court.issues.find((entry) => entry.id === issueId)?.label ?? issueId;
      list.append(item);
    }
    reportContent.append(issueHeading, list);
  }
  if (result.rejectedArgumentIndexes.length > 0) {
    const rejected = document.createElement('p');
    rejected.className = 'verdict-line court-rejected';
    rejected.textContent = `쟁점과 맞지 않아 배척된 논거 ${result.rejectedArgumentIndexes.length}개`;
    reportContent.append(rejected);
  }

  const epilogueHeading = document.createElement('h3');
  epilogueHeading.className = 'report-heading';
  epilogueHeading.textContent = '그 후';
  const epilogue = document.createElement('p');
  epilogue.className = 'verdict-epilogue';
  epilogue.textContent = result.copy.epilogue;
  reportContent.append(epilogueHeading, epilogue);
}

function openCourtBoard(): void {
  const court = activeCase.court;
  if (!court || isWaiting) return;
  if (psychologyState?.phase === 'SESSION_ONE') {
    appendMessage('hint', '감식 결과를 확정한 뒤 공판 논증을 시작할 수 있다.');
    return;
  }
  if (courtVerdict) {
    renderCourtVerdict(courtVerdict);
  } else if (psychologyState?.phase === 'FINALE') {
    openFinaleDialog();
    return;
  } else {
    renderCourtForm();
  }
  if (!reportDialog.open) reportDialog.showModal();
  renderStatus();
}

function submitCourt(): void {
  const court = activeCase.court;
  if (!court || !courtReady() || isWaiting || isCaseEnded()) return;
  if (psychologyDefinition && psychologyState) {
    if (psychologyState.phase === 'SESSION_TWO') {
      psychologyState = enterCourt(psychologyDefinition, psychologyState);
    }
    if (psychologyState.phase !== 'COURT') return;
  }
  const optionMap = new Map(
    courtArgumentOptions().map((option) => [option.key, option]),
  );
  const argumentsForCourt: CourtArgument[] = [];
  for (const issue of court.issues) {
    const key = courtArgumentSelections.get(issue.id);
    const selected = key ? optionMap.get(key) : undefined;
    if (!selected) continue;
    argumentsForCourt.push({
      ...selected.argument,
      issueId: issue.id,
    });
  }
  courtVerdict = judgeCourt(
    court,
    {
      candidateId: courtCandidateId,
      chargeId: courtChargeId || undefined,
      arguments: argumentsForCourt,
    },
    {
      confirmedContradictionIds:
        psychologyState?.confirmedContradictionIds ?? [],
      acquiredEvidenceIds: [...acquiredEvidenceIds],
      sincerity: psychologyState?.sincerity ?? false,
    },
  );
  renderCourtVerdict(courtVerdict);
  appendMessage('system', `판결 — ${courtVerdict.copy.title}`);
  renderStatus();
  renderEvidence();
  renderSuspectCard();
}

function reportReady(): boolean {
  return (
    reportChoice.accusedId !== '' &&
    reportChoice.motiveId !== '' &&
    reportChoice.methodId !== '' &&
    reportEvidenceIds.size > 0
  );
}

function optionRow(
  groupName: string,
  options: readonly { id: string; label: string }[],
  selectedId: string,
  onPick: (id: string) => void,
  multi = false,
): HTMLDivElement {
  const box = document.createElement('div');
  box.className = 'report-options';
  for (const option of options) {
    const row = document.createElement('label');
    row.className = 'report-option';
    const input = document.createElement('input');
    input.type = multi ? 'checkbox' : 'radio';
    input.name = groupName;
    input.value = option.id;
    input.checked = multi
      ? reportEvidenceIds.has(option.id)
      : selectedId === option.id;
    input.addEventListener('change', () => onPick(option.id));
    const text = document.createElement('span');
    text.textContent = option.label;
    row.append(input, text);
    box.append(row);
  }
  return box;
}

function renderReportForm(): void {
  reportEyebrow.textContent = '최종 수사 보고서';
  reportTitle.textContent = '사건을 종결합니다';
  reportContent.replaceChildren();
  reportSubmit.hidden = false;
  reportNote.textContent = '자백이 아니라 증거가 사건을 끝냅니다.';

  const sections: [string, HTMLElement][] = [
    [
      '범인은 누구입니까',
      optionRow(
        'culprit',
        activeCase.suspects
          .filter((entry) => unlockedSuspectIds.has(entry.id))
          .map((entry) => ({
            id: entry.id,
            label: `${entry.name} · ${entry.role}`,
          })),
        reportChoice.accusedId,
        (id) => {
          reportChoice = { ...reportChoice, accusedId: id };
          reportSubmit.disabled = !reportReady();
        },
      ),
    ],
    [
      '범행 동기는 무엇입니까',
      optionRow(
        'motive',
        activeCase.motiveOptions,
        reportChoice.motiveId,
        (id) => {
          reportChoice = { ...reportChoice, motiveId: id };
          reportSubmit.disabled = !reportReady();
        },
      ),
    ],
    [
      '범행 수법은 무엇입니까',
      optionRow(
        'method',
        activeCase.methodOptions,
        reportChoice.methodId,
        (id) => {
          reportChoice = { ...reportChoice, methodId: id };
          reportSubmit.disabled = !reportReady();
        },
      ),
    ],
    [
      '이를 입증하는 핵심 증거',
      optionRow(
        'evidence',
        activeCase.evidences
          .filter((entry) => acquiredEvidenceIds.has(entry.id))
          .map((entry) => ({
            id: entry.id,
            label: entry.name,
          })),
        '',
        (id) => {
          if (reportEvidenceIds.has(id)) reportEvidenceIds.delete(id);
          else reportEvidenceIds.add(id);
          reportSubmit.disabled = !reportReady();
        },
        true,
      ),
    ],
  ];

  for (const [title, element] of sections) {
    const heading = document.createElement('h3');
    heading.className = 'report-heading';
    heading.textContent = title;
    reportContent.append(heading, element);
  }
  reportSubmit.disabled = !reportReady();
}

const outcomeCopy: Record<
  VerdictResult['outcome'],
  { title: string; tone: string }
> = {
  CONVICTED: { title: '유죄 — 사건 해결', tone: 'win' },
  INSUFFICIENT_EVIDENCE: { title: '증거 불충분 — 기소 실패', tone: 'lose' },
  WRONG_SUSPECT: { title: '오인 기소 — 진범을 놓쳤다', tone: 'lose' },
  CULPRIT_RELEASED: { title: '진범 방면 — 사건 종결 실패', tone: 'lose' },
};

function renderVerdict(result: VerdictResult): void {
  reportEyebrow.textContent = '판결';
  reportTitle.textContent = outcomeCopy[result.outcome].title;
  reportContent.replaceChildren();
  reportSubmit.hidden = true;
  reportNote.textContent = '';

  const copy = outcomeCopy[result.outcome];
  const heading = document.createElement('h3');
  heading.className = `verdict-title ${copy.tone}`;
  heading.textContent = copy.title;
  reportContent.append(heading);

  const lines: string[] = [];
  if (result.outcome === 'CONVICTED') {
    lines.push(
      `증명 사슬 충족: ${(result.matchedChain ?? [])
        .map((id) => activeCase.evidences.find((e) => e.id === id)?.name ?? id)
        .join(' + ')}`,
    );
    lines.push(
      `동기 판단 ${result.correctMotive ? '정확' : '부정확'} · 수법 판단 ${
        result.correctMethod ? '정확' : '부정확'
      }`,
    );
  } else if (result.outcome === 'INSUFFICIENT_EVIDENCE') {
    lines.push(
      '지목한 인물은 맞지만 제출한 증거만으로는 범행을 입증할 수 없다.',
    );
    if (result.missingEvidenceIds.length > 0) {
      lines.push(
        `빠진 고리: ${result.missingEvidenceIds
          .map(
            (id) => activeCase.evidences.find((e) => e.id === id)?.name ?? id,
          )
          .join(', ')}`,
      );
    }
  } else if (result.outcome === 'WRONG_SUSPECT') {
    lines.push(
      `재판 결과: ${lastAccusedName || '피고인'}은(는) 이 사건의 범인이 아니다 — 무죄.`,
    );
    lines.push('무고한 사람을 기소했고, 진범은 끝내 법정에 서지 않았다.');
  } else {
    lines.push('용의선상에서 제외한 인물이 이 사건의 진범이었다.');
  }
  lines.push(`심문 ${gameState.turn}턴 사용${isOvertime(gameState) ? ' (초과 수사)' : ''}`);

  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.className = 'verdict-line';
    paragraph.textContent = line;
    reportContent.append(paragraph);
  }

  const epilogueHeading = document.createElement('h3');
  epilogueHeading.className = 'report-heading';
  epilogueHeading.textContent = '사건의 진상';
  const epilogue = document.createElement('p');
  epilogue.className = 'verdict-epilogue';
  epilogue.textContent = activeCase.solution.epilogue;
  reportContent.append(epilogueHeading, epilogue);
}

function closeCase(result: VerdictResult): void {
  verdict = result;
  renderVerdict(result);
  if (!reportDialog.open) reportDialog.showModal();
  appendMessage(
    'system',
    `사건 종결 — ${outcomeCopy[result.outcome].title}`,
  );
  renderStatus();
  renderEvidence();
  renderSuspectCard();
  renderSuspectTabs();
}

function releaseSuspect(suspectId: string): void {
  if (isCaseEnded() || isWaiting) return;
  const target = getSuspect(activeCase, suspectId);
  releasedSuspectIds.add(suspectId);
  appendMessage('system', `${target.name}을(를) 용의선상에서 제외했다.`);
  const released = judgeRelease(activeCase, suspectId);
  if (released) {
    closeCase(released);
    return;
  }
  renderSuspectTabs();
  renderSuspectCard();
  renderStatus();
}

releaseButton.addEventListener('click', () => {
  releaseSuspect(activeSuspectId);
});

indictButton.addEventListener('click', () => {
  if (isCaseEnded() || isWaiting) return;
  const current = activeSuspect();
  if (activeCase.court) {
    courtCandidateId = current.id;
    openCourtBoard();
    return;
  }
  reportChoice = { ...reportChoice, accusedId: current.id };
  renderReportForm();
  reportNote.textContent = `${current.name}을(를) 재판에 넘깁니다. 동기·수법·증거를 갖춰 기소하세요.`;
  reportDialog.showModal();
});

reportButton.addEventListener('click', () => {
  if (isWaiting) return;
  if (activeCase.court) {
    openCourtBoard();
    return;
  }
  if (verdict) renderVerdict(verdict);
  else if (sceneEnd) renderSceneEnd();
  else if (phase === 'scene') renderSceneRulingForm();
  else renderReportForm();
  reportDialog.showModal();
});

phaseToggleButton.addEventListener('click', () => switchPhase());
sceneAudioButton.addEventListener('click', () => {
  sceneAudioEnabled = !sceneAudioEnabled;
  sceneAudioButton.setAttribute('aria-pressed', String(sceneAudioEnabled));
  sceneAudioButton.textContent = sceneAudioEnabled
    ? '환경음 끄기'
    : '환경음 켜기';
  sceneStage?.setAudioEnabled(sceneAudioEnabled);
});
reportClose.addEventListener('click', () => reportDialog.close());
reportDialog.addEventListener('click', (event) => {
  if (event.target === reportDialog) reportDialog.close();
});
reportSubmit.addEventListener('click', () => {
  if (isCaseEnded() || isWaiting) return;
  if (activeCase.court) {
    submitCourt();
    return;
  }
  if (phase === 'scene' && !caseOpened) {
    submitSceneRuling();
    return;
  }
  if (!reportReady()) return;
  lastAccusedName = getSuspect(activeCase, reportChoice.accusedId).name;
  closeCase(
    judgeReport(activeCase, {
      accusedId: reportChoice.accusedId,
      motiveId: reportChoice.motiveId,
      methodId: reportChoice.methodId,
      evidenceIds: [...reportEvidenceIds],
    }),
  );
});

questionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (
    !question ||
    isWaiting ||
    isCaseEnded() ||
    phase === 'scene' ||
    psychologyState?.phase === 'FINALE' ||
    psychologyState?.phase === 'COURT' ||
    !canAskQuestion(gameState)
  ) {
    return;
  }

  const active = session();
  active.followUpQuestions = active.followUpQuestions.filter(
    (entry) => entry !== question,
  );
  const confrontEvidence = slottedEvidence;
  slottedEvidence = undefined;
  renderEvidenceSlot();

  if (confrontEvidence) {
    appendMessage('system', `증거 제시 — ${confrontEvidence.name}`);
    if (!active.presentedEvidenceIds.includes(confrontEvidence.id)) {
      active.presentedEvidenceIds.push(confrontEvidence.id);
    }
  }
  appendMessage('detective', question);
  active.history.push({ role: 'user', content: question });
  questionInput.value = '';
  isWaiting = true;
  renderStatus();
  renderEvidence();
  renderSuspectTabs();

  const startedAt = performance.now();

  // 계약 전환과 심리 판정을 모두 먼저 계산한다. 저작된 특수 사건이 있으면
  // 일반 계약 앵커나 LLM보다 우선한다.
  let contractReaction: string | undefined;
  let confrontationImpact: PsychologyProgressResult['impact'] | undefined;
  if (confrontEvidence) {
    const outcome = applyEvidencePresentation(
      activeSuspect().contract,
      active.contractState,
      confrontEvidence.id,
    );
    // 전환이 없어도 모순 처리된 진술과 제시 기록은 반드시 보존한다.
    active.contractState = outcome.state;
    if (outcome.transition) {
      unlockedNotices.push(outcome.transition.unlockNotice);
      active.stalledTurns = 0;
      contractReaction = outcome.transition.reactionLine;
      // 앵커 대사가 없는 계약(프로토타입)은 새 단계에서 LLM이 답한다.
      renderStatements();
      runDiscovery();
    }

    if (
      psychologyDefinition &&
      psychologyState &&
      (psychologyState.phase === 'SESSION_ONE' ||
        psychologyState.phase === 'SESSION_TWO')
    ) {
      const progress = resolveConfrontation(
        psychologyDefinition,
        psychologyState,
        {
          presentedEvidenceId: confrontEvidence.id,
          recordedClaimIds: active.contractState.statements.map(
            (statement) => statement.claimId,
          ),
        },
      );
      confrontationImpact = progress.impact;
      applyPsychologyProgress(progress);
      if (progress.specialEvent) {
        gameState = recordCompletedTurn(gameState);
        const specialClaims = progress.specialEvent.recordClaimIds ?? [];
        active.contractState = commitStatements(
          activeSuspect().contract,
          active.contractState,
          specialClaims,
          gameState.turn,
        ).state;
        const reaction = progress.specialEvent.reactionLine;
        const bubble = appendMessage('suspect', '', false);
        bubble.classList.add('streaming');
        active.history.push({ role: 'assistant', content: reaction });
        active.messages.push({ kind: 'suspect', content: reaction });
        renderStatements();
        runDiscovery();
        lastLatencyMs = performance.now() - startedAt;
        isWaiting = false;
        renderStatus();
        renderEvidence();
        renderSuspectTabs();
        revealSuspectAnswer(bubble, reaction);
        questionInput.focus();
        return;
      }
    }

    if (contractReaction) {
      gameState = recordCompletedTurn(gameState);
      const bubble = appendMessage('suspect', '', false);
      bubble.classList.add('streaming');
      active.history.push({ role: 'assistant', content: contractReaction });
      active.messages.push({ kind: 'suspect', content: contractReaction });
      renderStatements();
      runDiscovery();
      lastLatencyMs = performance.now() - startedAt;
      isWaiting = false;
      renderStatus();
      renderEvidence();
      renderSuspectTabs();
      revealSuspectAnswer(bubble, contractReaction);
      questionInput.focus();
      return;
    }
  }

  const responseBubble = appendMessage('suspect', '', false);
  responseBubble.classList.add('streaming');

  try {
    const model = modelInput.value.trim() || defaultModel;
    const current = activeSuspect();
    const result = await runSuspectTurn({
      provider,
      model,
      contract: current.contract,
      state: active.contractState,
      suspect: {
        name: current.name,
        role: current.role,
        persona: current.persona,
      },
      question,
      recentTurns: active.history.slice(-6, -1),
      presentedEvidence: confrontEvidence
        ? {
            id: confrontEvidence.id,
            name: confrontEvidence.name,
            description: confrontEvidence.description,
          }
        : undefined,
      lastCounterQuestion: active.lastCounterQuestion,
      onDiscard: (violations) => {
        guardRetryCount += 1;
        responseBubble.textContent =
          current.contract.language === 'en'
            ? `(${current.name} pauses, choosing words.)`
            : `(${current.name}가 잠시 말을 고른다.)`;
        console.warn('[렌더러] 대사 폐기', violations);
      },
    });
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    active.lastCounterQuestion = result.plan.counterQuestion;
    if (result.plan.usedFallback) {
      console.warn('[계획자] 결정론적 기본 계획 사용', result.plan);
    }
    if (result.usedLineFallback) {
      console.warn('[렌더러] 고정 대사 사용', { line: result.line });
    }

    // 커밋: 검증에 성공한 경우에만 상태와 진술을 함께 반영한다.
    active.history.push({ role: 'assistant', content: result.line });
    active.messages.push({ kind: 'suspect', content: result.line });
    gameState = recordCompletedTurn(gameState);
    const statementCountBefore = active.contractState.statements.length;
    const statementOutcome = commitStatements(
      current.contract,
      active.contractState,
      result.plan.claimIds,
      gameState.turn,
    );
    active.contractState = statementOutcome.state;
    for (const revision of statementOutcome.revisions) {
      appendMessage(
        'system',
        `진술 번복 — ${revision.topicLabel} · ${revision.previousTurn}턴 진술과 ${revision.nextTurn}턴 진술이 충돌한다.`,
      );
      if (
        revision.followUpQuestion &&
        !active.followUpQuestions.includes(revision.followUpQuestion)
      ) {
        active.followUpQuestions.push(revision.followUpQuestion);
        appendMessage(
          'hint',
          `전용 추궁 해금 — ${revision.followUpQuestion}`,
        );
      }
    }
    if (
      psychologyDefinition &&
      psychologyState &&
      (psychologyState.phase === 'SESSION_ONE' ||
        psychologyState.phase === 'SESSION_TWO')
    ) {
      const commitmentProgress = resolveStatementCommitments(
        psychologyDefinition,
        psychologyState,
        result.plan.claimIds,
        active.contractState.statements.map((statement) => statement.claimId),
      );
      if (commitmentProgress.impact === 'COMMITMENT_LOCKED') {
        confrontationImpact = 'COMMITMENT_LOCKED';
      }
      applyPsychologyProgress(commitmentProgress);
    }
    renderStatements();
    runDiscovery();
    lastLatencyMs = performance.now() - startedAt;
    revealSuspectAnswer(responseBubble, result.line);
    if (
      confrontEvidence &&
      (confrontationImpact === undefined ||
        confrontationImpact === 'NO_EFFECT')
    ) {
      appendMessage(
        'system',
        psychologyDefinition
          ? '효과 없음 — 이 증거는 현재 고착된 진술과 직접 연결되지 않았다.'
          : '이 증거로는 진술이 흔들리지 않았다.',
      );
    }

    // 정체 감지: 새 진술이 2턴 연속 없으면 수사 노트 힌트를 보여준다.
    if (active.contractState.statements.length > statementCountBefore) {
      active.stalledTurns = 0;
    } else {
      active.stalledTurns += 1;
      if (active.stalledTurns >= 2) {
        const hint = selectHint(
          current.contract,
          active.contractState,
          active.presentedEvidenceIds,
          active.shownHintIds,
        );
        if (hint) {
          active.shownHintIds.push(hint.id);
          active.stalledTurns = 0;
          appendMessage('hint', `수사 노트 — ${hint.text}`);
        }
      }
    }
  } catch (error) {
    responseBubble.remove();
    active.history.pop();
    const detail = error instanceof Error ? error.message : String(error);
    appendMessage(
      'error',
      isOpenAiDesktop
        ? `OpenAI API 호출에 실패했다: ${detail}`
        : `로컬 모델에 연결하지 못했다: ${detail}. Ollama 실행 상태를 확인해줘.`,
    );
  } finally {
    isWaiting = false;
    renderStatus();
    renderEvidence();
    renderSuspectTabs();
    questionInput.focus();
  }
});

questionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    questionForm.requestSubmit();
  }
});

resetButton.addEventListener('click', () => window.location.reload());
psychologyAction.addEventListener('click', () => {
  if (psychologyState?.phase === 'SESSION_ONE') openForensicDialog();
  else if (psychologyState?.phase === 'FINALE') openFinaleDialog();
  else openCourtBoard();
});
forensicSubmit.addEventListener('click', commitForensics);
forensicClose.addEventListener('click', () => forensicDialog.close());
forensicDialog.addEventListener('click', (event) => {
  if (event.target === forensicDialog) forensicDialog.close();
});
finaleClose.addEventListener('click', () => finaleDialog.close());
finaleDialog.addEventListener('click', (event) => {
  if (event.target === finaleDialog) finaleDialog.close();
});
viewerClose.addEventListener('click', () => evidenceDialog.close());
viewerPresent.addEventListener('click', () => {
  if (!selectedEvidence || isWaiting) return;
  handlePresentEvidence(selectedEvidence);
  evidenceDialog.close();
});
evidenceDialog.addEventListener('close', stopParkingPlayback);
evidenceDialog.addEventListener('click', (event) => {
  if (event.target === evidenceDialog) evidenceDialog.close();
});
window.addEventListener(
  'beforeunload',
  () => {
    sceneStageDisposed = true;
    sceneStage?.destroy();
  },
  { once: true },
);

renderSuspectCard();
renderSuspectTabs();
rebuildChatLog();
applyPhaseVisibility();
renderEvidence();
renderStatus();
renderStatements();
