import type { CaseContract } from '../../engine/contract';

const materialLexicon = [
  '승강기',
  '안전장치',
  '수동 해제',
  '열쇠',
  '보관함',
  '암전',
  '큐시트',
  '경고음',
  '스피커',
  '검은 테이프',
  '점검표',
  '조정실',
  '서비스 통로',
  '안개 장비',
  '자료실',
  '사고 보고서',
  '공개 성명',
  '기자회견',
  '분장실',
  '윤선아',
  '서혜진',
  '장미래',
  '윤하늘',
  '이규태',
  '22시 12분',
  '22시 16분',
  '12년 전',
];

export const jangMiraeContract: CaseContract = {
  suspectId: 'mirae',
  language: 'ko',
  starterQuestions: [
    '사고 직전 조정실에서 어떤 큐를 진행했습니까?',
    '승강기 경고음은 정상적으로 작동했습니까?',
    '승강기 바닥을 내리려면 어떤 절차가 필요합니까?',
  ],
  initialClaimIds: [
    'M_CUE_NORMAL',
    'M_IN_CONTROL_ROOM',
    'M_SENSOR_FAULT',
  ],
  initialStageId: 'M_COVER',
  stages: [
    {
      id: 'M_COVER',
      strategy:
        '사고 책임이 자신에게 돌아올까 두려워한다. 리허설 큐는 정상이었고 승강기 센서가 오작동했다고 짧게 주장한다.',
      allowedClaimIds: [
        'M_CUE_NORMAL',
        'M_IN_CONTROL_ROOM',
        'M_SENSOR_FAULT',
        'M_DID_NOT_OPEN_LIFT',
      ],
    },
    {
      id: 'M_TAPE',
      strategy:
        '경고음을 막은 과실과 점검표 누락은 인정한다. 하지만 경고음 차단과 승강기 개방은 다른 행동이라고 분명히 구분한다.',
      allowedClaimIds: [
        'M_TAPED_WARNING',
        'M_FALSE_CHECKLIST',
        'M_WARNING_ONLY',
        'M_KEY_REQUIRED',
        'M_IN_CONTROL_ROOM',
        'M_DID_NOT_OPEN_LIFT',
      ],
    },
    {
      id: 'M_CUE',
      strategy:
        '큐시트가 자신에게 전달될 때부터 수정돼 있었다고 인정한다. 서혜진의 이니셜을 믿었지만 지금 보니 필체가 어색했다고 말한다.',
      allowedClaimIds: [
        'M_RECEIVED_CHANGED_CUE',
        'M_INITIALS_LOOKED_WRONG',
        'M_GYUTAE_ACCESS',
        'M_IN_CONTROL_ROOM',
        'M_DID_NOT_OPEN_LIFT',
      ],
    },
    {
      id: 'M_FULL',
      strategy:
        '자신의 안전 위반을 더는 숨기지 않는다. 과실과 살인을 분리하며 수동 열쇠와 이규태의 동선을 설명한다.',
      allowedClaimIds: [
        'M_TAPED_WARNING',
        'M_FALSE_CHECKLIST',
        'M_WARNING_ONLY',
        'M_KEY_REQUIRED',
        'M_RECEIVED_CHANGED_CUE',
        'M_INITIALS_LOOKED_WRONG',
        'M_GYUTAE_ACCESS',
        'M_IN_CONTROL_ROOM',
        'M_DID_NOT_OPEN_LIFT',
      ],
    },
  ],
  transitions: [
    {
      from: 'M_COVER',
      to: 'M_TAPE',
      whenEvidencePresented: 'E3',
      unlockNotice:
        '장미래가 경고 스피커를 막고 일일 점검표에서 그 사실을 누락했음을 인정했다.',
      reactionLine:
        '제가 테이프를 붙였습니다. 점검표에도 쓰지 않았어요. 하지만 막은 건 경고음뿐입니다. 승강기 바닥은 열쇠 없이는 내릴 수 없습니다.',
    },
    {
      from: 'M_COVER',
      to: 'M_CUE',
      whenEvidencePresented: 'E2',
      unlockNotice:
        '장미래가 받은 큐시트는 이미 수정돼 있었고 서혜진의 승인 이니셜은 위조된 것으로 보인다.',
      reactionLine:
        '제가 받은 큐시트에는 이미 그 수정과 감독님 이니셜이 있었습니다. 그래서 승인된 줄 알았어요. 지금 보니 필체가 이상합니다.',
    },
    {
      from: 'M_TAPE',
      to: 'M_FULL',
      whenEvidencePresented: 'E2',
      unlockNotice:
        '장미래의 경고음 차단과 별개로 누군가 암전 큐를 앞당겼다는 사실이 확인됐다.',
      reactionLine:
        '그 수정은 제가 한 게 아닙니다. 규태 선배는 공연 전에 조정실과 무대 좌측 통로를 계속 드나들었습니다.',
    },
    {
      from: 'M_CUE',
      to: 'M_FULL',
      whenEvidencePresented: 'E3',
      unlockNotice:
        '장미래는 자신의 과실을 인정했지만 승강기 개방에는 별도의 수동 열쇠가 필요하다고 진술했다.',
      reactionLine:
        '경고음을 막은 건 저입니다. 그 책임은 피하지 않겠습니다. 하지만 경고음을 막는 것과 승강기를 여는 건 전혀 다른 일입니다.',
    },
  ],
  claims: [
    {
      id: 'M_CUE_NORMAL',
      meaning: '리허설 큐는 평소와 같았고 자신은 전달받은 순서대로 진행했다고 주장한다.',
      fallbackLine: '리허설 큐는 평소와 같았습니다. 저는 받은 순서대로 진행했습니다.',
      truth: 'false',
      contradictedBy: ['E2'],
    },
    {
      id: 'M_IN_CONTROL_ROOM',
      meaning: '암전 전후 내내 조명 조정실에 있었다고 진술한다.',
      fallbackLine: '저는 암전 전후 내내 조정실에 있었습니다.',
      truth: 'true',
    },
    {
      id: 'M_SENSOR_FAULT',
      meaning: '승강기 센서 오작동이 사고 원인일 수 있다고 주장한다.',
      fallbackLine: '처음에는 승강기 센서가 오작동한 줄 알았습니다.',
      truth: 'false',
      contradictedBy: ['E1'],
    },
    {
      id: 'M_DID_NOT_OPEN_LIFT',
      meaning: '자신은 승강기 바닥을 내리지 않았다고 부인한다.',
      fallbackLine: '제가 승강기 바닥을 내린 건 아닙니다.',
      truth: 'true',
    },
    {
      id: 'M_TAPED_WARNING',
      meaning: '반복되는 경고음을 막으려고 스피커에 검은 테이프를 붙였다고 인정한다.',
      fallbackLine: '반복되는 경고음을 막으려고 제가 검은 테이프를 붙였습니다.',
      truth: 'true',
    },
    {
      id: 'M_FALSE_CHECKLIST',
      meaning: '공연 취소가 두려워 경고음 차단을 일일 안전 점검표에 적지 않았다고 인정한다.',
      fallbackLine: '공연이 취소될까 두려워 점검표에는 사실대로 적지 않았습니다.',
      truth: 'true',
    },
    {
      id: 'M_WARNING_ONLY',
      meaning: '자신이 무력화한 것은 경고음뿐이며 승강기 잠금장치는 건드리지 않았다고 구분한다.',
      fallbackLine: '제가 막은 건 경고음뿐입니다. 잠금장치는 건드리지 않았습니다.',
      truth: 'true',
    },
    {
      id: 'M_KEY_REQUIRED',
      meaning: '승강기 바닥을 내리려면 무대 좌측 통로의 수동 해제 열쇠가 필요하다고 설명한다.',
      fallbackLine: '승강기 바닥은 무대 좌측 통로의 수동 해제 열쇠가 있어야 내릴 수 있습니다.',
      truth: 'true',
    },
    {
      id: 'M_RECEIVED_CHANGED_CUE',
      meaning: '자신이 받은 큐시트에는 암전을 8초 앞당긴 수정이 이미 적혀 있었다고 진술한다.',
      fallbackLine: '제가 큐시트를 받았을 때는 암전이 이미 8초 앞당겨져 있었습니다.',
      truth: 'true',
    },
    {
      id: 'M_INITIALS_LOOKED_WRONG',
      meaning: '수정 옆 서혜진의 승인 이니셜이 지금 보니 평소 필체와 달라 보인다고 진술한다.',
      fallbackLine: '그때는 믿었지만 지금 보니 감독님 이니셜 필체가 평소와 다릅니다.',
      truth: 'true',
    },
    {
      id: 'M_GYUTAE_ACCESS',
      meaning: '이규태가 공연 전 조정실과 무대 좌측 서비스 통로를 자유롭게 드나들었다고 진술한다.',
      fallbackLine: '규태 선배는 공연 전 조정실과 무대 좌측 통로를 계속 드나들었습니다.',
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'M_HINT_TAPE',
      text: '경고 스피커에 남은 검은 테이프를 장미래에게 직접 보여 줄 수 있다.',
      stageIds: ['M_COVER'],
      targetEvidenceId: 'E3',
    },
    {
      id: 'M_HINT_SEPARATE',
      text: '경고음을 막는 행동과 승강기 바닥을 내리는 행동이 같은 것인지 구분해 물어보자.',
      stageIds: ['M_TAPE'],
      targetEvidenceId: 'E2',
    },
    {
      id: 'M_HINT_ACCESS',
      text: '수정된 큐시트를 누가 만질 수 있었는지 구체적인 동선을 확인하자.',
      stageIds: ['M_CUE', 'M_FULL'],
      targetClaimId: 'M_GYUTAE_ACCESS',
    },
  ],
  sealedTerms: ['검은 테이프', '수동 해제 열쇠', '위조'],
  materialLexicon,
};

