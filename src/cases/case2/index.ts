import type { CaseDefinition } from '../../engine/case';
import type { Evidence } from '../../engine/types';
import { kimMancheolContract } from './contract';

const evidences: Evidence[] = [
  {
    id: 'E01',
    name: '사건 개요서',
    description:
      '금요일 23:41경 ○○사거리. 배달 오토바이를 충격한 차량이 정차하지 않고 현장을 이탈했다.',
    view: {
      type: 'document',
      title: '사건 개요서',
      documentNumber: '사건 2026-0723-2341',
      organization: '○○경찰서 교통범죄수사팀',
      fields: [
        { label: '발생 시각', value: '금요일 23:41경' },
        { label: '발생 장소', value: '○○사거리 남동측 교차로' },
        { label: '피해자', value: '박진우(27), 배달 라이더' },
        { label: '피해 상태', value: '의식불명 중태' },
      ],
      note: '피해자는 생존해 있으나 아직 진술할 수 없다.',
    },
  },
  {
    id: 'E02',
    name: '김만철 자수 조서',
    description:
      '“내가 운전했다. 라이더가 오른쪽에서 튀어나왔다. 사고 뒤 곧장 집으로 갔다. 술은 마시지 않았다.”',
    view: {
      type: 'document',
      title: '자수 조서',
      documentNumber: '자수조서 26-0723-KM',
      organization: '○○경찰서',
      fields: [
        { label: '자수자', value: '김만철(54), 개인택시 기사' },
        { label: '운전자', value: '본인' },
        { label: '충돌 상황', value: '오토바이가 오른쪽에서 갑자기 진입' },
        { label: '사고 이후', value: '곧장 귀가' },
        { label: '음주 여부', value: '부인' },
      ],
      note: '08:40 택시로 경찰서에 도착해 자수했다.',
    },
  },
  {
    id: 'E03',
    name: '차량 감식 1차',
    description:
      '자택에서 견인한 차량의 우측 전면 펜더가 파손돼 있다. 운전석은 최전방·최상단 위치다.',
    view: {
      type: 'document',
      title: '차량 감식 사진 기록',
      documentNumber: '차량감식 E03',
      organization: '○○경찰서 교통범죄수사팀',
      fields: [
        { label: '촬영 시각', value: '토요일 09:26' },
        { label: '촬영 장소', value: '김만철 자택 주차장 · 견인 전' },
        { label: '외관', value: '우측 전면 펜더 충격 파손' },
        { label: '운전석', value: '최전방 · 최상단 위치' },
      ],
      note: '경찰이 차량에 손대기 전 촬영해 사고 뒤 운전석 위치를 보존했다.',
    },
  },
  {
    id: 'E04',
    name: '현장 사진',
    description:
      '노면에 제동 흔적이 없다. 수사상 비공개인 현장 세부 일부는 가려져 있다.',
    view: {
      type: 'document',
      title: '현장 감식 사진 기록',
      documentNumber: '현장사진 E04',
      organization: '○○경찰서 과학수사팀',
      fields: [
        { label: '촬영 시각', value: '금요일 23:58' },
        { label: '촬영 장소', value: '○○사거리 충돌 지점' },
        { label: '제동 흔적', value: '스키드마크 없음' },
        { label: '비공개 영역', value: '수사 목적상 마스킹' },
      ],
      note: '비공개 현장 세부의 정답은 떠보기 전후에도 피조사자에게 공개하지 않는다.',
    },
  },
  {
    id: 'E05',
    name: '통신 기록',
    description: '23:52 김서연이 김만철에게 전화해 4분 08초 통화했다.',
    view: {
      type: 'document',
      title: '통신자료 회신',
      documentNumber: '통신영장 회신 T-2352',
      organization: '통신사 영장 회신',
      fields: [
        { label: '발신', value: '김서연' },
        { label: '수신', value: '김만철' },
        { label: '시작', value: '23:52:11' },
        { label: '통화 시간', value: '4분 08초' },
      ],
      note: '통화 내용은 녹음돼 있지 않다.',
    },
  },
  {
    id: 'E06',
    name: '카드 결제 내역',
    description:
      '23:47 왕곱창에서 김만철 명의 카드로 87,000원이 결제됐다. 4인분과 소주 3병이 포함돼 있다.',
    view: {
      type: 'document',
      title: '카드 거래 내역',
      documentNumber: '카드승인 2347-87000',
      organization: '카드사 거래 내역',
      fields: [
        { label: '승인 시각', value: '금요일 23:47:03' },
        { label: '가맹점', value: '왕곱창' },
        { label: '금액', value: '87,000원' },
        { label: '내역', value: '곱창 4인분 · 소주 3병' },
      ],
      note: '가맹점에서 사고 지점까지 차량으로 약 15분이 걸린다.',
    },
  },
  {
    id: 'F01',
    name: '시트 포지션 재연 실험',
    description:
      '김만철의 신체 조건으로는 보존된 운전석 위치에서 브레이크와 가속 페달을 정상 조작할 수 없다.',
    view: {
      type: 'document',
      title: '교통 감정서',
      documentNumber: '교통감식 F01',
      organization: '도로교통 감정실',
      fields: [
        { label: '피실험자', value: '김만철 · 178cm' },
        { label: '보존 위치', value: '시트 최전방 · 최상단' },
        { label: '재연 결과', value: '무릎 간섭으로 페달 정상 조작 불가' },
        { label: '추정 범위', value: '150cm대 운전자에게 부합' },
      ],
      note: 'E03의 견인 전 사진과 동일한 위치에서 재연했다.',
    },
  },
  {
    id: 'F02',
    name: '운전석 미세 흔적',
    description:
      '핸들과 에어백에서 염색한 장모발 한 점이 발견됐다. 신원은 아직 특정되지 않았다.',
    view: {
      type: 'document',
      title: '미세증거 감정서',
      documentNumber: '미세증거 F02',
      organization: '국립과학수사연구원',
      fields: [
        { label: '채취 위치', value: '핸들 하단 · 운전석 에어백' },
        { label: '형태', value: '염색한 장모발 1점' },
        { label: 'DNA', value: '부분 프로필 확보' },
        { label: '대조 결과', value: '대조 시료 영장 미발부' },
      ],
      note: '단독으로 운전자를 특정할 수 없는 보조 정황이다.',
    },
  },
  {
    id: 'F03',
    name: '왕곱창 CCTV',
    description:
      '23:50까지 김만철이 식당에 앉아 술을 마시는 모습이 확인된다. 퇴점 시각은 23:55다.',
    view: {
      type: 'document',
      title: 'CCTV 영상 분석서',
      documentNumber: '왕곱창 CCTV F03',
      organization: '○○경찰서 디지털증거분석실',
      fields: [
        { label: '23:50:19', value: '김만철이 동석자 세 명과 테이블에 앉아 있음' },
        { label: '음주 장면', value: '잔을 들어 마시는 모습 확인' },
        { label: '23:55', value: '김만철 퇴점' },
        { label: '영상 상태', value: '중단 없는 연속 원본' },
      ],
      note: '사고 시각 전후 김만철이 식당에 머문 장면이 연속으로 확인된다.',
    },
  },
  {
    id: 'F04',
    name: '도주 동선 CCTV',
    description:
      '사고 차량은 집과 반대 방향으로 좌회전한 뒤 약 300m 앞에서 불법 유턴했다.',
    view: {
      type: 'document',
      title: '방범영상 분석서',
      documentNumber: '방범영상 분석 F04',
      organization: '○○시 통합관제센터',
      fields: [
        { label: '23:41:18', value: '○○사거리에서 반대 방향 좌회전' },
        { label: '23:42:02', value: '약 300m 전방 진입' },
        { label: '23:42:21', value: '중앙선 침범 불법 유턴' },
        { label: '이후', value: '주거지 방향으로 진행' },
      ],
      note: '25년 경력 택시기사의 익숙한 귀가 동선과 일치하지 않는다.',
    },
  },
  {
    id: 'F05',
    name: '피해자 배달 기록',
    description:
      '피해자는 제한속도 범위에서 직진 중이었다. 오른쪽에서 갑자기 진입했다는 자백과 맞지 않는다.',
    view: {
      type: 'document',
      title: '배달기록 분석서',
      documentNumber: '배달플랫폼 회신 F05',
      organization: '배달플랫폼 안전대응팀',
      fields: [
        { label: '배차 시각', value: '23:34' },
        { label: '진행 방향', value: '북측 차로 직진' },
        { label: '충돌 직전 속도', value: '시속 34km' },
        { label: '도로 제한속도', value: '시속 40km' },
      ],
      note: '앱 GPS와 오토바이 단말 기록을 교차 확인했다.',
    },
  },
  {
    id: 'F06',
    name: '휴대폰·에어백 결합 감정',
    description:
      '사고 시각 김서연 휴대폰이 차량·현장에 있었고, 운전석 에어백 접촉 DNA가 김서연 대조 시료와 일치했다.',
    view: {
      type: 'document',
      title: '디지털포렌식 감정서',
      documentNumber: '추가영장 감정 F06',
      organization: '디지털포렌식계',
      fields: [
        { label: '연결 기기', value: '김서연 명의 휴대폰' },
        { label: '차량 연결', value: '23:34~23:48 자동 연결 유지' },
        { label: '기지국', value: '23:41 ○○사거리 권역 접속' },
        { label: '운전석 에어백', value: '접촉 상피세포 DNA가 김서연 대조 시료와 일치' },
      ],
      note:
        '실제 수사·재판의 영장 및 증명 기준을 단순화한 게임적 각색이다.',
    },
  },
  {
    id: 'R_M6',
    name: '떠보기 반응 기록',
    description:
      '현장 비공개 세부를 묻자 김만철은 구체적으로 답하지 못하고 기억이 없다는 말만 반복했다.',
    view: {
      type: 'document',
      title: '심문 반응 기록',
      documentNumber: '심문 반응 R-M6',
      organization: '○○경찰서 조사실',
      fields: [
        { label: '질문 유형', value: '수사상 비공개 현장 세부' },
        { label: '응답', value: '구체 답변 회피' },
        { label: '공개 여부', value: '정답은 피조사자에게 공개하지 않음' },
      ],
      note: '이 반응만으로 운전자를 단정할 수 없다.',
    },
  },
  {
    id: 'M1',
    name: '확정 모순 M1 · 운전석',
    description:
      '김만철이 운전했다는 자백은 차량에 보존된 시트 위치와 신체 재연 결과상 물리적으로 불가능하다.',
    view: {
      type: 'document',
      title: '수사 논증 기록',
      documentNumber: '확정 모순 M1',
      organization: '수사 논증 기록',
      fields: [
        { label: '진술', value: '“내가 운전했다.”' },
        { label: '증거 조합', value: 'E03 + F01' },
        { label: '판정', value: '물리적 불가능' },
      ],
      note: '엔진이 증거 조합과 기록된 진술을 확인해 생성했다.',
    },
  },
  {
    id: 'M2',
    name: '확정 모순 M2 · 알리바이',
    description:
      '사고 시각 김만철은 왕곱창에 있었으므로 현장에서 운전할 수 없었다.',
    view: {
      type: 'document',
      title: '수사 논증 기록',
      documentNumber: '확정 모순 M2',
      organization: '수사 논증 기록',
      fields: [
        { label: '진술', value: '“내가 운전했고 술은 마시지 않았다.”' },
        { label: '증거 조합', value: 'E06 + F03' },
        { label: '판정', value: '물리적 불가능' },
      ],
      note: '결제 시각과 연속 CCTV를 함께 확인했다.',
    },
  },
  {
    id: 'M3',
    name: '확정 모순 M3 · 충돌 방향',
    description:
      '피해자는 직진 중이었으므로 오른쪽에서 갑자기 튀어나왔다는 자백과 맞지 않는다.',
    view: {
      type: 'document',
      title: '수사 논증 기록',
      documentNumber: '확정 모순 M3',
      organization: '수사 논증 기록',
      fields: [
        { label: '진술', value: '“오토바이가 오른쪽에서 튀어나왔다.”' },
        { label: '증거', value: 'F05' },
        { label: '판정', value: '객관 기록과 불일치' },
      ],
      note: '피해자의 과실 여부와 별개로 진행 방향만 판정한다.',
    },
  },
  {
    id: 'M4',
    name: '확정 모순 M4 · 도주 동선',
    description:
      '차량이 반대 방향으로 달렸다가 불법 유턴했으므로 곧장 집으로 갔다는 자백과 맞지 않는다.',
    view: {
      type: 'document',
      title: '수사 논증 기록',
      documentNumber: '확정 모순 M4',
      organization: '수사 논증 기록',
      fields: [
        { label: '진술', value: '“사고 뒤 곧장 집으로 갔다.”' },
        { label: '증거', value: 'F04' },
        { label: '판정', value: '객관 기록과 불일치' },
      ],
      note: '운전 경력에 관한 평가는 보조 정황일 뿐이다.',
    },
  },
  {
    id: 'M6',
    name: '확정 모순 M6 · 현장 지식',
    description:
      '운전자라면 접했을 비공개 현장 세부를 김만철은 설명하지 못했다.',
    view: {
      type: 'document',
      title: '수사 논증 기록',
      documentNumber: '확정 모순 M6',
      organization: '수사 논증 기록',
      fields: [
        { label: '절차', value: 'E04 비공개 정보 떠보기' },
        { label: '반응', value: 'R_M6 구체 답변 회피' },
        { label: '판정', value: '자백 신빙성 약화' },
      ],
      note: '단독 유죄 증거가 아닌 보조 모순으로만 사용한다.',
    },
  },
];

