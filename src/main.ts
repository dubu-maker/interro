import './style.css';
import { OllamaProvider } from './ai/ollamaProvider';
import { buildSystemPrompt } from './ai/promptBuilder';
import type { ChatMessage } from './ai/types';
import {
  briefing,
  evidences,
  suspect,
} from './cases/prototype/fixture';
import {
  canAskQuestion,
  createGameState,
  presentEvidence,
  recordCompletedTurn,
} from './engine/gameState';

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

app.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">INTERRO / 기술 검증용 사건</p>
        <h1>이도윤 대표 사망 사건</h1>
      </div>
      <div class="status-row">
        <span id="turn-status"></span>
        <label class="model-field">
          <span>Ollama 모델</span>
          <input id="model-input" value="${defaultModel}" />
        </label>
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
      </aside>
    </div>
  </main>
`;

const chatLog = getElement<HTMLDivElement>('chat-log');
const evidenceList = getElement<HTMLDivElement>('evidence-list');
const questionForm = getElement<HTMLFormElement>('question-form');
const questionInput = getElement<HTMLTextAreaElement>('question-input');
const sendButton = getElement<HTMLButtonElement>('send-button');
const modelInput = getElement<HTMLInputElement>('model-input');
const turnStatus = getElement<HTMLSpanElement>('turn-status');
const unlockedList = getElement<HTMLUListElement>('unlocked-list');

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
  return element as T;
}

function appendMessage(
  kind: 'detective' | 'suspect' | 'system' | 'error',
  content: string,
): void {
  const message = document.createElement('div');
  message.className = `message ${kind}`;
  message.textContent = content;
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderStatus(): void {
  turnStatus.textContent = `심문 ${gameState.turn} / ${gameState.maxTurns}`;
  questionInput.disabled = isWaiting || !canAskQuestion(gameState);
  sendButton.disabled = isWaiting || !canAskQuestion(gameState);
  sendButton.textContent = isWaiting ? '답변 중…' : '질문';

  unlockedList.replaceChildren();
  const unlockedSecrets = suspect.secrets.filter((secret) =>
    gameState.unlockedSecretIds.includes(secret.id),
  );
  if (unlockedSecrets.length === 0) {
    const item = document.createElement('li');
    item.textContent = '아직 없음';
    unlockedList.append(item);
  } else {
    for (const secret of unlockedSecrets) {
      const item = document.createElement('li');
      item.textContent = secret.unlockNotice;
      unlockedList.append(item);
    }
  }
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
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = gameState.presentedEvidenceIds.includes(evidence.id)
      ? '다시 제시'
      : '제시';
    button.addEventListener('click', () => {
      const result = presentEvidence(gameState, suspect, evidence.id);
      gameState = result.state;

      appendMessage('system', `증거 제시: ${evidence.name}`);
      if (result.newlyUnlockedSecretIds.length > 0) {
        appendMessage(
          'system',
          '증거가 기존 진술과 충돌한다. 새로운 사실을 추궁할 수 있다.',
        );
      } else {
        appendMessage('system', '이 증거만으로 새롭게 확인된 사실은 없다.');
      }
      renderEvidence();
      renderStatus();
    });

    card.append(title, description, button);
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

  try {
    const response = await provider.chat({
      systemPrompt: buildSystemPrompt(
        suspect,
        gameState.unlockedSecretIds,
      ),
      messages: history,
      model: modelInput.value.trim() || defaultModel,
    });
    history.push({ role: 'assistant', content: response.content });
    appendMessage('suspect', response.content);
    gameState = recordCompletedTurn(gameState);
  } catch (error) {
    history.pop();
    const detail = error instanceof Error ? error.message : String(error);
    appendMessage(
      'error',
      `로컬 모델에 연결하지 못했다: ${detail}. Ollama 실행 상태를 확인해줘.`,
    );
  } finally {
    isWaiting = false;
    renderStatus();
    questionInput.focus();
  }
});

renderEvidence();
renderStatus();