export const yoonHaneulContract: CaseContract = {
  suspectId: 'haneul',
  language: 'ko',
  starterQuestions: [
    '사고 전 서혜진 감독과 마지막으로 대화한 게 언제입니까?',
    '왜 소극장 백야의 언더스터디에 지원했습니까?',
    '사고 당시 분장실에 있었다는 사실을 확인할 사람이 있습니까?',
  ],
  initialClaimIds: ['H_DRESSING_ROOM', 'H_NO_ARGUMENT'],
  initialStageId: 'H_COVER',
  stages: [
    {
      id: 'H_COVER',
      strategy:
        '서혜진에게 적대감을 숨기지 않지만 지원 목적과 다툼은 부인한다. 사고 때는 분장실에 있었다고 짧게 답한다.',
      allowedClaimIds: [
        'H_DRESSING_ROOM',
        'H_NO_ARGUMENT',
        'H_RESENTED_HYEJIN',
        'H_DENY',
      ],
    },
    {
      id: 'H_IDENTITY',
      strategy:
        '윤선아가 자신의 어머니이며 사고 기록을 찾으려고 극장에 들어왔음을 인정한다. 살인은 부인한다.',
      allowedClaimIds: [
        'H_SEARCHED_ARCHIVE',
        'H_SUNA_MOTHER',
        'H_NEVER_BELIEVED_REPORT',
        'H_DRESSING_ROOM',
        'H_DENY',
      ],
    },
    {
      id: 'H_ARGUMENT',
      strategy:
        '서혜진과 다퉜고 잔인한 말을 한 사실까지 인정한다. 자신이 원한 것은 죽음이 아니라 공개 고백이었다고 구분한다.',
      allowedClaimIds: [
        'H_SEARCHED_ARCHIVE',
        'H_SUNA_MOTHER',
        'H_ARGUMENT',
        'H_THREAT_WORDS',
        'H_WANTED_PUBLIC_TRUTH',
        'H_HEARD_GYUTAE_MEETING',
        'H_DRESSING_ROOM',
        'H_DENY',
      ],
    },
    {
      id: 'H_CLEARED',
      strategy:
        '복도 영상으로 사고 순간의 알리바이가 확인됐다. 의심에서 벗어나 과거 사고와 서혜진의 마지막 말을 자세히 진술한다.',
      allowedClaimIds: [
        'H_SEARCHED_ARCHIVE',
        'H_SUNA_MOTHER',
        'H_ARGUMENT',
        'H_THREAT_WORDS',
        'H_WANTED_PUBLIC_TRUTH',
        'H_HEARD_GYUTAE_MEETING',
        'H_ALIBI_CONFIRMED',
        'H_DENY',
      ],
    },
  ],
  transitions: [
    {
      from: 'H_COVER',
      to: 'H_IDENTITY',
      whenEvidencePresented: 'E5',
      unlockNotice:
        '12년 전 사고 원본 기록에서 사망 배우 윤선아와 당시 열다섯 살 딸 윤하늘의 관계가 확인됐다.',
      reactionLine:
        '윤선아는 제 어머니예요. 그 사람들은 엄마가 실수해서 죽었다고 했습니다. 저는 한 번도 믿은 적 없어요.',
    },
    {
      from: 'H_IDENTITY',
      to: 'H_ARGUMENT',
      whenEvidencePresented: 'E4',
      unlockNotice:
        '윤하늘은 서혜진과 다퉜고 위협적인 말을 했지만, 서혜진이 다음 날 진실을 공개하려 했다고 진술했다.',
      reactionLine:
        '죽길 바랐던 순간이 없었다고는 말하지 않겠습니다. 하지만 내가 원한 건 추락이 아니라 사람들 앞에서 진실을 말하는 거였어요.',
    },
    {
      from: 'H_ARGUMENT',
      to: 'H_CLEARED',
      whenEvidencePresented: 'E9',
      unlockNotice:
        '복원된 분장실 복도 영상으로 윤하늘은 추락 순간 승강기에 접근할 수 없었음이 확인됐다.',
      reactionLine:
        '이제 제가 어디 있었는지는 확인됐네요. 혜진 씨는 마지막에 “먼저 규태 씨와 끝내야 할 이야기가 있다”고 했어요.',
    },
  ],
  claims: [
    {
      id: 'H_DRESSING_ROOM',
      meaning: '자기 장면이 끝난 뒤 분장실로 갔고 사고 때도 그곳에 있었다고 진술한다.',
      fallbackLine: '제 장면이 끝난 뒤 분장실로 갔고 사고가 날 때도 거기 있었습니다.',
      truth: 'true',
    },
    {
      id: 'H_NO_ARGUMENT',
      meaning: '사고 전 서혜진과 별다른 대화를 하지 않았다고 주장한다.',
      fallbackLine: '그날 감독님과는 별다른 대화를 하지 않았습니다.',
      truth: 'false',
      contradictedBy: ['E4'],
    },
    {
      id: 'H_RESENTED_HYEJIN',
      meaning: '서혜진을 좋아하지 않았고 그 사실을 숨길 생각도 없다고 말한다.',
      fallbackLine: '그 사람을 좋아하지 않았습니다. 그건 숨길 생각도 없어요.',
      truth: 'true',
    },
    {
      id: 'H_DENY',
      meaning: '서혜진을 죽이지 않았다고 부인한다.',
      fallbackLine: '제가 서혜진을 죽인 건 아닙니다.',
      truth: 'true',
    },
    {
      id: 'H_SEARCHED_ARCHIVE',
      meaning: '배우 경력보다 어머니의 사고 기록을 찾으려고 극장 자료실에 몰래 들어갔다고 인정한다.',
      fallbackLine: '어머니의 사고 기록을 찾으려고 자료실에 들어갔습니다.',
      truth: 'true',
    },
    {
      id: 'H_SUNA_MOTHER',
      meaning: '12년 전 이 극장에서 추락사한 윤선아가 자신의 어머니라고 밝힌다.',
      fallbackLine: '12년 전 여기서 죽은 윤선아는 제 어머니입니다.',
      truth: 'true',
    },
    {
      id: 'H_NEVER_BELIEVED_REPORT',
      meaning: '어머니가 진입 시점을 착각했다는 공식 사고 보고서를 한 번도 믿지 않았다고 말한다.',
      fallbackLine: '엄마가 실수했다는 공식 보고서는 한 번도 믿지 않았습니다.',
      truth: 'true',
    },
    {
      id: 'H_ARGUMENT',
      meaning: '사고 전 서혜진과 과거 사고 은폐를 두고 격렬하게 다퉜다고 인정한다.',
      fallbackLine: '사고 전에 혜진 씨와 어머니의 사고를 두고 크게 다퉜습니다.',
      truth: 'true',
    },
    {
      id: 'H_THREAT_WORDS',
      meaning: '서혜진에게 당신도 무대 아래로 떨어져 봐야 한다는 위협적인 말을 했다고 인정한다.',
      fallbackLine: '“당신도 무대 아래로 떨어져 봐야 한다”고 말했습니다.',
      truth: 'true',
    },
    {
      id: 'H_WANTED_PUBLIC_TRUTH',
      meaning: '서혜진의 죽음이 아니라 공개 고백과 과거 사고의 진실을 원했다고 말한다.',
      fallbackLine: '제가 원한 건 죽음이 아니라 공개 고백이었습니다.',
      truth: 'true',
    },
    {
      id: 'H_HEARD_GYUTAE_MEETING',
      meaning: '서혜진이 먼저 이규태와 끝내야 할 이야기가 있다고 말했다고 진술한다.',
      fallbackLine: '혜진 씨는 먼저 규태 씨와 끝내야 할 이야기가 있다고 했습니다.',
      truth: 'true',
    },
    {
      id: 'H_ALIBI_CONFIRMED',
      meaning: '22시 15분 31초부터 추락 뒤인 22시 17분 20초까지 분장실 구역에 있었다고 확인한다.',
      fallbackLine: '22시 15분부터 추락 뒤까지 분장실 구역에 있었습니다.',
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'H_HINT_RECORD',
      text: '윤하늘이 이 극장에 들어온 이유는 12년 전 사고 원본 기록과 연결돼 있다.',
      stageIds: ['H_COVER'],
      targetEvidenceId: 'E5',
    },
    {
      id: 'H_HINT_DRAFT',
      text: '피해자의 공개 성명 초안은 두 사람이 사고 전에 나눈 대화의 목적을 드러낼 수 있다.',
      stageIds: ['H_IDENTITY'],
      targetEvidenceId: 'E4',
    },
    {
      id: 'H_HINT_LAST_WORDS',
      text: '서혜진이 공개 전에 누구와 먼저 이야기하려 했는지 끝까지 확인하자.',
      stageIds: ['H_ARGUMENT', 'H_CLEARED'],
      targetClaimId: 'H_HEARD_GYUTAE_MEETING',
    },
  ],
  sealedTerms: ['윤선아', '어머니', '떨어져 봐야', '규태 씨'],
  materialLexicon,
};