export const case2: CaseDefinition = {
  id: 'case2',
  title: '23:47 — 완벽한 자백',
  briefing:
    '배달 라이더가 의식불명에 빠진 뺑소니 사건 다음 날 아침, 차주 김만철이 택시를 타고 경찰서에 와 완벽하게 준비된 자백을 내놓았다. 이번 심문의 목표는 자백을 받는 것이 아니라 그 자백이 거짓임을 증명하는 것이다.',
  maxTurns: 18,
  evidences,
  suspects: [
    {
      id: 'mancheol',
      name: '김만철',
      role: '자백자 · 개인택시 기사',
      persona:
        '54세. 과묵하고 공손한 25년 무사고 개인택시 기사다. 화를 내기보다 자신의 삶이 무너지는 것을 조용히 감수하며 누군가를 지키려 한다.',
      portrait: '만',
      introLine:
        '김만철은 서명한 자수 조서를 가지런히 밀어 놓는다. “제가 운전했습니다. 더 복잡할 것 없습니다.”',
      contract: kimMancheolContract,
    },
  ],
  initialEvidenceIds: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06'],
  initialSuspectIds: ['mancheol'],
  unlocks: [],
  motiveOptions: [
    { id: 'protect_daughter', label: '딸의 범행과 앞날을 보호' },
    { id: 'protect_license', label: '개인택시 면허를 보호' },
    { id: 'insurance_fraud', label: '보험금을 노린 공모' },
  ],
  methodOptions: [
    { id: 'false_confession', label: '사후에 준비한 허위 자백' },
    { id: 'hit_and_run', label: '김만철 본인의 도주치상' },
    { id: 'evidence_tampering', label: '차량 감식 결과 조작' },
  ],
  solution: {
    culpritId: 'seoyeon',
    motiveId: 'protect_daughter',
    methodId: 'false_confession',
    proofEvidenceChains: [
      ['M1', 'M2', 'M3', 'F06'],
      ['M1', 'M2', 'M4', 'F06'],
      ['M1', 'M2', 'M6', 'F06'],
      ['M1', 'M3', 'M4', 'F06'],
      ['M1', 'M3', 'M6', 'F06'],
      ['M1', 'M4', 'M6', 'F06'],
      ['M2', 'M3', 'M4', 'F06'],
      ['M2', 'M3', 'M6', 'F06'],
      ['M2', 'M4', 'M6', 'F06'],
    ],
    epilogue:
      '사고 차량·현장·운전석 에어백을 김서연의 휴대폰과 DNA가 잇고, 김만철의 자백은 물리 기록 앞에서 무너졌다. 법률 적용은 실제 한국법을 참고해 게임적으로 각색됐다.',
  },
  psychologyTrial: {
    minimumTurnsBeforeForensics: 2,
    forensicSelectionCount: 3,
    forensicOptions: [
      {
        id: 'FORENSIC_SEAT',
        evidenceId: 'F01',
        label: '시트 포지션 재연',
        description: '보존된 운전석 위치를 김만철의 신체 조건으로 재연한다.',
        resolution: 'COMBINATION',
        targetContradictionId: 'M1',
        requiredEvidenceIds: ['E03'],
        opportunityCost:
          '선택하지 않으면 운전석 위치로 자백의 물리적 불가능을 확정할 수 없다.',
      },
      {
        id: 'FORENSIC_TRACE',
        evidenceId: 'F02',
        label: '운전석 미세 흔적',
        description: '핸들·에어백의 모발과 접촉 흔적을 분석한다.',
        resolution: 'SUPPORT',
        requiredEvidenceIds: [],
        opportunityCost:
          '단독 확정 모순이 없다. 이 슬롯을 쓰면 다른 확정 경로 하나를 포기한다.',
      },
      {
        id: 'FORENSIC_RESTAURANT',
        evidenceId: 'F03',
        label: '왕곱창 CCTV',
        description: '결제 전후 식당 영상을 확보해 김만철의 위치를 확인한다.',
        resolution: 'COMBINATION',
        targetContradictionId: 'M2',
        requiredEvidenceIds: ['E06'],
        opportunityCost:
          '선택하지 않으면 카드 기록만으로 사고 시각 알리바이를 확정할 수 없다.',
      },
      {
        id: 'FORENSIC_ROUTE',
        evidenceId: 'F04',
        label: '도주 동선 CCTV',
        description: '사고 뒤 차량의 실제 이동 경로를 복원한다.',
        resolution: 'DIRECT',
        targetContradictionId: 'M4',
        requiredEvidenceIds: [],
        opportunityCost:
          '선택하지 않으면 “곧장 귀가” 진술을 동선 기록으로 확정 반박할 수 없다.',
      },
      {
        id: 'FORENSIC_RIDER',
        evidenceId: 'F05',
        label: '피해자 배달 기록',
        description: '피해 오토바이의 충돌 직전 방향과 속도를 확인한다.',
        resolution: 'DIRECT',
        targetContradictionId: 'M3',
        requiredEvidenceIds: [],
        opportunityCost:
          '선택하지 않으면 충돌 방향에 관한 자백을 객관 기록으로 확정 반박할 수 없다.',
      },
    ],
    probes: [
      {
        id: 'PROBE_SCENE_DETAIL',
        evidenceId: 'E04',
        question: '현장에 쏟아져 있던 것이 무엇인지 기억하십니까?',
        reactionLine:
          '“경황이 없었습니다. 뭔가 흩어져 있던 것 같긴 한데… 기억나지 않습니다.”',
        resultEvidenceId: 'R_M6',
        contradictionId: 'M6',
      },
    ],
    contradictions: [
      {
        id: 'M1',
        label: '운전석 위치상 운전 불가능',
        kind: 'PHYSICAL',
        requiredClaimIds: ['C_I_DROVE'],
        evidencePaths: [['E03', 'F01']],
        recordEvidenceId: 'M1',
        commitment: {
          claimIds: ['C_SEAT_ALWAYS_FORWARD'],
          notice:
            '평소에도 시트를 앞으로 당겼다는 주장을 재확인했다. 신체 재연으로 검증할 수 있다.',
        },
      },
      {
        id: 'M2',
        label: '사고 시각 식당 체류',
        kind: 'PHYSICAL',
        requiredClaimIds: ['C_I_DROVE', 'C_SOBER'],
        evidencePaths: [['E06', 'F03']],
        recordEvidenceId: 'M2',
        commitment: {
          claimIds: ['C_RESTAURANT_PRESENT', 'C_CARD_LEFT_BEHIND'],
          notice:
            '카드 결제 시각과 자백의 동선이 고정됐다. 왕곱창 연속 영상으로 검증할 수 있다.',
        },
      },
      {
        id: 'M3',
        label: '피해자의 실제 진행 방향',
        kind: 'SUPPORTING',
        requiredClaimIds: ['C_RIDER_RIGHT'],
        evidencePaths: [['F05']],
        recordEvidenceId: 'M3',
        commitment: {
          claimIds: ['C_RIDER_RIGHT'],
          notice:
            '오토바이가 오른쪽에서 진입했다는 방향 진술을 재확인했다.',
        },
      },
      {
        id: 'M4',
        label: '도주 차량의 실제 동선',
        kind: 'SUPPORTING',
        requiredClaimIds: ['C_HOME_DIRECT'],
        evidencePaths: [['F04']],
        recordEvidenceId: 'M4',
        commitment: {
          claimIds: ['C_HOME_DIRECT'],
          notice:
            '사고 뒤 곧장 귀가했다는 동선을 재확인했다. CCTV로 검증할 수 있다.',
        },
      },
      {
        id: 'M6',
        label: '비공개 현장 지식 부재',
        kind: 'SUPPORTING',
        requiredClaimIds: ['C_I_DROVE'],
        evidencePaths: [['E04', 'R_M6']],
        recordEvidenceId: 'M6',
        commitment: {
          claimIds: ['C_MEMORY_BLANK'],
          notice:
            '현장 세부를 기억하지 못한다는 답을 반복했다. 비공개 정보 떠보기로 검증할 수 있다.',
        },
      },
    ],
    stageRules: [
      { stageId: 'ST_CONFESSION', minimumContradictions: 0 },
      { stageId: 'ST_PATCH', minimumContradictions: 1 },
      { stageId: 'ST_RIGID', minimumContradictions: 2 },
      {
        stageId: 'ST_DILEMMA',
        minimumContradictions: 3,
        minimumPhysicalContradictions: 1,
      },
    ],
    initialStageId: 'ST_CONFESSION',
    finaleStageId: 'ST_COLLAPSE',
    automaticFinaleAtStage: false,
    sincereStageId: 'ST_SINCERE',
    finaleAnchorLine: '“형사님은… 자식 있습니까.”',
    finaleChoices: [
      {
        id: 'FINALE_EMPATHY',
        label: '지키고 싶은 마음은 이해한다고 답한다',
        responseLine:
          '김만철은 한참 고개를 숙인 뒤 말했다. “서연이가 운전했습니다. 술도 마셨고요. 그 애가 저한테 전화했습니다. 제가 대신 끝내려고 했습니다.”',
        sincerity: true,
      },
      {
        id: 'FINALE_DUTY',
        label: '자식 이야기는 기록과 무관하다고 답한다',
        responseLine:
          '김만철은 다시 자수 조서만 바라봤다. “그럼 기록대로 하십시오. 운전한 사람은 접니다.” 그는 끝까지 이름을 말하지 않았다.',
        sincerity: false,
      },
      {
        id: 'FINALE_SILENCE',
        label: '대답하지 않고 기다린다',
        responseLine:
          '긴 침묵 끝에 김만철이 먼저 입을 열었다. “서연이가 운전했습니다. 전화가 왔어요. 살려 달라고… 그래서 제가 한 일입니다.”',
        sincerity: true,
      },
    ],
    autoEvidenceUnlocks: [
      {
        evidenceId: 'F06',
        minimumContradictions: 3,
        minimumPhysicalContradictions: 1,
      },
    ],
    specialConfrontations: [
      {
        id: 'EXPOSE_DAUGHTER_DRIVER',
        evidenceId: 'F06',
        targetStageId: 'ST_COLLAPSE',
        targetPhase: 'FINALE',
        notice: '보호 대상 특정 — 허위 자백의 목적이 무너졌다.',
        reactionLine:
          '김만철은 감정서의 이름을 오래 바라봤다. “김서연은 제 딸입니다. 통화한 것도 맞습니다.” 자수 조서를 다시 자기 쪽으로 당겼다. “하지만 운전한 사람은 접니다. 그 아이는 부르지 마십시오.”',
        recordClaimIds: [
          'C_DAUGHTER_IDENTITY',
          'C_CALL_OCCURRED',
          'C_I_DROVE',
          'C_DAUGHTER_UNRELATED',
        ],
      },
    ],
  },
  court: {
    candidates: [
      {
        id: 'mancheol',
        label: '김만철',
        description: '차량 소유자이자 스스로 운전자라고 자백한 아버지',
      },
      {
        id: 'seoyeon',
        label: '김서연',
        description: '사고 직후 김만철에게 전화한 딸',
      },
      {
        id: 'none',
        label: '불기소',
        description: '현재 증거만으로는 누구도 기소하지 않는다',
      },
    ],
    charges: [
      {
        id: 'hit_and_run',
        label: '도주치상',
        description: '피해자를 충격하고 필요한 조치 없이 현장을 이탈했다',
      },
      {
        id: 'offender_harboring',
        label: '범인도피',
        description: '실제 운전자를 숨기기 위해 허위 자백했다',
      },
      {
        id: 'other',
        label: '기타',
        description: '현재 구성으로 특정할 수 없는 다른 혐의를 적용한다',
      },
    ],
    issues: [
      {
        id: 'ISSUE_FALSE_CONFESSION',
        label: '김만철의 자백은 물리적으로 가능한가',
        description:
          '운전석 위치 또는 사고 시각의 객관적 기록으로 자백의 물리적 가능성을 판단한다.',
        kind: 'PHYSICAL',
        acceptedArguments: [
          {
            contradictionId: 'M1',
            requiredEvidenceIds: ['E03', 'F01'],
          },
          {
            contradictionId: 'M2',
            requiredEvidenceIds: ['E06', 'F03'],
          },
        ],
      },
      {
        id: 'ISSUE_CONFESSION_RELIABILITY',
        label: '자백의 세부 묘사는 믿을 수 있는가',
        description:
          '충돌 방향·도주 동선·비공개 현장 지식 중 확정된 모순으로 자백의 신빙성을 판단한다.',
        kind: 'SUPPORTING',
        acceptedArguments: [
          {
            contradictionId: 'M3',
            requiredEvidenceIds: ['F05'],
          },
          {
            contradictionId: 'M4',
            requiredEvidenceIds: ['F04'],
          },
          {
            contradictionId: 'M6',
            requiredEvidenceIds: ['E04', 'R_M6'],
          },
        ],
      },
      {
        id: 'ISSUE_TRUE_DRIVER',
        label: '실제 운전자를 누구로 특정할 수 있는가',
        description:
          '김만철의 물리적 불가능성과 휴대폰·운전석 에어백 결합 감정을 함께 검토한다.',
        kind: 'SUPPORTING',
        acceptedArguments: [
          {
            contradictionId: 'M1',
            requiredEvidenceIds: ['F06'],
          },
          {
            contradictionId: 'M2',
            requiredEvidenceIds: ['F06'],
          },
        ],
      },
    ],
    correctAccusedId: 'seoyeon',
    correctChargeId: 'hit_and_run',
    noProsecutionCandidateId: 'none',
    coverConfessorId: 'mancheol',
    relativeExceptionChargeId: 'offender_harboring',
    minimumIssues: 3,
    requiredIssueKinds: ['PHYSICAL', 'SUPPORTING'],
    endings: {
      TRUTH_CONVICTION: {
        title: '진실 · 완벽하지 않았던 자백',
        summary:
          '세 쟁점이 모두 인정됐다. 김서연이 실제 운전자로 판단되고 도주치상 혐의가 유죄로 인정된다.',
        epilogue:
          '박진우는 공판이 끝난 뒤 의식을 회복했다. 김만철은 친족 관계에 관한 특례로 별도 처벌을 받지 않았지만, 선고 날 법정 밖에서 “차라리 저를 처벌해 달라”고 말했다. 법률 적용은 게임적으로 각색됐다.',
        win: true,
      },
      SELF_SURRENDER: {
        title: '히든 · 아버지의 마지막 설득',
        summary:
          '심문실에서 진심을 말한 김만철이 딸을 설득했다. 김서연은 공판 전 스스로 사고를 인정했다.',
        epilogue:
          '김서연의 자백과 객관 증거가 일치했고 자수 정상이 참작됐다. 김만철은 딸 옆에 앉아 끝까지 판결을 들었다. 가장 좋은 결말은 심문을 잘한 사람보다 끝까지 인간으로 남은 사람에게 열렸다.',
        win: true,
      },
      WRONGFUL_CONVICTION: {
        title: '오판 · 자백이라는 함정',
        summary:
          '김만철의 자백을 운전자 특정의 근거로 받아들였다. 준비된 거짓말이 물리 기록보다 앞섰다.',
        epilogue:
          '수개월 뒤 의식을 회복한 박진우가 말했다. “운전자는 젊은 여자였습니다.” 김만철 사건의 재심이 시작됐지만 김서연의 행방과 초기 증거는 이미 흐려진 뒤였다.',
        win: false,
      },
      ACQUITTAL_INSUFFICIENT: {
        title: '공판 패배 · 의심만으로는 부족하다',
        summary:
          '김서연을 지목했지만 세 쟁점을 완성하지 못했다. 김만철의 자백을 뒤집을 증명이 충분하지 않았다.',
        epilogue:
          '재판부는 합리적 의심을 배제할 증거가 부족하다며 무죄를 선고했다. 김만철의 자백은 기록에 남았고, 진실은 법정에서 사실이 되지 못했다.',
        win: false,
      },
      RELATIVE_EXCEPTION: {
        title: '법리 실패 · 처벌할 수 없는 자백자',
        summary:
          '김만철을 범인도피 혐의로 세웠지만 친족 관계에 관한 특례가 적용됐다.',
        epilogue:
          '김만철은 처벌받지 않았고 실제 운전자에 대한 공소도 제기되지 않았다. 실제 한국법을 참고했으나 본 결과의 적용 범위와 절차는 게임적으로 단순화됐다.',
        win: false,
      },
      CHARGE_MISMATCH: {
        title: '공소 실패 · 맞는 사람, 틀린 죄명',
        summary:
          '김서연을 지목했지만 사고 기록과 맞지 않는 죄명을 선택했다.',
        epilogue:
          '공소사실은 핵심 구성요건을 특정하지 못해 유지되지 않았다. 진실을 알아낸 것과 법정에서 증명한 것은 같은 일이 아니었다.',
        win: false,
      },
      UNRESOLVED: {
        title: '미제 · 닫지 못한 기록',
        summary: '누구도 기소하지 않았다. 자백과 물증의 충돌은 해소되지 않았다.',
        epilogue:
          '서류철에는 “추가 증거 없음”이라는 한 줄이 붙었다. 박진우의 병실과 김만철의 빈 택시는 시간이 멈춘 채 남았다.',
        win: false,
      },
    },
  },
};
