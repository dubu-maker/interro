import './style.css';
import { DesktopModelProvider } from './ai/desktopModelProvider';
import { runSuspectTurn } from './ai/interrogationPipeline';
import { OllamaProvider } from './ai/ollamaProvider';
import type { ChatMessage } from './ai/types';
import { case1 } from './cases/case1';
import { case1SceneStageLayout } from './cases/case1/sceneStage';
import {
  prototypeCaseEn,
  prototypeCaseKo,
} from './cases/prototype';
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
  availableSpots,
  createSceneProgress,
  examineSceneSpot,
  judgeSceneRuling,
  type DeathRulingChoice,
  type SceneProgress,
} from './engine/scene';
import {
  applyEvidencePresentation,
  createContractState,
  getClaim,
  recordStatements,
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

// 사건 선택: ?case=case1 → 사건 1 (영어 저작), 그 외에는 프로토타입
// (?lang=en 이면 영어 프로토타입).
const urlParams = new URLSearchParams(window.location.search);
const activeCase =
  urlParams.get('case') === 'case1'
    ? case1
    : urlParams.get('lang') === 'en'
      ? prototypeCaseEn
      : prototypeCaseKo;

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
  return verdict !== undefined || sceneEnd !== undefined;
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

        <div id="chat-log" class="chat-log" aria-live="polite"></div>

        <div id="evidence-slot" class="evidence-slot" hidden></div>

        <div id="starter-questions" class="starter-questions"></div>

        <form id="question-form" class="question-form">
          <textarea
            id="question-input"
            rows="2"
            maxlength="500"
            placeholder="한세라에게 질문한다…"
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

    <dialog id="evidence-dialog" class="evidence-dialog">
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

    <dialog id="report-dialog" class="evidence-dialog">
      <div class="evidence-viewer report-viewer">
        <header class="viewer-header">
          <div>
            <p class="eyebrow">최종 수사 보고서</p>
            <h2>사건을 종결합니다</h2>
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
    activeCase.motiveOptions.length === 0 || isCaseEnded();
  releaseButton.disabled =
    isWaiting || releasedSuspectIds.has(current.id) || isCaseEnded();
  releaseButton.textContent = releasedSuspectIds.has(current.id)
    ? '제외됨'
    : '용의선상 제외';
  // 재판 회부: 이 사람을 범인으로 고정하고 기소한다.
  indictButton.hidden = releaseButton.hidden;
  indictButton.disabled = isWaiting || isCaseEnded();
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
  }
}

// 현장 판단 폼: 사고사·자살·타살 + 근거 증거.
function renderSceneRulingForm(): void {
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
  if (session().history.length > 0) {
    starterQuestionsBox.hidden = true;
    return;
  }
  starterQuestionsBox.hidden = false;
  for (const question of activeSuspect().contract.starterQuestions) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'starter-chip';
    chip.textContent = question;
    chip.addEventListener('click', () => {
      questionInput.value = question;
      questionInput.focus();
    });
    starterQuestionsBox.append(chip);
  }
}

function renderStatus(): void {
  renderStarterQuestions();
  sceneStage?.setBusy(isWaiting);
  turnStatus.textContent =
    phase === 'scene'
      ? '현장 수사'
      : `심문 ${gameState.turn} / ${gameState.maxTurns}${isOvertime(gameState) ? ' · 초과 수사' : ''}`;
  const locked = isWaiting || isCaseEnded();
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
    activeCase.motiveOptions.length === 0 && !activeCase.scene;
  reportButton.textContent = isCaseEnded()
    ? '수사 결과'
    : phase === 'scene'
      ? '현장 판단'
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
        <div class="report-mark">법의학 감정서</div>
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
  viewerPresent.disabled = isWaiting;
  renderEvidenceView(evidence.view);
  evidenceDialog.showModal();
}

// 증거를 탁자에 올린다. 전환·반응은 일어나지 않는다 — 플레이어가 직접
// 추궁 문장을 보내는 순간 증거가 작동한다.
function handlePresentEvidence(evidence: Evidence): void {
  if (isCaseEnded() || isWaiting || phase === 'scene') return;
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
    presentButton.disabled = isWaiting;
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

    card.append(title, description, actions);
    evidenceList.append(card);
  }
}

// ── 최종 보고서 ────────────────────────────────────────────────
// 자백이 아니라 증거 사슬로 사건을 끝낸다. 진범이 끝까지 부인해도
// 올바른 증거를 모으면 유죄가 나오고, 진범을 놓아주면 그 자리에서 패배한다.

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
  reportChoice = { ...reportChoice, accusedId: current.id };
  renderReportForm();
  reportNote.textContent = `${current.name}을(를) 재판에 넘깁니다. 동기·수법·증거를 갖춰 기소하세요.`;
  reportDialog.showModal();
});

reportButton.addEventListener('click', () => {
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
  if (isCaseEnded()) return;
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
  if (!question || isWaiting || isCaseEnded() || phase === 'scene' || !canAskQuestion(gameState)) return;

  const active = session();
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

  // 탁자 위 증거가 방어를 무너뜨리는지 먼저 판정한다 (결정론).
  // 무너뜨리면 저작된 앵커 대사가 플레이어의 추궁에 대한 대답이 된다.
  let confrontTransitioned = false;
  if (confrontEvidence) {
    const outcome = applyEvidencePresentation(
      activeSuspect().contract,
      active.contractState,
      confrontEvidence.id,
    );
    if (outcome.transition) {
      confrontTransitioned = true;
      active.contractState = outcome.state;
      unlockedNotices.push(outcome.transition.unlockNotice);
      active.stalledTurns = 0;
      const reaction = outcome.transition.reactionLine;
      if (reaction) {
        gameState = recordCompletedTurn(gameState);
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
      // 앵커 대사가 없는 계약(프로토타입)은 새 단계에서 LLM이 답한다.
      renderStatements();
      runDiscovery();
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
    active.contractState = recordStatements(
      active.contractState,
      result.plan.claimIds,
      gameState.turn,
    );
    renderStatements();
    runDiscovery();
    lastLatencyMs = performance.now() - startedAt;
    revealSuspectAnswer(responseBubble, result.line);
    if (confrontEvidence && !confrontTransitioned) {
      appendMessage('system', '이 증거로는 진술이 흔들리지 않았다.');
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
