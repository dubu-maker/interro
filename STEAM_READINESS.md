# INTERRO Steam 출시 준비도

기준일: 2026-07-22

## 결론

현재 구조는 Steam 게임의 **코어로 적합하다.** 결정론적 TypeScript 엔진이
상태를 소유하고, `ModelProvider`가 AI 공급자를 격리하며, DOM과 Phaser가
표현만 담당하는 경계는 데스크톱 포장 뒤에도 그대로 유지할 수 있다.

이번 단계에서 Windows x64 실행 폴더를 만드는 안전한 Electron 호스트를
추가했다. 다만 현재 산출물은 **Steam 업로드 형식을 검증하는 로컬
플레이테스트 빌드**다. 저장·복원과 소비자용 AI 운영 경로가 없으므로 아직
출시 후보 빌드는 아니다.

## 현재 상태

| 영역 | 상태 | 판단 |
|---|---|---|
| 게임 코어 | 준비됨 | 결정론 엔진, 비밀 격리, `ModelProvider` 경계를 유지한다. |
| 3D 느낌의 현장 연출 | 준비됨 | Phaser 4의 1인칭 2.5D 현장과 DOM 조사 UI가 함께 동작한다. |
| Windows 실행 폴더 | 1차 준비 | `npm run steam:package`가 `out/INTERRO-win32-x64/`를 만든다. |
| 데스크톱 보안 경계 | 1차 준비 | sandbox, context isolation, CSP, 제한된 IPC, ASAR 무결성 fuse를 적용했다. |
| 프로덕션 AI | 미결정(P0) | Ollama와 개인 OpenAI 키의 로컬 시험 경로만 있다. 둘 다 플레이어에게 전제하면 안 된다. |
| 저장·복원 | 없음(P0) | 세션이 메모리에만 있어 종료하면 진행이 사라진다. |
| Steam Cloud | 대기(P0) | 먼저 버전이 있는 로컬 세이브 파일이 필요하다. |
| 상업 권리 | 확인 필요(P0) | 저작권자 상업 이용 권리와 모든 기여물·자산의 권리를 확인해야 한다. |
| AI·성인 콘텐츠 공개 | 대기(P0) | 사전 생성 이미지, 실시간 생성 대사, 범죄·시신 묘사를 설문에 공개해야 한다. |
| Steamworks API·업적 | 선택(P1) | 출시 필수는 아니다. 기능을 상점에 표시할 때만 실제 구현한다. |
| 코드 서명·아이콘·설정 | 대기(P1) | 공개 베타 전 Windows 서명, `.ico`, 볼륨·모션·화면 설정을 마친다. |

## 이번에 만든 Steam형 데스크톱 경계

- Electron은 로컬 `dist/`만 `interro://app` 사용자 프로토콜로 제공한다.
- renderer에는 Node.js나 임의 IPC를 노출하지 않는다.
- preload는 모델 설정 조회와 `chat()`만 제공하고, main process가 호출 프레임과
  요청 크기·역할·형식·온도를 검증한다. 비밀 키와 환경변수는 공개하지 않는다.
- Ollama 주소는 main process의 고정 loopback 주소다. renderer가 임의 주소를
  요청할 수 없다.
- OpenAI 개발 시험은 main process의 고정 Responses API 주소와
  `gpt-5.6-luna`만 사용한다. 키는 프로세스 환경에서만 읽고 renderer·파일·로그에
  전달하지 않으며, 입력량·출력량·동시 요청·분당 호출·타임아웃을 제한한다.
- 창 이동, 새 창, webview, 권한 요청을 차단한다.
- Electron Forge가 ASAR 패키지와 무결성 검사를 적용한 Windows x64 폴더를
  만든다. SteamPipe에는 설치 프로그램이 아니라 이 폴더 전체를 올린다.
- `steam_appid.txt`는 만들거나 패키징하지 않는다. 이 파일은 Steam API 로컬
  개발 때만 쓰고 Depot에는 포함하지 않는다.

## P0: 출시 전에 반드시 결정할 것

### 1. 소비자용 AI 운영

권장안은 퍼블리셔가 관리하는 HTTPS 백엔드다.

1. 게임은 Steam 인증 티켓 또는 짧은 세션 토큰으로 백엔드에 접속한다.
2. 모델 공급자 비밀 키는 서버에만 보관한다.
3. 서버가 입력·출력 가드레일, 속도 제한, 비용 한도, 감사 로그의 보존 기간을
   관리한다.
4. 서비스 장애·한도 초과 때도 사건을 끝낼 수 있도록 저작된 결정론적 대사
   폴백을 제공한다.
5. 어떤 대화가 외부 서비스로 전송되는지 게임 안과 개인정보 처리방침에
   명확히 알린다.

현재 renderer의 `DesktopModelProvider`는 Electron 경계를 실험하기 위한
구현이다. Ollama와 `qwen2.5:14b` 설치 또는 개발자 OpenAI 키를 일반
플레이어에게 요구하는 상태로 출시하지 않는다. 로컬 OpenAI 시험 경로도
클라이언트에서 키를 완전히 숨기는 출시 해법은 아니다. 로컬 모델 번들을
선택한다면 모델 라이선스, 설치 용량, 최소 VRAM/RAM, 첫 실행 시간과 업데이트
전략을 별도로 검증한다.

