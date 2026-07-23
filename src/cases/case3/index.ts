import type { CaseDefinition } from '../../engine/case';
import type { Evidence } from '../../engine/types';
import {
  jangMiraeContract,
  leeGyutaeContract,
  yoonHaneulContract,
} from './contracts';
import { case3Dossier } from './dossier';

const evidences: Evidence[] = [
  {
    id: 'E1',
    name: '무대 승강기 제어 로그',
    description:
      '22:16:46 수동 해제 명령이 입력됐고 승강기는 고장 없이 지하층으로 내려갔다.',
    view: {
      type: 'document',
      title: '무대 설비 제어 로그',
      documentNumber: 'BY-LIFT-221646',
      organization: '소극장 백야 · 무대설비 제어실',
      fields: [
        { label: '22:16:42', value: '무대 조명 암전 신호 수신' },
        { label: '22:16:46', value: 'MANUAL INTERLOCK RELEASE' },
        { label: '22:16:47', value: '승강기 하강 시작 · 모터 부하 정상' },
        { label: '22:16:51', value: '지하 1층 정위치 도달' },
      ],
      note: '기계 고장 코드 없음. 안전 잠금은 수동 해제 명령으로 풀렸다.',
    },
  },
  {
    id: 'E2',
    name: '수정된 암전 큐시트',
    description:
      '공식 대본보다 암전이 8초 앞당겨졌다. 수정 직전 이규태의 태그로 조정실 문이 열렸다.',
    view: {
      type: 'document',
      title: '마지막 리허설 조명 큐시트',
      documentNumber: 'BY-CUE-FINAL-73',
      organization: '소극장 백야 · 조명 조정실',
      fields: [
        { label: '공식 대본', value: 'Q73 암전 · 22:16:50 예정' },
        { label: '현장 큐시트', value: 'Q73 암전 · 22:16:42로 수기 수정' },
        { label: '승인 표시', value: 'S.H.J. 이니셜 기재' },
        { label: '필적 1차', value: '서혜진의 기존 서명과 획순 불일치' },
        { label: '22:01:47', value: '조정실 출입문 · 직원 태그 GT-0049 인증' },
        { label: '등록자', value: '이규태 · 기술감독' },
      ],
      note: '22:02 장미래가 자리를 비운 동안 큐시트가 수정됐다. 해당 구간의 다른 출입 기록은 없다.',
    },
  },
  {
    id: 'E3',
    name: '경고 스피커와 허위 점검표',
    description:
      '승강기 경고 스피커가 검은 테이프로 막혀 있다. 같은 날 점검표에는 “이상 없음”으로 적혔다.',
    view: {
      type: 'document',
      title: '현장 감식·안전 점검 대조',
      documentNumber: 'BY-SAFE-03',
      organization: '공연장 안전사고 합동감식반',
      fields: [
        { label: '채증 위치', value: '조명 조정실 하단 승강기 경고 스피커' },
        { label: '채증물', value: '검은 무광 테이프 3겹' },
        { label: '음향 상태', value: '경고음 출력 정상 · 외부 전달만 차단' },
        { label: '일일 점검표', value: '장미래 서명 · “경고 시스템 이상 없음”' },
      ],
      note: '경고음 차단은 수동 잠금장치와 전기적으로 연결돼 있지 않다.',
    },
  },
  {
    id: 'E4',
    name: '서혜진의 공개 성명 초안',
    description:
      '피해자는 다음 날 12년 전 사고 은폐와 안전장치 임의 해제를 공개하려 했다.',
    view: {
      type: 'document',
      title: '전송되지 않은 공개 성명',
      documentNumber: 'MOBILE-DRAFT-2157',
      organization: '서혜진 휴대전화 디지털 포렌식',
      fields: [
        { label: '최종 저장', value: '21:57:34' },
        { label: '제목', value: '12년 전 백야극장 사고에 관하여' },
        {
          label: '본문 일부',
          value: '“안전장치가 임의로 해제된 사실을 알고도 침묵했습니다.”',
        },
        { label: '발표 예정', value: '개막 취소 후 일요일 오전 기자회견' },
      ],
      note: '초안은 전송되지 않았다. 삭제 흔적이나 외부 편집 흔적은 없다.',
    },
  },
  {
    id: 'E5',
    name: '12년 전 사고 원본 기록',
    description:
      '이규태가 안전장치 임시 해제를 지시했고 서혜진은 허위 최종 보고서에 서명했다.',
    view: {
      type: 'document',
      title: '2014년 윤선아 추락 사고 원본철',
      documentNumber: 'BY-2014-ACC-11',
      organization: '소극장 백야 · 자료실 보존 문서',
      fields: [
        { label: '사망자', value: '윤선아(31), 배우' },
        { label: '유족 기록', value: '딸 윤하늘(당시 15세)' },
        { label: '임시 해제 작업', value: '기술 책임 이규태 서명' },
        { label: '최종 보고서', value: '배우 진입 착오로 수정 · 서혜진 서명' },
      ],
      note: '원본 점검지와 최종 공식 보고서의 사고 원인이 서로 다르다.',
    },
  },
  {
    id: 'E6',
    name: '안전 열쇠 보관함 기록',
    description:
      '22:12 이규태의 직원 태그로 보관함이 열렸다. 수동 해제 열쇠 한 개가 사라졌다.',
    view: {
      type: 'document',
      title: '안전 열쇠 보관함 접근 기록',
      documentNumber: 'KEYSAFE-B2-0719',
      organization: '소극장 백야 · 시설관리 시스템',
      fields: [
        { label: '22:12:08', value: '직원 태그 GT-0049 인증' },
        { label: '등록자', value: '이규태 · 기술감독' },
        { label: '문 열림', value: '22:12:10~22:12:31' },
        { label: '재고 대조', value: '승강기 수동 해제 열쇠 1개 미반납' },
      ],
      note: '보관함 강제 개방이나 다른 태그 사용 흔적은 없다.',
    },
  },
  {
    id: 'E7',
    name: '서비스 통로 영상 복원',
    description:
      '이규태가 추락 전인 22:16:38 수동 조작반이 있는 무대 좌측 통로로 들어갔다.',
    view: {
      type: 'document',
      title: '저조도 CCTV 복원 분석서',
      documentNumber: 'DF-CAM-L2-1638',
      organization: '경찰청 디지털증거분석실',
      fields: [
        { label: '카메라', value: '무대 좌측 서비스 통로 CAM-L2' },
        { label: '22:16:38', value: '이규태 식별 · 통로 진입' },
        { label: '22:16:42', value: '암전 반사광 확인' },
        { label: '22:17:04', value: '이규태 통로 이탈' },
      ],
      note: '사고 뒤 구조하러 진입했다는 설명과 달리 추락 전에 이미 통로 안에 있었다.',
    },
  },
  {
    id: 'E8',
    name: '비공개 음향 순서 분석',
    description:
      '용의자에게 원문을 제시하지 않는 떠보기 정보. 승강기 구동음 뒤 발걸음이 이어졌고 그다음 추락음이 기록됐다.',
    presentationMode: 'probe',
    view: {
      type: 'document',
      title: '무대 음향 트랙 추출 분석',
      documentNumber: 'AUDIO-BY-14SEC',
      organization: '경찰청 디지털증거분석실',
      fields: [
        { label: '첫 번째 식별음', value: '승강기 구동음' },
        { label: '두 번째 식별음', value: '무대 중앙 방향으로 접근하는 발걸음' },
        { label: '세 번째 식별음', value: '충돌음·추락음' },
        { label: '사건 순서', value: '구동음 → 발걸음 → 추락음' },
      ],
      note: '수사상 비공개. 용의자에게 원문을 제시하지 않고 사고 전 동선에 관한 떠보기 질문에만 사용한다.',
    },
  },
  {
    id: 'E9',
    name: '분장실 복도 연속 영상',
    description:
      '윤하늘은 22:15:31 분장실 구역에 들어간 뒤 추락 후인 22:17:20에 나왔다.',
    view: {
      type: 'document',
      title: '분장실 복도 CCTV 연속성 확인',
      documentNumber: 'DF-CAM-DRESS-2215',
      organization: '경찰청 디지털증거분석실',
      fields: [
        { label: '22:15:31', value: '윤하늘 분장실 구역 진입' },
        { label: '22:15:31~22:17:20', value: '출입문 추가 개폐 없음' },
        { label: '22:16:52', value: '무대 추락음 발생 시각' },
        { label: '22:17:20', value: '윤하늘 복도로 나옴' },
      ],
      note: '영상은 중단 없는 원본이며 분장실 구역에서 승강기까지 우회 통로가 없다.',
    },
  },
];

