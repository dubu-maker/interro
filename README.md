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
- 선택적 원격 시험 모델: OpenAI API (`gpt-5.6-luna` 고정)

## 실행

```powershell
npm install
npm run dev
```

Ollama가 실행 중이어야 한다. 기본 모델은 다음 명령으로 준비할 수 있다.

```powershell
ollama pull qwen2.5:14b
```

### Windows 데스크톱 빌드

현재 데스크톱 빌드는 로컬 플레이테스트용이다. 기존 웹 게임을 Electron의
격리된 화면에서 실행하고, 모델 요청만 검증된 main-process 경계로 보낸다.

```powershell
npm run desktop:start
npm run desktop:smoke
```

### OpenAI API 로컬 시험

PowerShell 7에서 아래 명령을 실행하면 빌드 후 마스킹된 키 입력창이 열린다.
키는 파일·명령 기록·renderer에 저장하지 않고 해당 프로세스가 끝날 때
환경변수에서 지운다. `VITE_OPENAI_API_KEY`나 게임 내 키 입력란은 만들지 않는다.

```powershell
npm run openai:smoke
npm run desktop:openai
```

첫 명령은 짧은 실제 호출로 연결을 확인하고, 둘째 명령은 OpenAI API 세션으로
게임을 실행한다. 모델·출력량·호출 빈도는 Electron main process에서 제한한다.
이 경로는 개발자 개인 키를 쓰는 로컬 시험 전용이다. Steam 출시판에는 키를
포함하지 않고 별도 HTTPS 백엔드를 사용해야 한다.

SteamPipe에 넣을 Windows x64 실행 폴더는 다음 명령으로 만든다.

```powershell
npm run steam:package
```

산출물은 `out/INTERRO-win32-x64/`에 생성된다. 현재 빌드는 별도 Ollama 설치
또는 개발자 OpenAI 키를 요구하므로 소비자용 출시 빌드는 아니다. 저장·복원,
프로덕션 AI 경로, 권리·심사 준비를 포함한 출시 기준은
[STEAM_READINESS.md](STEAM_READINESS.md)를 참고한다.

## 검증

```powershell
npm test
npm run build
npm run desktop:smoke
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
