import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 컴파일 전에 고정된 빌드 산출물만 지운다. tsconfig에서 제외된 오래된
// 테스트 파일이 dist-electron에 남아 Steam 패키지에 섞이는 일을 막는다.
const desktopBuildDirectory = fileURLToPath(
  new URL('../dist-electron/', import.meta.url),
);

await rm(desktopBuildDirectory, { recursive: true, force: true });