export const leeGyutaeContract: CaseContract = {
  suspectId: 'gyutae',
  language: 'ko',
  starterQuestions: [
    '사고 당시 하역장에서 무엇을 점검하고 있었습니까?',
    '승강기 안전장치가 저절로 풀릴 수 있습니까?',
    '수동 해제 열쇠를 마지막으로 확인한 게 언제입니까?',
  ],
  initialClaimIds: [
    'G_AT_LOADING_DOCK',
    'G_OLD_EQUIPMENT',
    'G_BLAMES_WARNING',
  ],
  initialStageId: 'G_ACCIDENT',
  stages: [
    {
      id: 'G_ACCIDENT',
      strategy:
        '침착하고 기술적인 설명으로 사고를 노후 설비와 장미래의 경고음 차단 탓으로 돌린다. 자신은 하역장에 있었다고 주장한다.',
      allowedClaimIds: [
        'G_AT_LOADING_DOCK',
        'G_OLD_EQUIPMENT',
        'G_BLAMES_WARNING',
        'G_DENY',
      ],
    },
    {
      id: 'G_MANUAL',
      strategy:
        '수동 명령이 기록된 사실은 인정하지만 누가 실행했는지는 알 수 없다고 말한다. 기술을 모르는 심문관을 가르치려 든다.',
      allowedClaimIds: [
        'G_MANUAL_COMMAND',
        'G_AUTHORIZED_STAFF',
        'G_BLAMES_WARNING',
        'G_AT_LOADING_DOCK',
        'G_DENY',
      ],
    },
    {
      id: 'G_KEY',
      strategy:
        '보관함을 연 것은 정기 점검이었다고 둘러댄다. 열쇠를 확인한 것과 사용한 것은 다르다고 주장한다.',
      allowedClaimIds: [
        'G_MANUAL_COMMAND',
        'G_KEY_ROUTINE_CHECK',
        'G_KEY_NOT_PROOF',
        'G_AT_LOADING_DOCK',
        'G_DENY',
      ],
    },
    {
      id: 'G_CORRIDOR',
      strategy:
        '사고 전 서비스 통로에 있었음을 인정하되 안개 장비 전원을 확인하러 갔다고 주장한다.',
      allowedClaimIds: [
        'G_MANUAL_COMMAND',
        'G_KEY_ROUTINE_CHECK',
        'G_WENT_CORRIDOR',
        'G_CHECKED_FOG_MACHINE',
        'G_DENY',
      ],
    },
    {
      id: 'G_TIMELINE',
      strategy:
        '세 기록의 순서를 인정하지 않고 장치 시계가 동기화되지 않았다고 공격한다. 마지막까지 자백하지 않는다.',
      allowedClaimIds: [
        'G_MANUAL_COMMAND',
        'G_WENT_CORRIDOR',
        'G_CLOCKS_UNSYNCED',
        'G_RECORDS_NOT_PROOF',
        'G_DENY',
      ],
    },
  ],
  transitions: [
    {
      from: 'G_ACCIDENT',
      to: 'G_MANUAL',
      whenEvidencePresented: 'E1',
      unlockNotice:
        '승강기는 기계 고장이 아니라 수동 해제 명령을 받고 정상적으로 내려갔다.',
      reactionLine:
        '수동 명령이 찍힌 건 인정하죠. 하지만 그 기록에는 누가 조작했는지 나오지 않습니다. 오래된 장비 로그 하나로 사람을 정할 순 없어요.',
    },
    {
      from: 'G_MANUAL',
      to: 'G_KEY',
      whenEvidencePresented: 'E6',
      unlockNotice:
        '사고 4분 전 이규태의 직원 태그로 수동 해제 열쇠 보관함이 열렸다.',
      reactionLine:
        '보관함을 연 건 맞습니다. 정기 점검 때문에 열쇠가 있는지 확인했을 뿐입니다. 확인한 것과 사용한 것은 다르죠.',
    },
    {
      from: 'G_KEY',
      to: 'G_CORRIDOR',
      whenEvidencePresented: 'E7',
      unlockNotice:
        '복원 영상에서 이규태가 추락 전에 수동 조작반이 있는 서비스 통로로 들어간 모습이 확인됐다.',
      reactionLine:
        '통로에 있었던 것은 맞습니다. 안개 장비 전원 상태를 보러 간 겁니다. 그게 승강기를 열었다는 뜻은 아니죠.',
    },
    {
      from: 'G_CORRIDOR',
      to: 'G_TIMELINE',
      whenEvidencePresented: 'E8',
      unlockNotice:
        '조명 콘솔·무대 음향·통로 영상이 모두 암전, 승강기 구동, 발걸음, 추락의 같은 순서를 가리킨다.',
      reactionLine:
        '극장 장치들의 시계는 완전히 동기화돼 있지 않습니다. 기록 세 개를 겹쳤다고 그 순서가 절대적인 사실이 되는 건 아니죠.',
    },
  ],
  claims: [
    {
      id: 'G_AT_LOADING_DOCK',
      meaning: '사고 당시 하역장에서 안개 장비를 점검하고 있었다고 주장한다.',
      fallbackLine: '사고 당시 저는 하역장에서 안개 장비를 점검하고 있었습니다.',
      truth: 'false',
      contradictedBy: ['E7'],
    },
    {
      id: 'G_OLD_EQUIPMENT',
      meaning: '노후한 승강기 설비에서는 이런 사고가 충분히 일어날 수 있다고 주장한다.',
      fallbackLine: '이렇게 오래된 설비라면 오작동 사고는 충분히 일어날 수 있습니다.',
      truth: 'false',
      contradictedBy: ['E1'],
    },
    {
      id: 'G_BLAMES_WARNING',
      meaning: '장미래가 경고 시스템을 임의로 막은 것이 사고의 핵심 원인이라고 강조한다.',
      fallbackLine: '장미래 씨가 경고 시스템을 막은 사실부터 확인해야 합니다.',
      truth: 'partial',
    },
    {
      id: 'G_DENY',
      meaning: '자신은 서혜진을 살해하지 않았다고 끝까지 부인한다.',
      fallbackLine: '저는 서혜진 씨를 살해하지 않았습니다.',
      truth: 'false',
    },
    {
      id: 'G_MANUAL_COMMAND',
      meaning: '승강기가 수동 해제 명령을 받아 내려간 사실 자체는 인정한다.',
      fallbackLine: '승강기에 수동 해제 명령이 들어간 사실은 인정합니다.',
      truth: 'true',
    },
    {
      id: 'G_AUTHORIZED_STAFF',
      meaning: '수동 조작 절차를 아는 직원이 자신 말고도 있다고 주장한다.',
      fallbackLine: '수동 조작 절차를 아는 직원이 저 하나뿐인 건 아닙니다.',
      truth: 'partial',
    },
    {
      id: 'G_KEY_ROUTINE_CHECK',
      meaning: '22시 12분 열쇠 보관함을 연 것은 정기 점검을 위한 확인이었다고 주장한다.',
      fallbackLine: '22시 12분 보관함을 연 건 정기 점검을 위한 확인이었습니다.',
      truth: 'false',
    },
    {
      id: 'G_KEY_NOT_PROOF',
      meaning: '열쇠 보관함을 연 기록은 열쇠를 실제 사용했다는 증거가 아니라고 주장한다.',
      fallbackLine: '보관함을 열었다고 그 열쇠를 사용했다는 뜻은 아닙니다.',
      truth: 'partial',
    },
    {
      id: 'G_WENT_CORRIDOR',
      meaning: '추락 전에 무대 좌측 서비스 통로에 들어간 사실을 인정한다.',
      fallbackLine: '사고 전에 무대 좌측 서비스 통로에 들어간 것은 맞습니다.',
      truth: 'true',
    },
    {
      id: 'G_CHECKED_FOG_MACHINE',
      meaning: '서비스 통로에는 안개 장비 전원 상태를 확인하러 갔다고 주장한다.',
      fallbackLine: '통로에는 안개 장비 전원 상태를 확인하러 간 겁니다.',
      truth: 'false',
    },
    {
      id: 'G_CLOCKS_UNSYNCED',
      meaning: '조명 콘솔, 음향 녹음, 통로 카메라의 시계가 동기화되지 않았다고 공격한다.',
      fallbackLine: '그 장치들의 시계는 서로 완전히 동기화돼 있지 않습니다.',
      truth: 'false',
    },
    {
      id: 'G_RECORDS_NOT_PROOF',
      meaning: '세 기록이 자신이 열쇠를 돌렸다는 장면을 직접 보여 주지는 않는다고 버틴다.',
      fallbackLine: '그 기록 어디에도 제가 열쇠를 돌리는 장면은 없습니다.',
      truth: 'partial',
    },
  ],
  hints: [
    {
      id: 'G_HINT_MANUAL',
      text: '노후 설비 사고라는 설명부터 승강기 제어 로그와 대조하자.',
      stageIds: ['G_ACCIDENT'],
      targetEvidenceId: 'E1',
    },
    {
      id: 'G_HINT_KEY',
      text: '수동 해제에는 열쇠가 필요하다. 사고 직전 보관함을 연 사람을 확인하자.',
      stageIds: ['G_MANUAL'],
      targetEvidenceId: 'E6',
    },
    {
      id: 'G_HINT_CORRIDOR',
      text: '열쇠 접근만으로는 부족하다. 사고 직전 이규태의 실제 동선을 복원해야 한다.',
      stageIds: ['G_KEY'],
      targetEvidenceId: 'E7',
    },
    {
      id: 'G_HINT_ORDER',
      text: '그는 기록의 시각을 공격한다. 서로 독립된 장치 세 개가 보여 주는 사건 순서를 맞대자.',
      stageIds: ['G_CORRIDOR'],
      targetEvidenceId: 'E8',
    },
  ],
  sealedTerms: [
    '22시 12분',
    '수동 해제 열쇠',
    '서비스 통로',
    '안개 장비',
    '시계는',
  ],
  materialLexicon,
};
