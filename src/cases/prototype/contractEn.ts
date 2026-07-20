import type { CaseContract } from '../../engine/contract';

// 영어 플레이 테스트용 계약 (?lang=en). 한국어 계약과 같은 사건 구조를
// 영어로 저작한 것이다. 대사 언어별 품질 비교가 목적.
export const hanSeraContractEn: CaseContract = {
  suspectId: 'sera',
  language: 'en',
  starterQuestions: [
    'Walk me through your movements after you left the office that night.',
    'What was your relationship with Mr. Lee like?',
    'When did you last see Mr. Lee alive?',
  ],
  initialStageId: 'S0',
  stages: [
    {
      id: 'S0',
      strategy:
        'Total denial. Calmly maintain that you went straight home after work.',
      allowedClaimIds: ['C_WENT_HOME', 'C_KNEW_SATURDAY', 'C_DENY_MURDER'],
    },
    {
      id: 'S1',
      strategy:
        'Resignedly admit returning, but minimize it to retrieving the tablet. Deny any harm.',
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
        'Admit meeting Mr. Lee in his office. Concede the argument but firmly deny killing him.',
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
      unlockNotice:
        "The parking log contradicts Han Se-ra's claim that she went straight home.",
    },
    {
      from: 'S1',
      to: 'S2',
      whenEvidencePresented: 'E3',
      unlockNotice:
        "The lipstick mark on the coffee cup ties Han Se-ra to the victim's office.",
    },
  ],
  claims: [
    {
      id: 'C_WENT_HOME',
      meaning:
        'I left work at 9 PM and went straight home. I never went near the office again.',
      truth: 'false',
      contradictedBy: ['E1'],
    },
    {
      id: 'C_KNEW_SATURDAY',
      meaning: "I only learned of Mr. Lee's death on Saturday, when I got the call.",
      truth: 'true',
    },
    {
      id: 'C_DENY_MURDER',
      meaning: 'I did not harm Mr. Lee.',
      truth: 'true',
    },
    {
      id: 'C_TABLET',
      meaning:
        'I came back at 9:38 PM to pick up the tablet I had left behind.',
      truth: 'partial',
    },
    {
      id: 'C_HEARD_PHONE',
      meaning:
        'Outside his office I heard Mr. Lee arguing with someone on the phone, his voice raised.',
      truth: 'true',
    },
    {
      id: 'C_LEFT_2205',
      meaning: 'I drove out of the parking garage at 10:05 PM.',
      truth: 'true',
    },
    {
      id: 'C_ENTERED_OFFICE',
      meaning:
        'After the call ended I went into his office and sat down across from him.',
      truth: 'true',
    },
    {
      id: 'C_COFFEE_TOGETHER',
      meaning:
        'We drank the coffee he brewed; one of the cups ended up with my lipstick mark.',
      truth: 'true',
    },
    {
      id: 'C_MONEY_ARGUMENT',
      meaning: 'We argued briefly about company finances.',
      truth: 'true',
    },
    {
      id: 'C_LEFT_ALIVE',
      meaning: 'Mr. Lee was alive when I left his office.',
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'H_S0_PARKING',
      text: "There should be physical records that can verify Han Se-ra's movements after she left.",
      stageIds: ['S0'],
      targetEvidenceId: 'E1',
    },
    {
      id: 'H_S1_OBSERVATION',
      text: 'No one has asked what she saw or heard during her 27 minutes in the building.',
      stageIds: ['S1', 'S2'],
      targetClaimId: 'C_HEARD_PHONE',
    },
    {
      id: 'H_S1_COFFEE',
      text: 'The two coffee cups have not yet been put in front of her.',
      stageIds: ['S1'],
      targetEvidenceId: 'E3',
    },
    {
      id: 'H_S2_TOPIC',
      text: 'What the two of them actually talked about has not come out yet.',
      stageIds: ['S2'],
      targetClaimId: 'C_MONEY_ARGUMENT',
    },
    {
      id: 'H_S2_EXIT',
      text: 'Part of the timeline between 9:38 PM and 10:05 PM is still unaccounted for.',
      stageIds: ['S2'],
      targetClaimId: 'C_LEFT_ALIVE',
    },
  ],
  materialLexicon: [
    'coffee',
    'cup',
    'lipstick',
    'tablet',
    'phone',
    'cctv',
    'camera',
    'parking',
    'autopsy',
    'funds',
    'finances',
    'documents',
    'files',
    'weapon',
    'trophy',
    'recording',
    'message',
    'alcohol',
    'note',
  ],
};

// 영어 렌더러용 인물 정보 (이름·직함·페르소나만 사용된다).
export const suspectEn = {
  name: 'Han Se-ra',
  role: 'secretary, 29',
  persona:
    'Polite and composed, but defensive. Answers get shorter under pressure; occasionally answers a question with a question.',
};
