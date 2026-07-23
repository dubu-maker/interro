import type { CaseContract } from '../../engine/contract';

// 김만철의 말은 엔진이 허용한 의미 안에서만 생성한다. 딸이 운전했고
// 음주했다는 진실은 ST_SINCERE에 도달하기 전까지 후보에도 들어가지 않는다.
export const kimMancheolContract: CaseContract = {
  suspectId: 'mancheol',
  language: 'ko',
  starterQuestions: [
    '사고가 난 순간부터 순서대로 말씀해 주시겠습니까?',
    '피해 오토바이는 어느 방향에서 나타났습니까?',
    '사고 뒤 집까지 어떤 길로 돌아가셨습니까?',
  ],
  initialStageId: 'ST_CONFESSION',
  initialClaimIds: [
    'C_I_DROVE',
    'C_RIDER_RIGHT',
    'C_HOME_DIRECT',
    'C_SOBER',
  ],
  sealedTerms: ['떡볶이', '빨간 국물'],
  position: {
    stageIds: [
      'ST_CONFESSION',
      'ST_PATCH',
      'ST_RIGID',
      'ST_DILEMMA',
    ],
    directive:
      '서명한 자수 입장, 즉 자신이 운전했다는 주장을 유지한다. 가족관계·카드·차량·통화처럼 확인 가능한 사실은 인정하되 사고와의 관련성만 다툰다.',
    protectedClaimIds: ['C_I_DROVE'],
    undeniableFacts: [
      {
        claimId: 'C_DAUGHTER_IDENTITY',
        acknowledgementPattern:
          '(?:김서연.{0,10}(?:제\\s*)?딸|제\\s*딸.{0,10}김서연)',
        fallbackLine: '김서연은 제 딸입니다.',
        stageIds: [
          'ST_CONFESSION',
          'ST_PATCH',
          'ST_RIGID',
          'ST_DILEMMA',
        ],
        questionTerms: ['김서연', '당신 딸', '따님'],
        evidenceIds: ['E05', 'F06'],
      },
      {
        claimId: 'C_CARD_OWNERSHIP',
        acknowledgementPattern:
          '(?:(?:제|본인).{0,8}(?:카드|명의)|카드.{0,8}(?:제|본인).{0,4}명의)',
        fallbackLine: '그 카드는 제 명의가 맞습니다.',
        stageIds: [
          'ST_CONFESSION',
          'ST_PATCH',
          'ST_RIGID',
          'ST_DILEMMA',
        ],
        questionTerms: ['당신 카드', '본인 카드', '카드 명의', '명의 카드'],
        evidenceIds: ['E06'],
      },
      {
        claimId: 'C_CAR_OWNERSHIP',
        acknowledgementPattern:
          '(?:(?:제|본인).{0,8}(?:차|차량)|(?:차|차량).{0,8}(?:제|본인).{0,4}명의)',
        fallbackLine: '사고 차량은 제 명의가 맞습니다.',
        stageIds: [
          'ST_CONFESSION',
          'ST_PATCH',
          'ST_RIGID',
          'ST_DILEMMA',
        ],
        questionTerms: ['당신 차', '본인 차량', '차량 명의', '제 차'],
        evidenceIds: ['E03', 'F01', 'F02', 'F04', 'F06'],
      },
      {
        claimId: 'C_CALL_OCCURRED',
        acknowledgementPattern:
          '(?:통화|전화).{0,12}(?:했|한|맞|기록)',
        fallbackLine: '23시 52분 김서연과 통화한 것도 맞습니다.',
        stageIds: [
          'ST_CONFESSION',
          'ST_PATCH',
          'ST_RIGID',
          'ST_DILEMMA',
        ],
        questionTerms: ['김서연과 통화', '통화 기록', '전화 기록', '23시 52분'],
        evidenceIds: ['E05'],
      },
      {
        claimId: 'C_RESTAURANT_PRESENT',
        acknowledgementPattern:
          '(?:왕곱창|식당).{0,12}(?:있었|머물|간\\s*것)',
        fallbackLine:
          '그날 왕곱창에 있었던 사실은 인정합니다. 다만 사고 전후 시각은 정확히 기억나지 않습니다.',
        stageIds: [
          'ST_CONFESSION',
          'ST_PATCH',
          'ST_RIGID',
          'ST_DILEMMA',
        ],
        questionTerms: [
          '왕곱창에 있었',
          '식당에 있었',
          '왕곱창 CCTV',
        ],
        evidenceIds: ['F03'],
      },
    ],
    forbiddenLinePatterns: [
      {
        id: 'DENY_SELF_DRIVING',
        label: '자신의 운전 자백 부정',
        pattern:
          '제가\\s*운전(?:(?:한|했)(?:\\s*(?:것은|게|건))?\\s*(?:아니|아닙|않)|하지\\s*않)',
      },
      {
        id: 'DENY_SELF_ACCIDENT',
        label: '자신의 사고 자백 부정',
        pattern:
          '제가\\s*사고를\\s*낸\\s*(?:것은|게|건)?\\s*(?:맞지\\s*않|아니|아닙)',
      },
      {
        id: 'DENY_RIDING',
        label: '차량 탑승·운전 자백 부정',
        pattern: '차를\\s*(?:타|몰)지도\\s*않',
      },
      {
        id: 'DENY_CAR_OWNERSHIP',
        label: '본인 차량 명의 부정',
        pattern: '제\\s*차(?:량)?(?:이|가)?\\s*(?:아니|아닙)',
      },
      {
        id: 'DENY_CARD_OWNERSHIP',
        label: '본인 카드 명의 부정',
        pattern:
          '(?:다른\\s*(?:분|사람)(?:의)?\\s*카드|제\\s*카드가\\s*(?:아니|아닙))',
      },
      {
        id: 'DENY_DAUGHTER_IDENTITY',
        label: '확인된 가족관계 부정',
        pattern: '김서연.{0,12}(?:누군지\\s*)?(?:모르|기억나지)',
      },
      {
        id: 'DENY_CALL',
        label: '확인된 통화 사실 부정',
        pattern: '(?:통화|전화).{0,10}(?:하지\\s*않|없었)',
      },
      {
        id: 'DENY_CALLER_IDENTITY',
        label: '확인된 통화 상대 부정',
        pattern:
          '(?:상대방|전화한\\s*사람|발신자).{0,16}(?:모르|기억나지)',
      },
      {
        id: 'DENY_DRIVER_IDENTITY',
        label: '자신의 운전자 입장 부정',
        pattern:
          '(?:사고를\\s*낸\\s*사람|운전자)(?:은|이|가)?\\s*제가\\s*(?:아니|아닙)',
      },
    ],
    fallbackLine:
      '운전한 사람은 접니다. 확인되는 기록은 부인하지 않겠습니다. 이 사고의 책임은 제게 있습니다.',
  },
  stages: [
    {
      id: 'ST_CONFESSION',
      strategy:
        '준비한 자백을 차분하고 공손하게 반복한다. 모르는 현장 세부는 경황이 없었다며 회피한다.',
      allowedClaimIds: [
        'C_I_DROVE',
        'C_RIDER_RIGHT',
        'C_HOME_DIRECT',
        'C_SOBER',
        'C_BEFORE_MIDNIGHT',
        'C_MEMORY_BLANK',
        'C_DAUGHTER_UNRELATED',
        'C_SEAT_ALWAYS_FORWARD',
        'C_RESTAURANT_PRESENT',
      ],
    },
    {
      id: 'ST_PATCH',
      strategy:
        '자백은 유지하되 드러난 기록마다 짧은 임시 설명을 덧붙인다. 확신에 찬 새 세부는 만들지 않는다.',
      allowedClaimIds: [
        'C_I_DROVE',
        'C_RIDER_RIGHT',
        'C_HOME_DIRECT',
        'C_SOBER',
        'C_BEFORE_MIDNIGHT',
        'C_MEMORY_BLANK',
        'C_DAUGHTER_UNRELATED',
        'C_CARD_LEFT_BEHIND',
        'C_SEAT_MOVED_LATER',
        'C_SEAT_ALWAYS_FORWARD',
        'C_RESTAURANT_PRESENT',
      ],
    },
    {
      id: 'ST_RIGID',
      strategy:
        '답이 짧아지고 침묵이 길어진다. 모순을 해명하기보다 자신의 자백을 믿어 달라고 요구한다.',
      allowedClaimIds: [
        'C_I_DROVE',
        'C_RIDER_RIGHT',
        'C_HOME_DIRECT',
        'C_SOBER',
        'C_MEMORY_BLANK',
        'C_DAUGHTER_UNRELATED',
        'C_CARD_LEFT_BEHIND',
        'C_CCTV_TIME_WRONG',
        'C_SEAT_MOVED_LATER',
        'C_TAKE_MY_WORD',
        'C_SEAT_ALWAYS_FORWARD',
        'C_RESTAURANT_PRESENT',
      ],
    },
    {
      id: 'ST_DILEMMA',
      strategy:
        '자백을 지키려면 자기 알리바이를 부정해야 한다는 사실을 깨닫는다. 보호하려는 대상의 정체와 사건 관여는 끝까지 밝히지 않는다.',
      allowedClaimIds: [
        'C_I_DROVE',
        'C_MEMORY_BLANK',
        'C_DAUGHTER_UNRELATED',
        'C_CARD_LEFT_BEHIND',
        'C_CCTV_TIME_WRONG',
        'C_TAKE_MY_WORD',
        'C_ACCEPTS_RUIN',
        'C_PROTECTS_SOMEONE',
        'C_RESTAURANT_PRESENT',
      ],
    },
    {
      id: 'ST_COLLAPSE',
      strategy:
        '자백이 무너졌음을 알지만 마지막까지 보호하려는 사람의 이름은 말하지 않는다. 변명보다 침묵과 간접 인정이 많다.',
      allowedClaimIds: [
        'C_I_DROVE',
        'C_DAUGHTER_UNRELATED',
        'C_ACCEPTS_RUIN',
        'C_PROTECTS_SOMEONE',
        'C_NOT_DRIVER',
        'C_ASKS_ABOUT_CHILD',
      ],
    },
    {
      id: 'ST_SINCERE',
      strategy:
        '심문관이 자신의 희생을 조롱하지 않았음을 받아들인다. 딸을 지키려 허위 자백했다는 진실을 짧고 담담하게 말한다.',
      allowedClaimIds: [
        'C_NOT_DRIVER',
        'C_ASKS_ABOUT_CHILD',
        'C_DAUGHTER_DROVE',
        'C_DAUGHTER_DRANK',
        'C_FALSE_CONFESSION_FOR_DAUGHTER',
      ],
    },
  ],
  transitions: [],
  claimTopics: [
    {
      id: 'DRIVER_IDENTITY',
      label: '사고 운전자',
      revisionFollowUp:
        '방금 전까지 본인이 운전했다고 했습니다. 지금 진술을 바꾸는 겁니까?',
    },
    {
      id: 'POST_CRASH_ROUTE',
      label: '사고 뒤 동선',
      revisionFollowUp:
        '아까는 사고 뒤 곧장 집으로 갔다면서요. 왕곱창에 있었다는 말과 어떻게 함께 성립합니까?',
    },
    { id: 'DAUGHTER_IDENTITY', label: '김서연과의 관계' },
    { id: 'CARD_OWNERSHIP', label: '결제 카드 명의' },
    { id: 'CAR_OWNERSHIP', label: '사고 차량 명의' },
    { id: 'CALL_OCCURRED', label: '23시 52분 통화 여부' },
    { id: 'SEAT_HABIT', label: '평소 운전석 위치' },
  ],
  claims: [
    {
      id: 'C_I_DROVE',
      meaning:
        '사고 당시 자신이 차량을 운전했고 피해 오토바이를 충격했다고 자백한다.',
      truth: 'false',
      topicId: 'DRIVER_IDENTITY',
      valueId: 'SELF',
      contradictedBy: ['M1', 'M2'],
    },
    {
      id: 'C_RIDER_RIGHT',
      meaning: '피해 오토바이가 오른쪽에서 갑자기 튀어나왔다고 주장한다.',
      truth: 'false',
      contradictedBy: ['M3'],
    },
    {
      id: 'C_HOME_DIRECT',
      meaning: '사고 뒤 다른 곳에 들르지 않고 곧장 집으로 갔다고 주장한다.',
      truth: 'false',
      topicId: 'POST_CRASH_ROUTE',
      valueId: 'HOME_DIRECT',
      contradictedBy: ['M4'],
    },
    {
      id: 'C_SOBER',
      meaning: '그날 술을 마시지 않았다고 주장한다.',
      truth: 'false',
      contradictedBy: ['M2'],
    },
    {
      id: 'C_BEFORE_MIDNIGHT',
      meaning: '사고가 자정 전이었다고만 기억한다고 말한다.',
      truth: 'partial',
    },
    {
      id: 'C_MEMORY_BLANK',
      meaning:
        '사고 충격과 경황 때문에 충돌 순간의 감각적 세부는 기억나지 않는다고 회피한다.',
      truth: 'partial',
      contradictedBy: ['M6'],
    },
    {
      id: 'C_DAUGHTER_IDENTITY',
      meaning: '김서연은 자신의 딸이라는 가족관계를 인정한다.',
      truth: 'true',
      topicId: 'DAUGHTER_IDENTITY',
      valueId: 'DAUGHTER',
    },
    {
      id: 'C_CARD_OWNERSHIP',
      meaning:
        '87,000원이 결제된 카드는 자기 명의라고 인정하되 사용 경위만 다툰다.',
      truth: 'true',
      topicId: 'CARD_OWNERSHIP',
      valueId: 'SELF',
    },
    {
      id: 'C_CAR_OWNERSHIP',
      meaning:
        '사고 차량이 자기 명의라는 사실을 인정하고, 운전자는 자백대로 자신이라고 주장한다.',
      truth: 'true',
      topicId: 'CAR_OWNERSHIP',
      valueId: 'SELF',
    },
    {
      id: 'C_CALL_OCCURRED',
      meaning:
        '23시 52분 김서연과 통화한 사실을 인정하되 사고와의 관련성은 부인한다.',
      truth: 'true',
      topicId: 'CALL_OCCURRED',
      valueId: 'YES',
    },
    {
      id: 'C_DAUGHTER_UNRELATED',
      meaning: '딸은 이 사고와 관계없다고 한 문장으로 선을 긋는다.',
      truth: 'false',
    },
    {
      id: 'C_RESTAURANT_PRESENT',
      meaning:
        '그날 왕곱창에 있었던 사실은 인정하지만 사고 전후의 정확한 시각은 흐리다고 주장한다.',
      truth: 'partial',
      topicId: 'POST_CRASH_ROUTE',
      valueId: 'RESTAURANT_PRESENT',
      contradictedBy: ['M2'],
    },
    {
      id: 'C_CARD_LEFT_BEHIND',
      meaning:
        '왕곱창에는 카드를 두고 먼저 나왔으며 동석자가 나중에 결제했다고 주장한다.',
      truth: 'false',
      contradictedBy: ['M2'],
    },
    {
      id: 'C_SEAT_ALWAYS_FORWARD',
      meaning:
        '평소에도 운전석을 앞으로 바짝 당겨 운전했다고 재확인한다.',
      truth: 'false',
      topicId: 'SEAT_HABIT',
      valueId: 'FRONT',
      contradictedBy: ['M1'],
    },
    {
      id: 'C_SEAT_MOVED_LATER',
      meaning:
        '사고 이후 누군가 운전석 위치를 바꿨을 수 있다고 근거 없이 주장한다.',
      truth: 'false',
      contradictedBy: ['M1'],
    },
    {
      id: 'C_CCTV_TIME_WRONG',
      meaning: '식당 CCTV의 시각이나 영상 판독이 잘못됐을 수 있다고 주장한다.',
      truth: 'false',
      contradictedBy: ['M2'],
    },
    {
      id: 'C_TAKE_MY_WORD',
      meaning: '기록보다 자기가 서명한 자백을 믿어 달라고 요구한다.',
      truth: 'false',
    },
    {
      id: 'C_ACCEPTS_RUIN',
      meaning:
        '개인택시 면허와 생계를 잃는 결과까지 알고도 자신의 자백을 거두지 않겠다고 말한다.',
      truth: 'true',
    },
    {
      id: 'C_PROTECTS_SOMEONE',
      meaning:
        '자신의 처벌보다 지켜야 할 누군가의 앞날이 더 중요하다는 마음을 간접적으로 드러낸다.',
      truth: 'partial',
    },
    {
      id: 'C_NOT_DRIVER',
      meaning:
        '수사관이 자신이 운전자가 아니라는 사실을 이미 안다고 간접적으로 인정한다.',
      truth: 'true',
      topicId: 'DRIVER_IDENTITY',
      valueId: 'NOT_SELF',
    },
    {
      id: 'C_ASKS_ABOUT_CHILD',
      meaning: '처음으로 심문관에게 자식이 있느냐고 묻는다.',
      truth: 'true',
    },
    {
      id: 'C_DAUGHTER_DROVE',
      meaning: '사고 당시 차량을 운전한 사람은 딸 김서연이었다고 밝힌다.',
      truth: 'true',
    },
    {
      id: 'C_DAUGHTER_DRANK',
      meaning: '김서연이 술을 마신 상태로 차량을 몰았다고 밝힌다.',
      truth: 'true',
    },
    {
      id: 'C_FALSE_CONFESSION_FOR_DAUGHTER',
      meaning:
        '딸의 범행과 앞날을 지키기 위해 자신이 운전자라고 허위 자백했다고 밝힌다.',
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'H_COMMIT_DIRECTION',
      text: '자백의 결론보다 충돌 방향을 정확한 문장으로 고정해 두자.',
      stageIds: ['ST_CONFESSION', 'ST_PATCH'],
      targetClaimId: 'C_RIDER_RIGHT',
    },
    {
      id: 'H_COMPARE_ROUTE',
      text: '25년 택시기사의 도주 동선이라고 보기 자연스러운지 비교해 보자.',
      stageIds: ['ST_PATCH', 'ST_RIGID'],
      targetEvidenceId: 'F04',
    },
    {
      id: 'H_BREAK_ALIBI',
      text: '자백을 믿는 대신, 그 시각 자백자가 어디에 있었는지 먼저 확정하자.',
      stageIds: ['ST_RIGID', 'ST_DILEMMA'],
      targetEvidenceId: 'F03',
    },
    {
      id: 'H_PROBE_SCENE',
      text: '정답을 알려 주지 않은 채 현장에 실제로 있었던 사람만 알 세부를 물을 수 있다.',
      stageIds: ['ST_DILEMMA'],
      targetEvidenceId: 'E04',
    },
  ],
  materialLexicon: [
    '김서연',
    '오토바이',
    '왕곱창',
    '운전석',
    '시트',
    '에어백',
    'DNA',
    '불법 유턴',
    '기지국',
    '인포테인먼트',
    '떡볶이',
    '빨간 국물',
  ],
};
