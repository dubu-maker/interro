import './style.css';
import { OllamaProvider } from './ai/ollamaProvider';
import {
  buildFallbackPlan,
  buildPlannerPrompt,
  parsePlannerResponse,
  type ResponsePlan,
} from './ai/planner';
import {
  buildRendererPrompt,
  composeFallbackLine,
  inspectRenderedLine,
} from './ai/renderer';
import { stripClosingInvites } from './ai/responseGuard';
import type { ChatMessage } from './ai/types';
import { hanSeraContract } from './cases/prototype/contract';
import {
  briefing,
  evidences,
  suspect,
} from './cases/prototype/fixture';
import {
  allowedClaims,
  applyEvidencePresentation,
  createContractState,
  getClaim,
  getStage,
  recordStatements,
} from './engine/contract';
import {
  canAskQuestion,
  createGameState,
  recordCompletedTurn,
} from './engine/gameState';
import type { Evidence, EvidenceView } from './engine/types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app 요소를 찾을 수 없습니다.');

const ollamaBaseUrl =
  import.meta.env.VITE_OLLAMA_BASE_URL ?? '/api/ollama';
const defaultModel =
  import.meta.env.VITE_OLLAMA_MODEL ?? 'qwen2.5:14b';
const provider = new OllamaProvider(ollamaBaseUrl);

let gameState = createGameState(12);
const history: ChatMessage[] = [];
let isWaiting = false;
let totalInputTokens = 0;
let totalOutputTokens = 0;
let lastLatencyMs: number | undefined;
let guardRetryCount = 0;
// 사건 계약 상태. 방어 단계와 claim 단위 진술 기록을 소유한다.
let contractState = createContractState(hanSeraContract);
// 증거 제시로 확정된 새 사실 알림 (전환 순서대로).
const unlockedNotices: string[] = [];
let selectedEvidence: Evidence | undefined;
let parkingPlaybackTimer: ReturnType<typeof setInterval> | undefined;

app.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">INTERRO / 기술 검증용 사건</p>
        <h1>이도윤 대표 사망 사건</h1>
      </div>
      <div class="status-row">
        <div class="session-status">
          <span id="turn-status"></span>
          <span id="session-metrics">로컬 세션</span>
        </div>
        <label class="model-field">
          <span>Ollama 모델</span>
          <input id="model-input" value="${defaultModel}" />
        </label>
        <button id="reset-button" class="reset-button" type="button">새 심문</button>
      </div>
    </header>

    <section class="briefing-panel">
      <h2>사건 브리핑</h2>
      <p>${briefing}</p>
    </section>

    <div class="workspace">
      <section class="interrogation-panel">
        <div class="suspect-card">
          <div class="portrait" aria-hidden="true">한</div>
          <div>
            <p class="eyebrow">심문 대상</p>
            <h2>${suspect.name}</h2>
            <p>${suspect.role}</p>
          </div>
        </div>

        <div id="chat-log" class="chat-log" aria-live="polite">
          <div class="message system">
            한세라가 맞은편 의자에 앉아 손을 모은 채 기다리고 있다.
          </div>
        </div>

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
  </main>
