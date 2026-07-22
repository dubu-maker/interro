# SteamPipe 업로드 메모

`npm run steam:package`가 만든 `out/INTERRO-win32-x64/` 전체가 Windows Depot의
콘텐츠 루트다. 설치 프로그램이나 zip을 Depot에 넣지 않는다.

1. `app_build.vdf.example`을 복사해 실제 AppID와 DepotID를 입력한다.
2. 최신 Steamworks SDK의 `tools/ContentBuilder/builder/steamcmd.exe`를 준비한다.
3. 빌더 권한이 있는 별도 Steam 계정으로 아래 형태의 명령을 실행한다.

```text
steamcmd.exe +login <builder-account> +run_app_build <app-build-vdf의 절대 경로> +quit
```

비밀번호나 Steam Guard 코드를 저장소 파일에 적지 않는다. 업로드 성공 뒤
App Builds에서 비공개 beta branch에 Set Live하고, Launch Option은
`INTERRO.exe`로 지정한다.

`steam_appid.txt`는 Steam API를 로컬 디버깅할 때만 실행 파일 옆에 두는
개발 파일이다. Depot에는 포함하지 않는다.
