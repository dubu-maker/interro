import type { DossierDefinition } from '../../engine/dossier';
import theaterEvidenceContactSheet from './assets/theater-evidence-contact-sheet.jpg';

export const case3Dossier: DossierDefinition = {
  title: '백야극장 추락 사고 수사기록',
  caseNumber: 'BY-2026-0719',
  officialTheory: '무대 승강기 안전장치 오작동 추정 사고',
  openAtStart: true,
  forensicSlotCount: 4,
  initialDocumentIds: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
  initialRequestIds: ['RQ_PHONE'],
  documents: [
    {
      id: 'D1',
      group: 'INITIAL',
      kind: 'OFFICIAL_REPORT',
      title: '초동 보고서',
      documentNumber: 'BY-INC-0719-01',
      organization: '서울백야경찰서 강력1팀',
      pages: [
        {
          id: 'D1-P1',
          label: '사건 개요',
          blocks: [
            {
              type: 'paragraph',
              id: 'D1-OFFICIAL',
              tone: 'lead',
              text: '무대 승강기 안전장치 오작동 추정 사고.',
              quoteId: 'Q_D1_OFFICIAL',
            },
            {
              type: 'fields',
              id: 'D1-FIELDS',
              rows: [
                {
                  id: 'D1-DATE',
                  label: '발생',
                  value: '토요일 22:17 · 소극장 백야',
                },
                {
                  id: 'D1-VICTIM',
                  label: '사망자',
                  value: '서혜진(44) · 예술감독',
                },
                {
                  id: 'D1-SCENE',
                  label: '현장',
                  value: '암전 중 무대 승강기 개구부 아래로 추락',
                },
                {
                  id: 'D1-PRESENT',
                  label: '잔류자',
                  value: '장미래 · 윤하늘 · 이규태',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D1-FIRST-RESPONSE',
              text: '22:17 장미래가 112에 신고했다. 구조대 도착 당시 승강기 바닥은 지하 1층 정위치에 정지해 있었다.',
            },
            {
              type: 'paragraph',
              id: 'D1-2014',
              text: '유사 사고 이력 1건 (2014 · 배우 진입 착오에 의한 단순 과실 결론)',
              quoteId: 'Q_D1_2014',
              discoveryId: 'FD_2014_REFERENCE',
            },
          ],
        },
      ],
    },
    {
      id: 'D2',
      group: 'INITIAL',
      kind: 'PHOTO_SET',
      title: '현장 사진 5매',
      documentNumber: 'BY-PHOTO-01~05',
      organization: '서울백야경찰서 현장감식팀',
      pages: [
        {
          id: 'D2-P1',
          label: '사진철',
          blocks: [
            {
              type: 'photo',
              id: 'D2-CONTACT-SHEET',
              assetPath: theaterEvidenceContactSheet,
              alt: '무대 부감, 승강기 개구부, 제어판, 조명 조정실, 객석에서 본 무대를 촬영한 현장 사진 다섯 장',
              caption:
                '① 무대 부감 · ② 승강기 개구부 · ③ 제어판 · ④ 조명 조정실 · ⑤ 객석 방향',
              hotspots: [
                {
                  id: 'D2-HOTSPOT-INDICATOR',
                  label: '사진 ③ 제어판의 작은 표시등',
                  rect: { x: 79.5, y: 8.5, width: 8, height: 17 },
                  discoveryId: 'FD_MANUAL_INDICATOR',
                },
                {
                  id: 'D2-HOTSPOT-SPEAKER',
                  label: '사진 ④ 프레임 가장자리의 스피커',
                  rect: { x: 34, y: 58, width: 14, height: 31 },
                  discoveryId: 'FD_TAPED_SPEAKER',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'D3',
      group: 'INITIAL',
      kind: 'HANDWRITTEN_STATEMENT',
      title: '3인 최초 진술서',
      documentNumber: 'BY-STMT-01~03',
      organization: '서울백야경찰서 강력1팀',
      pages: [
        {
          id: 'D3-MIRAE',
          label: '장미래',
          blocks: [
            {
              type: 'paragraph',
              id: 'D3-MIRAE-INTRO',
              tone: 'note',
              text: '진술인 장미래 · 무대감독 · 사고 직후 신고자',
            },
            {
              type: 'paragraph',
              id: 'D3-M-CUE',
              text: '리허설 큐는 평소와 같았습니다.',
              quoteId: 'Q_M_CUE_NORMAL',
            },
            {
              type: 'paragraph',
              id: 'D3-M-LOCATION',
              text: '저는 암전 전후 내내 조명 조정실에 있었습니다.',
              quoteId: 'Q_M_IN_CONTROL_ROOM',
            },
            {
              type: 'paragraph',
              id: 'D3-M-SENSOR',
              text: '승강기 센서가 오작동한 사고로 생각합니다.',
              quoteId: 'Q_M_SENSOR_FAULT',
            },
          ],
        },
        {
          id: 'D3-HANEUL',
          label: '윤하늘',
          blocks: [
            {
              type: 'paragraph',
              id: 'D3-HANEUL-INTRO',
              tone: 'note',
              text: '진술인 윤하늘 · 언더스터디 배우',
            },
            {
              type: 'paragraph',
              id: 'D3-H-LOCATION',
              text: '제 장면이 끝난 뒤 분장실로 갔고 사고 때도 그곳에 있었습니다.',
              quoteId: 'Q_H_DRESSING_ROOM',
            },
            {
              type: 'paragraph',
              id: 'D3-H-CONTACT',
              text: '사고 전 서혜진 감독과 별다른 대화를 하지 않았습니다.',
              quoteId: 'Q_H_NO_ARGUMENT',
            },
          ],
        },
        {
          id: 'D3-GYUTAE',
          label: '이규태',
          blocks: [
            {
              type: 'paragraph',
              id: 'D3-GYUTAE-INTRO',
              tone: 'note',
              text: '진술인 이규태 · 기술감독',
            },
            {
              type: 'paragraph',
              id: 'D3-G-LOCATION',
              text: '사고 당시 하역장에서 안개 장비를 점검하고 있었습니다.',
              quoteId: 'Q_G_LOADING_DOCK',
            },
            {
              type: 'paragraph',
              id: 'D3-G-WARNING',
              text: '장미래 씨가 경고 시스템을 임의로 막았다는 말을 들었습니다.',
              quoteId: 'Q_G_WARNING',
            },
            {
              type: 'paragraph',
              id: 'D3-G-EQUIPMENT',
              text: '오래된 승강기 설비에서는 충분히 일어날 수 있는 사고입니다.',
              quoteId: 'Q_G_OLD_EQUIPMENT',
            },
          ],
        },
      ],
    },
    {
      id: 'D4',
      group: 'REFERENCE',
      kind: 'FLOOR_PLAN',
      title: '극장 평면도',
      documentNumber: 'BY-FACILITY-B1',
      organization: '소극장 백야 시설관리',
      pages: [
        {
          id: 'D4-P1',
          label: '지하 1층',
          blocks: [
            {
              type: 'floor-plan',
              id: 'D4-PLAN',
              zones: [
                {
                  id: 'D4-AUDIENCE',
                  label: '객석',
                  detail: '무대 정면',
                  x: 8,
                  y: 60,
                  width: 46,
                  height: 30,
                },
                {
                  id: 'D4-STAGE',
                  label: '무대·승강기',
                  detail: '중앙 개구부',
                  x: 8,
                  y: 17,
                  width: 46,
                  height: 34,
                },
                {
                  id: 'D4-CONTROL',
                  label: '조명 조정실',
                  detail: '객석 뒤편',
                  x: 61,
                  y: 67,
                  width: 31,
                  height: 23,
                },
                {
                  id: 'D4-CORRIDOR',
                  label: '서비스 통로',
                  detail: '수동 조작반',
                  x: 61,
                  y: 17,
                  width: 13,
                  height: 39,
                },
                {
                  id: 'D4-LOADING',
                  label: '하역장',
                  detail: '외부 출입구',
                  x: 79,
                  y: 17,
                  width: 13,
                  height: 18,
                },
                {
                  id: 'D4-DRESSING',
                  label: '분장실',
                  detail: '복도 단일 출입',
                  x: 79,
                  y: 40,
                  width: 13,
                  height: 16,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'D5',
      group: 'REFERENCE',
      kind: 'PRINTED_EXCERPT',
      title: '공연 대본 큐 페이지',
      documentNumber: 'BY-SCRIPT-FINAL-73',
      organization: '소극장 백야 제작부',
      pages: [
        {
          id: 'D5-P1',
          label: 'Q71~Q74',
          blocks: [
            {
              type: 'table',
              id: 'D5-CUE-TABLE',
              columns: ['큐', '예정 시각', '내용'],
              rows: [
                {
                  id: 'D5-Q71',
                  cells: ['Q71', '22:16:31', '배우 퇴장'],
                },
                {
                  id: 'D5-Q72',
                  cells: ['Q72', '22:16:39', '무대 중앙 확인'],
                },
                {
                  id: 'D5-Q73',
                  cells: ['Q73', '22:16:50', '암전'],
                  quoteId: 'Q_D5_OFFICIAL_BLACKOUT',
                  discoveryId: 'FD_OFFICIAL_BLACKOUT',
                },
                {
                  id: 'D5-Q74',
                  cells: ['Q74', '22:17:02', '작업등 복구'],
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D5-NOTE',
              tone: 'note',
              text: '최종 승인본 사본 · 수기 수정 없음',
            },
          ],
        },
      ],
    },
    {
      id: 'D6',
      group: 'REFERENCE',
      kind: 'PRINTED_EXCERPT',
      title: '승강기 매뉴얼 발췌',
      documentNumber: 'STL-400 / 8.2',
      organization: '대명무대기계 기술문서',
      pages: [
        {
          id: 'D6-P1',
          label: '제원',
          blocks: [
            {
              type: 'fields',
              id: 'D6-SPECS',
              rows: [
                {
                  id: 'D6-MODEL',
                  label: '기종',
                  value: 'STL-400 공연장 무대 승강기',
                },
                {
                  id: 'D6-CAPACITY',
                  label: '정격',
                  value: '4,000 kg · 0.15 m/s',
                },
                {
                  id: 'D6-INSPECTION',
                  label: '점검',
                  value: '공연 전 일일 점검 · 월간 정밀 점검',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D6-PLAIN',
              text: '정상 운전 중 안전 인터록은 승강기 바닥과 무대면의 높이가 일치할 때만 이동 명령을 허용한다.',
            },
          ],
        },
        {
          id: 'D6-P2',
          label: '비상 해제',
          blocks: [
            {
              type: 'paragraph',
              id: 'D6-KEY-RULE',
              tone: 'plain',
              text: '안전 잠금은 전용 수동 해제 열쇠로만 해제할 수 있다. 열쇠는 태그 기록식 보관함에 보관한다.',
              quoteId: 'Q_D6_KEY_RULE',
              discoveryId: 'FD_MANUAL_KEY_RULE',
            },
            {
              type: 'paragraph',
              id: 'D6-WARNING',
              tone: 'warning',
              text: '비상 해제 작업 전 무대 접근 통제와 경고 방송 상태를 확인할 것.',
            },
          ],
        },
      ],
    },
    {
      id: 'D7',
      group: 'EXAMINATION',
      kind: 'MEDICAL_REPORT',
      title: '검시 예비 소견',
      documentNumber: 'NFS-PRELIM-0719',
      organization: '국립과학수사연구원 서울과학수사연구소',
      pages: [
        {
          id: 'D7-P1',
          label: '예비 소견',
          blocks: [
            {
              type: 'fields',
              id: 'D7-FIELDS',
              rows: [
                {
                  id: 'D7-CAUSE',
                  label: '사인',
                  value: '고소 추락에 의한 다발성 손상',
                },
                {
                  id: 'D7-TIME',
                  label: '추정 시각',
                  value: '22:16~22:18',
                },
                {
                  id: 'D7-TOX',
                  label: '간이 약독물',
                  value: '특이소견 없음',
                },
                {
                  id: 'D7-DEFENSE',
                  label: '방어흔',
                  value: '확인되지 않음',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D7-NOTE',
              text: '본 소견은 현장 기록과 외표 검사에 따른 예비 결과이며 사망 경위에 대한 판단을 포함하지 않는다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D8',
      group: 'RESULT',
      kind: 'LOG',
      title: '무대 설비 제어 로그',
      documentNumber: 'BY-LIFT-221646',
      organization: '소극장 백야 · 무대설비 제어실',
      pages: [
        {
          id: 'D8-P1',
          label: '정밀 분석 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D8-FIELDS',
              rows: [
                {
                  id: 'D8-2242',
                  label: '22:16:42',
                  value: '무대 조명 암전 신호 수신',
                },
                {
                  id: 'D8-2246',
                  label: '22:16:46',
                  value: 'MANUAL INTERLOCK RELEASE',
                },
                {
                  id: 'D8-2247',
                  label: '22:16:47',
                  value: '승강기 하강 시작 · 모터 부하 정상',
                },
                {
                  id: 'D8-2251',
                  label: '22:16:51',
                  value: '지하 1층 정위치 도달',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D8-NOTE',
              tone: 'note',
              text: '기계 고장 코드 없음. 안전 잠금은 수동 해제 명령으로 풀렸다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D9',
      group: 'RESULT',
      kind: 'PRINTED_EXCERPT',
      title: '마지막 리허설 조명 큐시트',
      documentNumber: 'BY-CUE-FINAL-73',
      organization: '소극장 백야 · 조명 조정실',
      pages: [
        {
          id: 'D9-P1',
          label: '회수·대조 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D9-FIELDS',
              rows: [
                {
                  id: 'D9-OFFICIAL',
                  label: '공식 대본',
                  value: 'Q73 암전 · 22:16:50 예정',
                },
                {
                  id: 'D9-RECOVERED',
                  label: '현장 큐시트',
                  value: 'Q73 암전 · 22:16:42로 수기 수정',
                },
                {
                  id: 'D9-INITIALS',
                  label: '승인 표시',
                  value: 'S.H.J. 이니셜 기재',
                },
                {
                  id: 'D9-HANDWRITING',
                  label: '필적 1차',
                  value: '서혜진의 기존 서명과 획순 불일치',
                },
                {
                  id: 'D9-ACCESS',
                  label: '22:01:47',
                  value: '조정실 출입문 · 직원 태그 GT-0049 인증',
                },
                {
                  id: 'D9-OWNER',
                  label: '등록자',
                  value: '이규태 · 기술감독',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D9-NOTE',
              tone: 'note',
              text: '22:02 장미래가 자리를 비운 동안 큐시트가 수정됐다. 해당 구간의 다른 출입 기록은 없다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D10',
      group: 'RESULT',
      kind: 'OFFICIAL_REPORT',
      title: '현장 감식·안전 점검 대조',
      documentNumber: 'BY-SAFE-03',
      organization: '공연장 안전사고 합동감식반',
      pages: [
        {
          id: 'D10-P1',
          label: '대조 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D10-FIELDS',
              rows: [
                {
                  id: 'D10-LOCATION',
                  label: '채증 위치',
                  value: '조명 조정실 하단 승강기 경고 스피커',
                },
                {
                  id: 'D10-ITEM',
                  label: '채증물',
                  value: '검은 무광 테이프 3겹',
                },
                {
                  id: 'D10-AUDIO',
                  label: '음향 상태',
                  value: '경고음 출력 정상 · 외부 전달만 차단',
                },
                {
                  id: 'D10-CHECKLIST',
                  label: '일일 점검표',
                  value: '장미래 서명 · “경고 시스템 이상 없음”',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D10-NOTE',
              tone: 'note',
              text: '경고음 차단은 수동 잠금장치와 전기적으로 연결돼 있지 않다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D11',
      group: 'RESULT',
      kind: 'PRINTED_EXCERPT',
      title: '전송되지 않은 공개 성명',
      documentNumber: 'MOBILE-DRAFT-2157',
      organization: '서혜진 휴대전화 디지털 포렌식',
      pages: [
        {
          id: 'D11-P1',
          label: '복원 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D11-FIELDS',
              rows: [
                {
                  id: 'D11-SAVED',
                  label: '최종 저장',
                  value: '21:57:34',
                },
                {
                  id: 'D11-TITLE',
                  label: '제목',
                  value: '12년 전 백야극장 사고에 관하여',
                },
                {
                  id: 'D11-EXCERPT',
                  label: '본문 일부',
                  value: '“안전장치가 임의로 해제된 사실을 알고도 침묵했습니다.”',
                },
                {
                  id: 'D11-PLANNED',
                  label: '발표 예정',
                  value: '개막 취소 후 일요일 오전 기자회견',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D11-NOTE',
              tone: 'note',
              text: '초안은 전송되지 않았다. 삭제 흔적이나 외부 편집 흔적은 없다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D12',
      group: 'RESULT',
      kind: 'OFFICIAL_REPORT',
      title: '2014년 윤선아 추락 사고 원본철',
      documentNumber: 'BY-2014-ACC-11',
      organization: '소극장 백야 · 자료실 보존 문서',
      pages: [
        {
          id: 'D12-P1',
          label: '원본 대조 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D12-FIELDS',
              rows: [
                {
                  id: 'D12-VICTIM',
                  label: '사망자',
                  value: '윤선아(31), 배우',
                },
                {
                  id: 'D12-FAMILY',
                  label: '유족 기록',
                  value: '딸 윤하늘(당시 15세)',
                },
                {
                  id: 'D12-RELEASE',
                  label: '임시 해제 작업',
                  value: '기술 책임 이규태 서명',
                },
                {
                  id: 'D12-FINAL',
                  label: '최종 보고서',
                  value: '배우 진입 착오로 수정 · 서혜진 서명',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D12-NOTE',
              tone: 'note',
              text: '원본 점검지와 최종 공식 보고서의 사고 원인이 서로 다르다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D13',
      group: 'RESULT',
      kind: 'LOG',
      title: '안전 열쇠 보관함 접근 기록',
      documentNumber: 'KEYSAFE-B2-0719',
      organization: '소극장 백야 · 시설관리 시스템',
      pages: [
        {
          id: 'D13-P1',
          label: '태그 조회 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D13-FIELDS',
              rows: [
                {
                  id: 'D13-AUTH',
                  label: '22:12:08',
                  value: '직원 태그 GT-0049 인증',
                },
                {
                  id: 'D13-OWNER',
                  label: '등록자',
                  value: '이규태 · 기술감독',
                },
                {
                  id: 'D13-OPEN',
                  label: '문 열림',
                  value: '22:12:10~22:12:31',
                },
                {
                  id: 'D13-STOCK',
                  label: '재고 대조',
                  value: '승강기 수동 해제 열쇠 1개 미반납',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D13-NOTE',
              tone: 'note',
              text: '보관함 강제 개방이나 다른 태그 사용 흔적은 없다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D14',
      group: 'RESULT',
      kind: 'OFFICIAL_REPORT',
      title: '저조도 CCTV 복원 분석서',
      documentNumber: 'DF-CAM-L2-1638',
      organization: '경찰청 디지털증거분석실',
      pages: [
        {
          id: 'D14-P1',
          label: '영상 복원 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D14-FIELDS',
              rows: [
                {
                  id: 'D14-CAMERA',
                  label: '카메라',
                  value: '무대 좌측 서비스 통로 CAM-L2',
                },
                {
                  id: 'D14-ENTER',
                  label: '22:16:38',
                  value: '이규태 식별 · 통로 진입',
                },
                {
                  id: 'D14-BLACKOUT',
                  label: '22:16:42',
                  value: '암전 반사광 확인',
                },
                {
                  id: 'D14-EXIT',
                  label: '22:17:04',
                  value: '이규태 통로 이탈',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D14-NOTE',
              tone: 'note',
              text: '사고 뒤 구조하러 진입했다는 설명과 달리 추락 전에 이미 통로 안에 있었다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D15',
      group: 'RESULT',
      kind: 'LOG',
      title: '무대 음향 트랙 추출 분석',
      documentNumber: 'AUDIO-BY-14SEC',
      organization: '경찰청 디지털증거분석실',
      pages: [
        {
          id: 'D15-P1',
          label: '비공개 분석 결과',
          blocks: [
            {
              type: 'paragraph',
              id: 'D15-PRIVATE',
              tone: 'warning',
              text: '수사상 비공개 · 용의자에게 원문 제시 금지 · 떠보기 질문에만 사용',
            },
            {
              type: 'fields',
              id: 'D15-FIELDS',
              rows: [
                {
                  id: 'D15-FIRST',
                  label: '첫 번째 식별음',
                  value: '승강기 구동음',
                },
                {
                  id: 'D15-SECOND',
                  label: '두 번째 식별음',
                  value: '무대 중앙 방향으로 접근하는 발걸음',
                },
                {
                  id: 'D15-THIRD',
                  label: '세 번째 식별음',
                  value: '충돌음·추락음',
                },
                {
                  id: 'D15-SEQUENCE',
                  label: '사건 순서',
                  value: '구동음 → 발걸음 → 추락음',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D15-NOTE',
              tone: 'note',
              text: '수사상 비공개. 용의자에게 원문을 제시하지 않고 사고 전 동선에 관한 떠보기 질문에만 사용한다.',
            },
          ],
        },
      ],
    },
    {
      id: 'D16',
      group: 'RESULT',
      kind: 'OFFICIAL_REPORT',
      title: '분장실 복도 CCTV 연속성 확인',
      documentNumber: 'DF-CAM-DRESS-2215',
      organization: '경찰청 디지털증거분석실',
      pages: [
        {
          id: 'D16-P1',
          label: '영상 복원 결과',
          blocks: [
            {
              type: 'fields',
              id: 'D16-FIELDS',
              rows: [
                {
                  id: 'D16-ENTER',
                  label: '22:15:31',
                  value: '윤하늘 분장실 구역 진입',
                },
                {
                  id: 'D16-NO-EXIT',
                  label: '22:15:31~22:17:20',
                  value: '출입문 추가 개폐 없음',
                },
                {
                  id: 'D16-FALL',
                  label: '22:16:52',
                  value: '무대 추락음 발생 시각',
                },
                {
                  id: 'D16-EXIT',
                  label: '22:17:20',
                  value: '윤하늘 복도로 나옴',
                },
              ],
            },
            {
              type: 'paragraph',
              id: 'D16-NOTE',
              tone: 'note',
              text: '영상은 중단 없는 원본이며 분장실 구역에서 승강기까지 우회 통로가 없다.',
            },
          ],
        },
      ],
    },
  ],
  discoveries: [
    {
      id: 'FD_2014_REFERENCE',
      documentId: 'D1',
      sourceId: 'D1-2014',
      observation: '2014년 같은 극장에서 유사 추락 사고가 한 건 있었다.',
      note: '사고 이력 원문을 보존 자료실에 요청할 수 있다.',
    },
    {
      id: 'FD_MANUAL_INDICATOR',
      documentId: 'D2',
      sourceId: 'D2-HOTSPOT-INDICATOR',
      observation: '사진 속 제어판의 작은 주황 표시등이 켜져 있다.',
      note: '표시등의 의미와 당시 제어 기록을 정밀 분석할 수 있다.',
    },
    {
      id: 'FD_TAPED_SPEAKER',
      documentId: 'D2',
      sourceId: 'D2-HOTSPOT-SPEAKER',
      observation: '조명 조정실 스피커에 검은 테이프가 감겨 있다.',
      note: '당일 안전 점검표와 현물 상태를 대조할 수 있다.',
    },
    {
      id: 'FD_OFFICIAL_BLACKOUT',
      documentId: 'D5',
      sourceId: 'D5-Q73',
      observation: '공식 대본의 암전 예정 시각은 22:16:50이다.',
      note: '현장에서 사용한 조명 조정실 큐시트를 회수할 수 있다.',
    },
    {
      id: 'FD_MANUAL_KEY_RULE',
      documentId: 'D6',
      sourceId: 'D6-KEY-RULE',
      observation:
        '안전 잠금은 수동 해제 열쇠로만 풀리며 열쇠 보관함은 태그 사용을 기록한다.',
      note: '사고 직전 보관함 접근 기록을 조회할 수 있다.',
    },
  ],
  requests: [
    {
      id: 'RQ_LIFT_LOG',
      label: '승강기 제어 로그 정밀 분석',
      description: '제어판 표시등과 승강기 동작 기록의 원본 이벤트를 대조한다.',
      kind: 'FORENSIC',
      slotCost: 1,
      resultDocumentIds: ['D8'],
      resultEvidenceIds: ['E1'],
      resultNotice:
        '22:16:46 승강기에 수동 해제 명령이 입력된 제어 로그가 확인됐다.',
      lockedReason: '제어판에서 분석할 단서를 먼저 찾아야 한다.',
    },
    {
      id: 'RQ_CUE_SHEET',
      label: '조정실 큐시트 회수',
      description: '리허설 때 실제 사용된 큐시트를 공식 대본과 대조한다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: ['D9'],
      resultEvidenceIds: ['E2'],
      resultNotice:
        '현장 큐시트에서 암전 시각의 수기 수정과 위조된 승인 이니셜이 확인됐다.',
      lockedReason: '공식 큐 기준이나 수정 표시의 존재를 먼저 확인해야 한다.',
    },
    {
      id: 'RQ_SAFETY_CHECK',
      label: '안전 점검표 대조 조회',
      description: '경고 스피커 현물과 당일 점검표 기재 내용을 대조한다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: ['D10'],
      resultEvidenceIds: ['E3'],
      resultNotice:
        '검은 테이프로 막힌 경고 스피커와 “이상 없음” 점검표가 한 묶음으로 확보됐다.',
      lockedReason: '조정실 사진에서 대조할 이상 상태를 먼저 찾아야 한다.',
    },
    {
      id: 'RQ_PHONE',
      label: '피해자 휴대전화 포렌식',
      description: '삭제 파일과 전송되지 않은 문서 초안을 추출한다.',
      kind: 'FORENSIC',
      slotCost: 1,
      resultDocumentIds: ['D11'],
      resultEvidenceIds: ['E4'],
      resultNotice:
        '서혜진이 다음 날 12년 전 사고 은폐를 공개하려 한 성명 초안이 복원됐다.',
      lockedReason: '피해자 휴대전화가 확보돼야 한다.',
    },
    {
      id: 'RQ_ARCHIVE',
      label: '2014년 사고 원본 기록 열람',
      description: '보존 자료실의 원본 점검지와 최종 공식 보고서를 대조한다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: ['D12'],
      resultEvidenceIds: ['E5'],
      resultNotice:
        '이규태의 안전장치 임시 해제와 서혜진의 허위 보고서 서명이 확인됐다.',
      lockedReason: '과거 사고의 문서번호나 자료실 관련 진술이 필요하다.',
    },
    {
      id: 'RQ_KEY_LOG',
      label: '안전 열쇠 보관함 태그 조회',
      description: '사고 전후 보관함 접근 태그와 열쇠 재고를 조회한다.',
      kind: 'RECORDS',
      slotCost: 0,
      resultDocumentIds: ['D13'],
      resultEvidenceIds: ['E6'],
      resultNotice:
        '22:12 이규태의 직원 태그로 보관함이 열렸고 수동 열쇠 하나가 사라졌다.',
      lockedReason: '열쇠와 태그 보관함의 존재를 먼저 확인해야 한다.',
    },
    {
      id: 'RQ_CORRIDOR',
      label: '서비스 통로 영상 복원',
      description: '저조도 구간의 인물 윤곽과 출입 시각을 복원한다.',
      kind: 'RESTORATION',
      slotCost: 1,
      resultDocumentIds: ['D14'],
      resultEvidenceIds: ['E7'],
      resultNotice:
        '이규태가 추락 전 수동 조작반이 있는 통로에 들어간 모습이 복원됐다.',
      lockedReason: '열쇠 접근 진술을 먼저 고정해야 복원 우선순위가 생긴다.',
    },
    {
      id: 'RQ_AUDIO',
      label: '무대 음향 트랙 추출',
      description: '암전 구간의 기계음·발소리·충돌음을 시간 순서로 분리한다.',
      kind: 'FORENSIC',
      slotCost: 1,
      resultDocumentIds: ['D15'],
      resultEvidenceIds: ['E8'],
      resultNotice:
        '승강기 구동음, 발걸음, 추락음의 순서가 복원됐다. 이 결과는 비공개 떠보기용이다.',
      lockedReason: '서비스 통로 진입 시각을 먼저 고정해야 한다.',
      privateResult: true,
    },
    {
      id: 'RQ_DRESSING_CCTV',
      label: '분장실 복도 영상 복원',
      description: '끊긴 것처럼 보이는 후반부 프레임의 연속성을 검증한다.',
      kind: 'RESTORATION',
      slotCost: 1,
      resultDocumentIds: ['D16'],
      resultEvidenceIds: ['E9'],
      resultNotice:
        '윤하늘은 추락 전부터 추락 후까지 분장실 구역을 나가지 않은 것으로 확인됐다.',
      lockedReason: '윤하늘의 다툼과 사고 순간 위치를 먼저 대조해야 한다.',
    },
  ],
  quotes: [
    {
      id: 'Q_D1_OFFICIAL',
      documentId: 'D1',
      sourceId: 'D1-OFFICIAL',
      text: '무대 승강기 안전장치 오작동 추정 사고.',
      unmappedReactionLine: '그건 초동 보고서에 적힌 추정일 뿐입니다.',
    },
    {
      id: 'Q_D1_2014',
      documentId: 'D1',
      sourceId: 'D1-2014',
      text: '유사 사고 이력 1건 (2014 · 단순 과실 결론)',
    },
    {
      id: 'Q_M_CUE_NORMAL',
      documentId: 'D3',
      sourceId: 'D3-M-CUE',
      text: '리허설 큐는 평소와 같았습니다.',
      mapping: { suspectId: 'mirae', claimId: 'M_CUE_NORMAL' },
    },
    {
      id: 'Q_M_IN_CONTROL_ROOM',
      documentId: 'D3',
      sourceId: 'D3-M-LOCATION',
      text: '저는 암전 전후 내내 조명 조정실에 있었습니다.',
      mapping: { suspectId: 'mirae', claimId: 'M_IN_CONTROL_ROOM' },
    },
    {
      id: 'Q_M_SENSOR_FAULT',
      documentId: 'D3',
      sourceId: 'D3-M-SENSOR',
      text: '승강기 센서가 오작동한 사고로 생각합니다.',
      mapping: { suspectId: 'mirae', claimId: 'M_SENSOR_FAULT' },
    },
    {
      id: 'Q_H_DRESSING_ROOM',
      documentId: 'D3',
      sourceId: 'D3-H-LOCATION',
      text: '제 장면이 끝난 뒤 분장실로 갔고 사고 때도 그곳에 있었습니다.',
      mapping: { suspectId: 'haneul', claimId: 'H_DRESSING_ROOM' },
    },
    {
      id: 'Q_H_NO_ARGUMENT',
      documentId: 'D3',
      sourceId: 'D3-H-CONTACT',
      text: '사고 전 서혜진 감독과 별다른 대화를 하지 않았습니다.',
      mapping: { suspectId: 'haneul', claimId: 'H_NO_ARGUMENT' },
    },
    {
      id: 'Q_G_LOADING_DOCK',
      documentId: 'D3',
      sourceId: 'D3-G-LOCATION',
      text: '사고 당시 하역장에서 안개 장비를 점검하고 있었습니다.',
      mapping: { suspectId: 'gyutae', claimId: 'G_AT_LOADING_DOCK' },
    },
    {
      id: 'Q_G_WARNING',
      documentId: 'D3',
      sourceId: 'D3-G-WARNING',
      text: '장미래 씨가 경고 시스템을 임의로 막았다는 말을 들었습니다.',
      mapping: { suspectId: 'gyutae', claimId: 'G_BLAMES_WARNING' },
    },
    {
      id: 'Q_G_OLD_EQUIPMENT',
      documentId: 'D3',
      sourceId: 'D3-G-EQUIPMENT',
      text: '오래된 승강기 설비에서는 충분히 일어날 수 있는 사고입니다.',
      mapping: { suspectId: 'gyutae', claimId: 'G_OLD_EQUIPMENT' },
    },
    {
      id: 'Q_D5_OFFICIAL_BLACKOUT',
      documentId: 'D5',
      sourceId: 'D5-Q73',
      text: 'Q73 · 22:16:50 · 암전',
    },
    {
      id: 'Q_D6_KEY_RULE',
      documentId: 'D6',
      sourceId: 'D6-KEY-RULE',
      text: '안전 잠금은 전용 수동 해제 열쇠로만 해제할 수 있다.',
    },
  ],
  unlocks: [
    {
      id: 'DU_LIFT_LOG',
      when: {
        allOf: [
          {
            type: 'discovery-found',
            discoveryId: 'FD_MANUAL_INDICATOR',
          },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_LIFT_LOG' }],
      notice: '제어판 표시등을 근거로 승강기 제어 로그 정밀 분석이 가능해졌다.',
    },
    {
      id: 'DU_SAFETY_CHECK',
      when: {
        allOf: [
          { type: 'discovery-found', discoveryId: 'FD_TAPED_SPEAKER' },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_SAFETY_CHECK' }],
      notice: '조정실 스피커와 당일 안전 점검표를 대조할 수 있다.',
    },
    {
      id: 'DU_CUE_SHEET',
      when: {
        anyOf: [
          {
            type: 'discovery-found',
            discoveryId: 'FD_OFFICIAL_BLACKOUT',
          },
          {
            type: 'claim-recorded',
            suspectId: 'mirae',
            claimId: 'M_CUE_MARK_EXISTED',
          },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_CUE_SHEET' }],
      notice: '공식 대본과 대조할 조정실 현장 큐시트 회수 항목이 열렸다.',
    },
    {
      id: 'DU_ARCHIVE',
      when: {
        anyOf: [
          {
            type: 'discovery-found',
            discoveryId: 'FD_2014_REFERENCE',
          },
          {
            type: 'claim-recorded',
            suspectId: 'haneul',
            claimId: 'H_ARCHIVE_MATERIAL',
          },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_ARCHIVE' }],
      notice: '2014년 사고 원본 기록의 자료실 열람 항목이 열렸다.',
    },
    {
      id: 'DU_KEY_LOG',
      when: {
        allOf: [
          {
            type: 'discovery-found',
            discoveryId: 'FD_MANUAL_KEY_RULE',
          },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_KEY_LOG' }],
      notice: '수동 해제 열쇠 보관함의 태그 기록을 조회할 수 있다.',
    },
    {
      id: 'DU_CORRIDOR',
      when: {
        allOf: [
          { type: 'stage', suspectId: 'gyutae', stageId: 'G_KEY' },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_CORRIDOR' }],
      notice: '이규태의 진술을 근거로 서비스 통로 영상 복원 우선순위가 열렸다.',
    },
    {
      id: 'DU_AUDIO',
      when: {
        allOf: [
          { type: 'stage', suspectId: 'gyutae', stageId: 'G_CORRIDOR' },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_AUDIO' }],
      notice: '사고 전 통로 진입 시각과 대조할 무대 음향 트랙을 추출할 수 있다.',
    },
    {
      id: 'DU_DRESSING_CCTV',
      when: {
        allOf: [
          { type: 'stage', suspectId: 'haneul', stageId: 'H_ARGUMENT' },
        ],
      },
      grants: [{ type: 'request', requestId: 'RQ_DRESSING_CCTV' }],
      notice: '윤하늘의 사고 순간 위치를 검증할 분장실 복도 영상 복원이 가능해졌다.',
    },
  ],
};