export const case3: CaseDefinition = {
  id: 'case3',
  title: '22:17 — 마지막 리허설',
  briefing:
    '토요일 밤 22시 17분, 개막을 앞둔 소극장 백야의 비공개 리허설 중 예술감독 서혜진이 무대 승강기 아래로 추락해 사망했다. 무대는 암전 상태였고 승강기는 지하층에 내려가 있었다. 극장에 남아 있던 장미래, 윤하늘, 이규태는 모두 사고라고 주장하지만 세 사람의 거짓말은 서로 다른 이유에서 시작됐다.',
  maxTurns: 30,
  dossier: case3Dossier,
  evidences,
  suspects: [
    {
      id: 'mirae',
      name: '장미래',
      role: '무대감독, 32세',
      persona:
        '존댓말을 사용한다. 실무적인 단어로 짧게 답하지만 손이 떨릴 만큼 불안하다. 자신의 규정 위반은 두려워해도 기술적으로 다른 행동까지 한데 묶는 질문에는 분명히 반박한다.',
      portrait: '장',
      introLine:
        '장미래는 양손을 무릎 사이에 끼운 채 앉아 있다. 손끝이 계속 떨린다.',
      contract: jangMiraeContract,
    },
    {
      id: 'haneul',
      name: '윤하늘',
      role: '언더스터디 배우, 27세',
      persona:
        '차갑고 직설적인 반말과 존댓말의 경계를 오간다. 서혜진에 대한 적개심을 감추지 않지만 감정만으로 범인 취급하면 입을 닫는다. 동정받는 것을 특히 싫어한다.',
      portrait: '윤',
      introLine:
        '윤하늘은 울지 않는다. 의자 등받이에 기대어 심문관의 첫 질문을 기다린다.',
      contract: yoonHaneulContract,
    },
    {
      id: 'gyutae',
      name: '이규태',
      role: '기술감독, 49세',
      persona:
        '침착한 존댓말로 길고 기술적인 설명을 한다. 상대가 기계를 이해하지 못한다고 전제하며 기록의 한계와 다른 사람의 과실을 강조한다. 궁지에서도 목소리를 높이지 않고 끝까지 자백하지 않는다.',
      portrait: '이',
      introLine:
        '이규태는 팔짱을 낀 채 앉아 있다. 조사실 설비부터 훑어본 뒤 심문관을 바라본다.',
      contract: leeGyutaeContract,
    },
  ],
  initialEvidenceIds: [],
  initialSuspectIds: ['mirae', 'haneul', 'gyutae'],
  // 증거는 모두 서류철의 발견·조회·감식 그래프를 통해서만 입수한다.
  unlocks: [],
  // 이번 슬라이스는 심문만 검증한다. 빈 선택지는 공용 종결·기소 UI를 숨긴다.
  motiveOptions: [],
  methodOptions: [],
  solution: {
    culpritId: 'gyutae',
    motiveId: 'MOTIVE_EXPOSURE',
    methodId: 'METHOD_REHEARSAL',
    proofEvidenceChains: [
      ['E1', 'E2', 'E6', 'E7', 'E8'],
      ['E4', 'E5', 'E6', 'E7', 'E8'],
    ],
    epilogue:
      '이규태는 12년 전 자신이 무력화한 안전장치 때문에 윤선아가 죽었다는 사실과 서혜진이 그 기록을 공개하려 한다는 사실을 알고 있었다. 그는 암전 큐를 8초 앞당기고 수동 해제 열쇠로 승강기를 내렸다. 서혜진은 평소 동선대로 중앙 표시점으로 걸어가 추락했다. 장미래의 경고음 차단은 중대한 과실이지만 승강기 개방과는 별개였고, 윤하늘은 강한 원한과 위협적인 말에도 불구하고 사고 순간 분장실에 있었다. 이규태는 끝내 자백하지 않았지만 마지막 14초의 기록이 그의 대사 대신 진실을 말했다.',
  },
};
