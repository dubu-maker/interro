import type { InterroDesktopBridge } from '../shared/desktopBridge';

declare global {
  interface Window {
    readonly interroDesktop?: InterroDesktopBridge;
  }
}

export {};
