# INTERRO

용의자가 대본이 아니라 AI라서, 심문이 진짜 심문인 싱글플레이 추리 게임.

사건의 진실과 판정은 결정론적 TypeScript 엔진이 담당하고, 언어 모델은
용의자의 표현만 담당한다. 사건은 현장 수사(1막) → 심문(2막) → 기소·판정
(3막)의 3부 구조로 진행된다.

- 프로토타입(심문 코어): `/` 또는 `/?lang=en`
- 사건 1 "니어라이트 대표 사망 사건" (3막 전체): `/?case=case1`

## 개발 환경

- Windows 네이티브
- Node.js 24+
- Vite + Vanilla TypeScript
- 로컬 모델: Ollama (`qwen2.5:14b` 기본값)

## 실행

```powershell
npm install
npm run dev
```

Ollama가 실행 중이어야 한다. 기본 모델은 다음 명령으로 준비할 수 있다.

```powershell
ollama pull qwen2.5:14b
```

## 검증

```powershell
npm test
npm run build
npm run redteam
```

출력 안전망까지 포함한 결과는 PowerShell에서 다음처럼 측정한다.

```powershell
$env:REDTEAM_GUARDED='1'
npm run redteam
```

레드팀 원본과 요약은 Git에 포함되지 않는 `test-results/`에 저장된다.

`src/cases/prototype/`의 사건은 기술 검증용이며 본편 사건 1로 확정된 내용이 아니다.

## 라이선스

CC BY-NC 4.0 — 출처를 밝히면 비상업적 목적의 복제·수정·배포는 자유지만,
**상업적 이용은 금지**된다. 자세한 내용은 [LICENSE](LICENSE) 참조.