### 2. 버전이 있는 결정론적 세이브

DOM이나 Phaser 오브젝트를 저장하지 않는다. 다음 값만 `GameSessionSnapshot`
형태로 직렬화한다.

- `schemaVersion`, 사건 ID, 엔진 버전, 현재 막과 턴
- 현장 조사 진행, 입수한 증거 ID, 열린 용의자 ID
- 용의자별 계약 상태, 기록된 진술 ID, 제시한 증거 ID, 대화 기록
- 제외·기소·현장 판단·최종 보고서 선택과 결말

로드할 때 사건 정의에 존재하는 ID인지 다시 검증하고, 임시 파일에 먼저 쓴 뒤
원자적으로 교체한다. 세이브와 기기별 설정 파일은 분리한다. 이후 작은 세이브
파일만 Steam Auto-Cloud 경로로 지정하고 해상도·창 위치 같은 설정은 Cloud에서
제외한다.

### 3. 권리와 라이선스

현재 공개 저장소는 CC BY-NC 4.0이다. 이 라이선스는 제3자의 상업 이용을
제한하지만 저작권자 본인의 판매까지 금지하지는 않는다. Steam 출시 전에는
다음을 확인한다.

- 모든 코드·사건·대사·이미지·음원에 대한 상업 이용 권리를 보유했는가
- 외부 기여가 있다면 권리 양도 또는 상업 배포 동의를 받았는가
- Steam 구매자에게 적용할 게임 EULA와 공개 소스 라이선스를 어떻게 분리할까
- 생성 이미지의 프롬프트·도구·생성일·원본·해시를 자산 대장에 남겼는가
- `THIRD_PARTY_NOTICES.md`와 Electron이 포함하는 라이선스 파일을 배포하는가

라이선스 변경은 권리 확인 뒤 저작권자가 직접 결정한다.

### 4. Steam Content Survey

INTERRO는 최소한 다음 두 AI 항목을 공개할 가능성이 높다.

- Pre-Generated AI Content: 사건 현장 배경 이미지
- Live-Generated AI Content: 플레이 중 생성되는 용의자 대사

실시간 생성 항목에는 불법 콘텐츠 생성을 막는 가드레일을 구체적으로 설명해야
한다. 범죄, 사망, 시신과 폭력 묘사도 Mature Content 항목에 실제 빌드 기준으로
공개한다. 심사자가 AI 기능과 폴백을 재현할 수 있는 테스트 절차를 함께 준비한다.

## P1: 비공개 Steam 브랜치 전에 할 것

1. Windows 10/11 x64 실기에서 시작·종료·절전 복귀·다중 모니터를 확인한다.
2. Steam 클라이언트에서 Shift+Tab Overlay를 확인한다. GPU 가속을 끄지 않는다.
3. 게임 아이콘과 Windows 코드 서명을 적용한다.
4. 마스터 볼륨, 텍스트 속도, 수동 모션 감소, 전체화면·해상도 설정을 추가하고
   영속화한다.
5. 한국어 UI와 영어 사건 콘텐츠의 지원 언어 표기를 확정한다.
6. 저장 손상, AI 타임아웃, 인터넷 단절, 모델 장애의 복구 UX를 시험한다.
7. 상점에 표시할 기능만 구현한다. 업적·Cloud·컨트롤러 지원을 표시했다면
   리뷰 빌드에서 실제로 동작해야 한다.

## 패키징과 SteamPipe

```powershell
npm ci
npm test
npm run desktop:smoke
npm run steam:package
```

Steamworks의 Windows Launch Option은 `INTERRO.exe`로 둔다. 최신 Steamworks
SDK의 `ContentBuilder`와 `steamcmd`로 `out/INTERRO-win32-x64/` 전체를 Depot에
업로드한다. 예시는 `steam/app_build.vdf.example`에 있다. 업로드 뒤에는
Steamworks의 App Builds 화면에서 비공개 beta branch에 먼저 Set Live 한다.

Steamworks 런타임 API는 출시 필수가 아니다. 업적, 사용자 정보, 직접 Cloud
API가 필요해질 때 `SteamPlatform` 경계와 검증된 네이티브 바인딩을 추가한다.
Steam이 업데이트를 담당하므로 Electron 자동 업데이트는 넣지 않는다.

## 공식 기준

- [Steamworks SDK](https://partner.steamgames.com/doc/sdk)
- [SteamPipe 업로드](https://partner.steamgames.com/doc/sdk/uploading)
- [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- [Steam Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)
- [Steam 리뷰 절차](https://partner.steamgames.com/doc/store/review_process)
- [Electron 배포 개요](https://www.electronjs.org/docs/latest/tutorial/distribution-overview)
- [Electron 보안 체크리스트](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Forge 패키징](https://www.electronforge.io/cli)
