import { contextBridge, ipcRenderer } from 'electron';
import type {
  DesktopModelConfiguration,
  DesktopModelRequest,
  InterroDesktopBridge,
} from '../shared/desktopBridge.js';

const modelChatChannel = 'interro:model:chat';
const modelConfigChannel = 'interro:model:configuration';
const model = ipcRenderer.sendSync(
  modelConfigChannel,
) as DesktopModelConfiguration;

const bridge: InterroDesktopBridge = Object.freeze({
  runtime: 'electron',
  model: Object.freeze(model),
  chat: (request: DesktopModelRequest) =>
    ipcRenderer.invoke(modelChatChannel, request),
});

contextBridge.exposeInMainWorld('interroDesktop', bridge);