`;

const chatLog = getElement<HTMLDivElement>('chat-log');
const evidenceList = getElement<HTMLDivElement>('evidence-list');
const questionForm = getElement<HTMLFormElement>('question-form');
const questionInput = getElement<HTMLTextAreaElement>('question-input');
const sendButton = getElement<HTMLButtonElement>('send-button');
const modelInput = getElement<HTMLInputElement>('model-input');
const turnStatus = getElement<HTMLSpanElement>('turn-status');
const sessionMetrics = getElement<HTMLSpanElement>('session-metrics');
const unlockedList = getElement<HTMLUListElement>('unlocked-list');
const statementsList = getElement<HTMLUListElement>('statements-list');
const resetButton = getElement<HTMLButtonElement>('reset-button');
const evidenceDialog = getElement<HTMLDialogElement>('evidence-dialog');
const viewerTitle = getElement<HTMLHeadingElement>('viewer-title');
const viewerContent = getElement<HTMLDivElement>('viewer-content');
const viewerClose = getElement<HTMLButtonElement>('viewer-close');
const viewerPresent = getElement<HTMLButtonElement>('viewer-present');

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
  return element as T;
}

function appendMessage(
  kind: 'detective' | 'suspect' | 'system' | 'error',
  content: string,
): HTMLDivElement {
  const message = document.createElement('div');
  message.className = `message ${kind}`;
  message.textContent = content;
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
  return message;
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

function renderStatus(): void {
  turnStatus.textContent = `심문 ${gameState.turn} / ${gameState.maxTurns}`;
  questionInput.disabled = isWaiting || !canAskQuestion(gameState);
  sendButton.disabled = isWaiting || !canAskQuestion(gameState);
  modelInput.disabled = isWaiting;
  viewerPresent.disabled = isWaiting;
  sendButton.textContent = isWaiting ? '답변 중…' : '질문';
  sessionMetrics.textContent = lastLatencyMs
    ? `${(lastLatencyMs / 1000).toFixed(1)}초 · 입력 ${totalInputTokens.toLocaleString()} · 출력 ${totalOutputTokens.toLocaleString()} 토큰${guardRetryCount > 0 ? ` · 정정 ${guardRetryCount}` : ''}`
    : '로컬 세션';

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
  if (contractState.statements.length === 0) {
    const item = document.createElement('li');
    item.textContent = '아직 없음';
    statementsList.append(item);
    return;
  }
  for (const statement of contractState.statements) {
    const claim = getClaim(hanSeraContract, statement.claimId);
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

function handlePresentEvidence(evidence: Evidence): void {
  const outcome = applyEvidencePresentation(
    hanSeraContract,
    contractState,
    evidence.id,
  );
  contractState = outcome.state;
  gameState = {
    ...gameState,
    presentedEvidenceIds: gameState.presentedEvidenceIds.includes(evidence.id)
      ? gameState.presentedEvidenceIds
      : [...gameState.presentedEvidenceIds, evidence.id],
  };

  appendMessage('system', `증거 제시: ${evidence.name}`);
  if (outcome.transition) {
    unlockedNotices.push(outcome.transition.unlockNotice);
    appendMessage(
      'system',
      '증거가 기존 진술과 충돌한다. 새로운 사실을 추궁할 수 있다.',
    );
  } else {
    appendMessage('system', '이 증거만으로 새롭게 확인된 사실은 없다.');
  }
  renderEvidence();
  renderStatus();
  renderStatements();
}

function renderEvidence(): void {
  evidenceList.replaceChildren();
  for (const evidence of evidences) {
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
    presentButton.textContent = gameState.presentedEvidenceIds.includes(evidence.id)
      ? '다시 제시'
      : '제시';
    presentButton.addEventListener('click', () => handlePresentEvidence(evidence));
    actions.append(viewButton, presentButton);

    card.append(title, description, actions);
    evidenceList.append(card);
  }
}

questionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || isWaiting || !canAskQuestion(gameState)) return;

  appendMessage('detective', question);
  history.push({ role: 'user', content: question });
  questionInput.value = '';
  isWaiting = true;
  renderStatus();
  renderEvidence();

  const startedAt = performance.now();
  const responseBubble = appendMessage('suspect', '');
  responseBubble.classList.add('streaming');

  try {
    const model = modelInput.value.trim() || defaultModel;
    const stage = getStage(hanSeraContract, contractState.stageId);
    const candidates = allowedClaims(hanSeraContract, contractState);

    // 1차 호출: 계획자. 후보 중에서 claim ID와 화행만 고른다.
    const plannerPrompt = buildPlannerPrompt(
      stage,
      candidates,
      history.slice(-6, -1),
    );
    let plan: ResponsePlan | undefined;
    for (let attempt = 0; attempt < 2 && !plan; attempt += 1) {
      const planResponse = await provider.chat({
        systemPrompt: plannerPrompt,
        messages: [{ role: 'user', content: question }],
        model,
        format: 'json',
        temperature: 0,
      });
      totalInputTokens += planResponse.inputTokens ?? 0;
      totalOutputTokens += planResponse.outputTokens ?? 0;
      plan = parsePlannerResponse(planResponse.content, candidates);
      if (!plan) {
        console.warn('[계획자] 파싱 실패, 재시도', {
          content: planResponse.content,
        });
      }
    }
    if (!plan) {
      plan = buildFallbackPlan(stage, candidates);
      console.warn('[계획자] 결정론적 기본 계획 사용', plan);
    }
    const approvedMeanings = plan.claimIds
      .map((claimId) => getClaim(hanSeraContract, claimId)?.meaning)
      .filter((meaning): meaning is string => meaning !== undefined);

    // 2차 호출: 렌더러. 승인된 의미만 대사로 표현한다.
    const rendererPrompt = buildRendererPrompt(
      suspect,
      stage.strategy,
      plan,
      approvedMeanings,
    );
    const inspectionInput = {
      approvedMeanings,
      question,
      materialLexicon: hanSeraContract.materialLexicon,
      counterQuestion: plan.counterQuestion,
    };
    let line = '';
    let lineAccepted = false;
    for (let attempt = 0; attempt < 2 && !lineAccepted; attempt += 1) {
      const rendered = await provider.chat({
        systemPrompt:
          attempt === 0
            ? rendererPrompt
            : `${rendererPrompt}\n\n직전 답변은 규칙 위반으로 폐기되었다. 승인된 의미만 다시 표현한다.`,
        messages: [{ role: 'user', content: question }],
        model,
      });
      totalInputTokens += rendered.inputTokens ?? 0;
      totalOutputTokens += rendered.outputTokens ?? 0;
      line = stripClosingInvites(rendered.content);
      const inspection = inspectRenderedLine(line, inspectionInput);
      if (inspection.safe) {
        lineAccepted = true;
      } else {
        guardRetryCount += 1;
        responseBubble.textContent = '(한세라가 잠시 말을 고른다.)';
        console.warn('[렌더러] 대사 폐기', {
          violations: inspection.violations,
          content: rendered.content,
        });
      }
    }
    if (!lineAccepted) {
      line = composeFallbackLine(approvedMeanings);
      console.warn('[렌더러] 고정 대사 사용', { line });
    }

    // 커밋: 검증에 성공한 경우에만 상태와 진술을 함께 반영한다.
    history.push({ role: 'assistant', content: line });
    gameState = recordCompletedTurn(gameState);
    contractState = recordStatements(
      contractState,
      plan.claimIds,
      gameState.turn,
    );
    renderStatements();
    lastLatencyMs = performance.now() - startedAt;
    revealSuspectAnswer(responseBubble, line);
  } catch (error) {
    responseBubble.remove();
    history.pop();
    const detail = error instanceof Error ? error.message : String(error);
    appendMessage(
      'error',
      `로컬 모델에 연결하지 못했다: ${detail}. Ollama 실행 상태를 확인해줘.`,
    );
  } finally {
    isWaiting = false;
    renderStatus();
    renderEvidence();
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

renderEvidence();
renderStatus();
