import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  session,
} from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  DesktopChatMessage,
  DesktopModelRequest,
  DesktopModelResponse,
} from '../shared/desktopBridge.js';
import {
  buildOpenAiResponsesRequest,
  describeOpenAiHttpError,
  openAiResponsesUrl,
  parseOpenAiResponsesPayload,
  resolveDesktopModelConfiguration,
} from './openaiResponses.js';

const appScheme = 'interro';
const appOrigin = `${appScheme}://app`;
const modelChatChannel = 'interro:model:chat';
const modelConfigChannel = 'interro:model:configuration';
const ollamaChatUrl = 'http://127.0.0.1:11434/api/chat';
const isSmokeTest = process.argv.includes('--smoke-test');
const isOpenAiSmokeTest = process.argv.includes('--openai-smoke-test');
const isAnySmokeTest = isSmokeTest || isOpenAiSmokeTest;
const modelConfiguration = resolveDesktopModelConfiguration(process.env);
const openAiRequestStarts: number[] = [];
let openAiRequestActive = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: appScheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);

app.enableSandbox();
app.setName('INTERRO');

let mainWindow: BrowserWindow | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireText(
  record: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${key} 값이 올바르지 않습니다.`);
  }
  if (value.length > maximumLength) {
    throw new Error(`${key} 값이 너무 깁니다.`);
  }
  return value;
}

function parseMessages(value: unknown): DesktopChatMessage[] {
  if (!Array.isArray(value) || value.length > 24) {
    throw new Error('messages 값이 올바르지 않습니다.');
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error('대화 항목이 올바르지 않습니다.');
    }
    const role = entry.role;
    if (role !== 'user' && role !== 'assistant') {
      throw new Error('대화 역할이 올바르지 않습니다.');
    }
    return {
      role,
      content: requireText(entry, 'content', 20_000),
    };
  });
}

function parseModelRequest(value: unknown): DesktopModelRequest {
  if (!isRecord(value)) {
    throw new Error('모델 요청이 올바르지 않습니다.');
  }

  const format = value.format;
  if (format !== undefined && format !== 'json') {
    throw new Error('모델 응답 형식이 올바르지 않습니다.');
  }

  const temperature = value.temperature;
  if (
    temperature !== undefined &&
    (typeof temperature !== 'number' ||
      !Number.isFinite(temperature) ||
      temperature < 0 ||
      temperature > 2)
  ) {
    throw new Error('temperature 값이 올바르지 않습니다.');
  }

  const model = requireText(value, 'model', 200).trim();
  if (!model) throw new Error('model 값이 올바르지 않습니다.');

  const systemPrompt = requireText(value, 'systemPrompt', 100_000);
  const messages = parseMessages(value.messages);
  const totalCharacters =
    systemPrompt.length +
    messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > 120_000) {
    throw new Error('모델 요청의 전체 입력이 너무 깁니다.');
  }

  return {
    systemPrompt,
    messages,
    model,
    ...(format ? { format } : {}),
    ...(temperature === undefined ? {} : { temperature }),
  };
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderFrame = event.senderFrame;
  if (!senderFrame || senderFrame !== event.sender.mainFrame) {
    throw new Error('허용되지 않은 프레임의 요청입니다.');
  }

  const senderUrl = new URL(senderFrame.url);
  if (senderUrl.protocol !== `${appScheme}:` || senderUrl.host !== 'app') {
    throw new Error('허용되지 않은 화면의 요청입니다.');
  }
}

async function requestLocalModel(
  request: DesktopModelRequest,
): Promise<DesktopModelResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await net.fetch(ollamaChatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: request.model,
        stream: false,
        // 데스크톱 로컬 경로도 웹과 동일하게 즉답 모드로 고정한다.
        think: false,
        keep_alive: '10m',
        ...(request.format ? { format: request.format } : {}),
        options: {
          temperature: request.temperature ?? 0.35,
          num_predict: 128,
          repeat_penalty: 1.1,
        },
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages,
        ],
      }),
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`로컬 AI가 잘못된 응답을 반환했습니다. (${response.status})`);
    }
    if (!isRecord(payload)) {
      throw new Error('로컬 AI 응답 형식이 올바르지 않습니다.');
    }

    const error = payload.error;
    if (!response.ok || typeof error === 'string') {
      throw new Error(
        typeof error === 'string'
          ? error
          : `로컬 AI 요청에 실패했습니다. (${response.status})`,
      );
    }

    const message = payload.message;
    const content =
      isRecord(message) && typeof message.content === 'string'
        ? message.content.trim()
        : '';
    if (!content) {
      throw new Error('로컬 AI가 빈 답변을 반환했습니다.');
    }

    return {
      content,
      ...(typeof payload.prompt_eval_count === 'number'
        ? { inputTokens: payload.prompt_eval_count }
        : {}),
      ...(typeof payload.eval_count === 'number'
        ? { outputTokens: payload.eval_count }
        : {}),
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('로컬 AI 응답 시간이 3분을 넘었습니다.');
    }
    if (error instanceof Error) throw error;
    throw new Error('로컬 AI에 연결하지 못했습니다.');
  } finally {
    clearTimeout(timeout);
  }
}

function beginOpenAiRequest(): void {
  if (openAiRequestActive) {
    throw new Error('다른 AI 요청이 끝날 때까지 기다려 주세요.');
  }

  const now = Date.now();
  while (
    openAiRequestStarts.length > 0 &&
    (openAiRequestStarts[0] ?? now) <= now - 60_000
  ) {
    openAiRequestStarts.shift();
  }
  if (openAiRequestStarts.length >= 20) {
    throw new Error('분당 OpenAI 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
  }

  openAiRequestStarts.push(now);
  openAiRequestActive = true;
}

async function requestOpenAiModel(
  request: DesktopModelRequest,
): Promise<DesktopModelResponse> {
  const apiKey = process.env['OPENAI_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  beginOpenAiRequest();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await net.fetch(openAiResponsesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(buildOpenAiResponsesRequest(request)),
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`OpenAI가 잘못된 응답을 반환했습니다. (${response.status})`);
    }
    if (!response.ok) {
      throw new Error(describeOpenAiHttpError(response.status, payload));
    }
    return parseOpenAiResponsesPayload(payload);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('OpenAI 응답 시간이 90초를 넘었습니다.');
    }
    if (error instanceof Error) throw error;
    throw new Error('OpenAI에 연결하지 못했습니다.');
  } finally {
    clearTimeout(timeout);
    openAiRequestActive = false;
  }
}

async function requestConfiguredModel(
  rawRequest: unknown,
): Promise<DesktopModelResponse> {
  const request = parseModelRequest(rawRequest);
  return modelConfiguration.provider === 'openai'
    ? requestOpenAiModel(request)
    : requestLocalModel(request);
}

function registerModelBridge(): void {
  ipcMain.on(modelConfigChannel, (event) => {
    // 공급자 종류와 고정 모델명만 반환하며 자격 증명은 절대 노출하지 않는다.
    event.returnValue = modelConfiguration;
  });
  ipcMain.handle(modelChatChannel, (event, request: unknown) => {
    assertTrustedSender(event);
    return requestConfiguredModel(request);
  });
}

function registerAppProtocol(): void {
  const rendererRoot = path.join(app.getAppPath(), 'dist');

  protocol.handle(appScheme, (request) => {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.host !== 'app') {
        return new Response('Not Found', { status: 404 });
      }

      const relativePath = decodeURIComponent(requestUrl.pathname).replace(
        /^\/+/,
        '',
      );
      const pathToServe = path.resolve(
        rendererRoot,
        relativePath || 'index.html',
      );
      const pathFromRoot = path.relative(rendererRoot, pathToServe);
      const isSafePath =
        pathFromRoot.length > 0 &&
        !pathFromRoot.startsWith('..') &&
        !path.isAbsolute(pathFromRoot);
      if (!isSafePath) {
        return new Response('Bad Request', { status: 400 });
      }

      return net.fetch(pathToFileURL(pathToServe).toString());
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
  });
}

async function verifySmokeTest(window: BrowserWindow): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const ready = await window.webContents.executeJavaScript(
      `window.interroDesktop?.runtime === 'electron' && Boolean(document.querySelector('#game-shell')) && Boolean(document.querySelector('#scene-stage-host canvas'))`,
    );
    if (ready === true) {
      console.log('[데스크톱 스모크] 게임 셸과 Phaser 현장 확인');
      app.exit(0);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.error('[데스크톱 스모크] 게임 화면을 제한 시간 안에 확인하지 못했습니다.');
  app.exit(1);
}

async function verifyOpenAiSmokeTest(window: BrowserWindow): Promise<void> {
  const readyDeadline = Date.now() + 15_000;
  while (Date.now() < readyDeadline) {
    const ready = await window.webContents.executeJavaScript(
      `window.interroDesktop?.model.provider === 'openai' && Boolean(document.querySelector('#question-form')) && Boolean(document.querySelector('#question-input'))`,
    );
    if (ready === true) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const submitted = await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('#question-input');
    const form = document.querySelector('#question-form');
    if (!(input instanceof HTMLTextAreaElement) || !(form instanceof HTMLFormElement)) return false;
    input.value = '그날 밤 어디에 있었습니까?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  if (submitted !== true) {
    console.error('[OpenAI 스모크] 심문 질문을 전송하지 못했습니다.');
    app.exit(1);
    return;
  }

  const answerDeadline = Date.now() + 120_000;
  while (Date.now() < answerDeadline) {
    const snapshot: unknown = await window.webContents.executeJavaScript(`(() => {
      const error = [...document.querySelectorAll('.message.error')].at(-1)?.textContent?.trim() ?? '';
      const answer = [...document.querySelectorAll('.message.suspect:not(.streaming)')].at(-1)?.textContent?.trim() ?? '';
      const metrics = document.querySelector('#session-metrics')?.textContent?.trim() ?? '';
      return { error, answer, metrics };
    })()`);
    if (isRecord(snapshot)) {
      const error = typeof snapshot['error'] === 'string' ? snapshot['error'] : '';
      const answer = typeof snapshot['answer'] === 'string' ? snapshot['answer'] : '';
      const metrics = typeof snapshot['metrics'] === 'string' ? snapshot['metrics'] : '';
      if (error) {
        console.error('[OpenAI 스모크] 실패', error);
        app.exit(1);
        return;
      }
      if (answer) {
        console.log('[OpenAI 스모크] 승인 대사', answer);
        console.log('[OpenAI 스모크] 측정', metrics);
        app.exit(0);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.error('[OpenAI 스모크] 2분 안에 승인 대사를 받지 못했습니다.');
  app.exit(1);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#090d14',
    webPreferences: {
      preload: path.join(
        app.getAppPath(),
        'dist-electron',
        'electron',
        'preload.cjs',
      ),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(`${appOrigin}/`)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription) => {
      console.error('[데스크톱] 화면 로드 실패', errorCode, errorDescription);
      if (isAnySmokeTest) app.exit(1);
    },
  );
  window.once('ready-to-show', () => {
    if (!isAnySmokeTest) window.show();
  });
  window.webContents.once('did-finish-load', () => {
    if (isOpenAiSmokeTest) void verifyOpenAiSmokeTest(window);
    else if (isSmokeTest) void verifySmokeTest(window);
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined;
  });

  void window.loadURL(
    isOpenAiSmokeTest
      ? `${appOrigin}/index.html?lang=ko`
      : `${appOrigin}/index.html?case=case1`,
  );
  return window;
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.dubumaker.interro');
  registerAppProtocol();
  registerModelBridge();
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  mainWindow = createWindow();

  app.on('activate', () => {
    mainWindow ??= createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => {
  ipcMain.removeHandler(modelChatChannel);
  ipcMain.removeAllListeners(modelConfigChannel);
  void protocol.unhandle(appScheme);
});
