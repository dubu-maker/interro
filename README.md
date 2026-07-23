# INTERRO

용의자가 대본이 아니라 AI라서, 심문이 진짜 심문인 싱글플레이 추리 게임.

사건의 진실과 판정은 결정론적 TypeScript 엔진이 담당하고, 언어 모델은
용의자의 표현만 담당한다. 사건마다 현장 수사·심문·법정 중 필요한 막만
조합하며, 승패와 증거 판정은 모델 답변이 아니라 엔진이 계산한다.

- 프로토타입(심문 코어): `/` 또는 `/?lang=en`
- 사건 1 "니어라이트 대표 사망 사건" (3막 전체): `/?case=case1`
- 사건 2 "23:47 — 완벽한 자백" (심리·법정): `/?case=case2`
- 사건 3 "22:17 — 마지막 리허설" (서류철·3인 자유 심문): `/?case=case3`

## 개발 환경

- Windows 네이티브
- Node.js 24+
- Vite + Vanilla TypeScript
- 로컬 모델: Ollama (`qwen2.5:14b` 기본값)
- 선택적 원격 시험 모델: OpenAI API (`gpt-5.6-luna` 고정)

사건 2의 최종 대사 품질 시험은 `gpt-5.6-luna`를 기준으로 한다. 개발 중
반복 플레이와 오프라인 회귀 확인은 기존 `qwen2.5:14b` 경로를 사용한다.
두 모델 모두 같은 `ModelProvider` 경계와 결정론적 사건 엔진을 거친다.

사건 2의 심문은 팩트 계약 위에 입장 계약을 둔다. 김만철은 확인 가능한
가족·명의·통화 사실을 인정하되, 붕괴 전까지는 자신이 운전자라는 거짓 자백을
스스로 부정할 수 없다. 같은 주제에서 상반된 닫힌 claim이 나오면 진술 번복과
전용 추궁을 결정론적으로 해금한다. 증거 결과는 `확정`, `진술 고착`,
`효과 없음`으로 구분하며, 딸을 실제 운전자와 연결하는 F06은 모순 개수와
무관한 저작 특수 장면으로 처리한다.

사건 3은 3D 현장 대신 심문 중에도 계속 펼쳐 보는 **사건 서류철**로 시작한다.
초동 보고서·현장 사진·최초 진술서·평면도·대본·매뉴얼·검시 소견 7건을
읽으며 사진 핫스팟과 문서 문장으로 감식·기록 조회를 해금한다. 확보한 객관
증거는 기존 심문 슬롯에 놓고, 최초 진술서의 저작된 문장은 질문에 인용할 수
있다. 문서·사진·심문 claim의 해금과 4칸 감식 자원은 모두 결정론적 엔진이
처리하며 모델은 여전히 용의자의 표현만 담당한다.

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

`src/cases/prototype/`의 사건은 기술 검증용이며 본편 사건으로 확정된 내용이 아니다.

## 라이선스

CC BY-NC 4.0 — 출처를 밝히면 비상업적 목적의 복제·수정·배포는 자유지만,
**상업적 이용은 금지**된다. 자세한 내용은 [LICENSE](LICENSE) 참조.
