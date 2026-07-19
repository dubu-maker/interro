import type { Evidence, SuspectSheet } from '../../engine/types';

export const briefing =
  '스타트업 대표 이도윤(41)이 금요일 밤 자기 사무실에서 숨진 채 발견됐다. ' +
  '사망 추정 시각은 21:30~22:30이며 사인은 후두부 외상이다.';

export const evidences: Evidence[] = [
  {
    id: 'E1',
    name: '주차장 출입 기록',
    description: '한세라 차량. 21:02 출차 → 21:38 재입차 → 22:05 출차.',
    view: {
      type: 'parking',
      date: '2026-07-17',
      camera: 'B2 출입구 CAM-03',
      vehicle: '38가 7124 · 흰색 세단',
      owner: '한세라',
      rows: [
        { time: '21:02:14', action: '출차', lane: 'B2-OUT', confidence: '99.1%' },
        { time: '21:38:47', action: '입차', lane: 'B2-IN', confidence: '98.7%' },
        { time: '22:05:09', action: '출차', lane: 'B2-OUT', confidence: '99.4%' },
      ],
    },
  },
  {
    id: 'E2',
    name: '부검 소견서',
    description: '사망 추정 시각 21:30~22:30. 후두부 외상.',
    view: {
      type: 'document',
      documentNumber: 'NF-26-0718-044',
      organization: '국립과학수사연구원 법의학부',
      fields: [
        { label: '피검자', value: '이도윤 (남, 41세)' },
        { label: '사망 추정', value: '2026-07-17 21:30~22:30' },
        { label: '직접 사인', value: '후두부 둔력 손상에 의한 두개강 내 출혈' },
        { label: '기타 소견', value: '방어흔 없음 · 혈중알코올 음성' },
      ],
      note: '본 소견은 1차 부검 결과이며 정밀 독성 검사 결과에 따라 보완될 수 있음.',
    },
  },
  {
    id: 'E3',
    name: '책상 위 커피잔 두 개',
    description: '피해자 책상에 커피잔 두 개. 하나에는 립스틱 자국이 있다.',
    view: {
      type: 'scene',
      capturedAt: '2026-07-18 00:42:18',
      location: '대표이사실 책상 · 증거번호 P-07',
      caption: '서로 마주 보는 위치에 놓인 커피잔 두 개. 우측 잔 가장자리에 적색 착색 흔적이 확인된다.',
    },
  },
];

export const suspect: SuspectSheet = {
  id: 'sera',
  name: '한세라',
  role: '비서, 29세',
  persona:
    '존댓말을 사용한다. 짧고 방어적으로 답한다. 침착하려 애쓰지만 민감한 질문에는 문장이 짧아지고 가끔 되묻는다.',
  publicInfo: [
    '이도윤 대표의 비서로 3년째 근무했다.',
    '금요일 저녁 대표는 야근 중이었고 다른 직원들은 20시 전에 퇴근했다.',
    '대표와 업무상 마찰이 가끔 있었다.',
  ],
  coverStory:
    '21시에 퇴근해서 곧장 집에 갔다. 그 뒤 회사 근처에는 가지 않았다. 대표의 사망은 토요일에 연락받고 알았다.',
  nervousTopics: ['퇴근 시각', '주차장', '금요일 밤 행적'],
  forbiddenClaims: [
    '다른 직원들과 함께 퇴근',
    '토요일 아침 연락',
    '중요한 자료',
    '중요한 일정',
  ],
  secrets: [
    {
      id: 'S1',
      fact:
        '21:38에 회사 주차장으로 돌아왔다. 두고 온 태블릿을 가지러 갔고, 사무실 앞에서 대표가 누군가와 통화하며 언성을 높이는 것을 들었다. 태블릿만 챙겨 22:05에 나왔다.',
      gateEvidenceId: 'E1',
      unlockNotice: '주차장 기록과 한세라의 퇴근 후 진술이 충돌한다.',
      postUnlockAttitude:
        '재방문은 체념하고 인정하되 살해는 강하게 부인한다. 통화 상대는 모른다고 답한다.',
    },
  ],
};
