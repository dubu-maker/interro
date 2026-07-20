import type { CaseContract } from '../../engine/contract';

// 프로토타입 사건의 계약. S0(전면 부인) → S1(태블릿 커버 스토리) →
// S2(대표실 만남 인정)로 증거 제시에 의해서만 전진한다.
// E1(주차장 기록)이 S0을 깨고, S1 상태에서 E3(커피잔)이 S2를 연다.
// 제시 순서가 어긋나면(예: S0에서 E3) 아무 일도 일어나지 않는다.
export const hanSeraContract: CaseContract = {
  suspectId: 'sera',
  language: 'ko',
  starterQuestions: [
    '사건 당일 밤 퇴근 이후의 행적을 말씀해 주세요.',
    '이도윤 대표와는 어떤 사이였습니까?',
    '마지막으로 대표를 본 게 언제입니까?',
  ],
  initialStageId: 'S0',
  stages: [
    {
      id: 'S0',
      strategy:
        '전면 부인. 퇴근 후 곧장 귀가했다는 진술을 침착하게 유지한다.',
      allowedClaimIds: ['C_WENT_HOME', 'C_KNEW_SATURDAY', 'C_DENY_MURDER'],
    },
    {
      id: 'S1',
      strategy:
        '재방문은 체념하고 인정하되 용건을 태블릿 회수로 축소한다. 살해는 부인한다.',
      allowedClaimIds: [
        'C_TABLET',
        'C_HEARD_PHONE',
        'C_LEFT_2205',
        'C_DENY_MURDER',
      ],
    },
    {
      id: 'S2',
      strategy:
        '대표실에서 대표를 만난 사실까지 인정한다. 언쟁은 시인하되 살해는 강하게 부인한다.',
      // 이전 단계에서 인정한 사실(태블릿, 통화 목격, 퇴차 시각)은 단계가
      // 전진해도 계속 진술할 수 있어야 한다.
      allowedClaimIds: [
        'C_TABLET',
        'C_HEARD_PHONE',
        'C_LEFT_2205',
        'C_ENTERED_OFFICE',
        'C_COFFEE_TOGETHER',
        'C_MONEY_ARGUMENT',
        'C_LEFT_ALIVE',
        'C_DENY_MURDER',
      ],
    },
  ],
  transitions: [
    {
      from: 'S0',
      to: 'S1',
      whenEvidencePresented: 'E1',
      unlockNotice: '주차장 기록과 한세라의 퇴근 후 진술이 충돌한다.',
    },
    {
      from: 'S1',
      to: 'S2',
      whenEvidencePresented: 'E3',
      unlockNotice:
        '마주 놓인 커피잔 두 개 — 그날 밤 누군가 피해자와 마주 앉아 있었다.',
    },
  ],
  claims: [
    {
      id: 'C_WENT_HOME',
      meaning:
        '21시에 퇴근해서 곧장 집으로 갔고, 그 뒤 회사 근처에는 가지 않았다.',
      truth: 'false',
      contradictedBy: ['E1'],
    },
    {
      id: 'C_KNEW_SATURDAY',
      meaning: '대표의 사망은 토요일에 연락을 받고 알았다.',
      truth: 'true',
    },
    {
      id: 'C_DENY_MURDER',
      meaning: '대표를 해치지 않았다.',
      truth: 'true',
    },
    {
      id: 'C_TABLET',
      meaning: '21시 38분에 두고 온 태블릿을 가지러 회사로 돌아왔다.',
      truth: 'partial',
    },
    {
      id: 'C_HEARD_PHONE',
      meaning:
        '사무실 앞에서 대표가 누군가와 통화하며 언성을 높이는 소리를 들었다.',
      truth: 'true',
    },
    {
      id: 'C_LEFT_2205',
      meaning: '22시 5분에 주차장을 나왔다.',
      truth: 'true',
    },
    {
      id: 'C_ENTERED_OFFICE',
      meaning: '통화가 끝난 뒤 대표실에 들어가 대표와 마주 앉았다.',
      truth: 'true',
    },
    {
      id: 'C_COFFEE_TOGETHER',
      meaning:
        '대표가 내려 준 커피를 함께 마셨고, 잔 하나에 립스틱 자국이 남았다.',
      truth: 'true',
    },
    {
      id: 'C_MONEY_ARGUMENT',
      meaning: '회사 자금 문제로 대표와 짧게 언쟁했다.',
      truth: 'true',
    },
    {
      id: 'C_LEFT_ALIVE',
      meaning: '대표실에서 나올 때 대표는 살아 있었다.',
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'H_S0_PARKING',
      text: '한세라의 퇴근 이후 동선을 물증으로 확인할 방법이 있을 것이다.',
      stageIds: ['S0'],
      targetEvidenceId: 'E1',
    },
    {
      id: 'H_S1_OBSERVATION',
      text: '한세라가 회사에 머문 27분 동안 무엇을 보고 들었는지는 아직 묻지 않았다.',
      stageIds: ['S1', 'S2'],
      targetClaimId: 'C_HEARD_PHONE',
    },
    {
      id: 'H_S1_COFFEE',
      text: '책상 위 커피잔은 아직 한세라 앞에 놓이지 않았다.',
      stageIds: ['S1'],
      targetEvidenceId: 'E3',
    },
    {
      id: 'H_S2_TOPIC',
      text: '통화 얘기가 아니라, 한세라 본인이 대표와 마주 앉아 나눈 대화의 주제는 아직 밝혀지지 않았다.',
      stageIds: ['S2'],
      targetClaimId: 'C_MONEY_ARGUMENT',
    },
    {
      id: 'H_S2_EXIT',
      text: '21시 38분부터 22시 5분까지의 동선 중 마지막 부분이 아직 설명되지 않았다.',
      stageIds: ['S2'],
      targetClaimId: 'C_LEFT_ALIVE',
    },
  ],
  materialLexicon: [
    '커피',
    '커피잔',
    '립스틱',
    '태블릿',
    '통화',
    '전화',
    'cctv',
    '주차장',
    '부검',
    '자금',
    '자료',
    '서류',
    '둔기',
    '흉기',
    '녹음',
    '문자',
    '메시지',
    '술',
    '유서',
  ],
};
