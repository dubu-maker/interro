import type { CaseDefinition } from '../../engine/case';
import type { CaseContract } from '../../engine/contract';
import type { Evidence } from '../../engine/types';

// 사건 1 "니어라이트 대표 사망 사건" — TRUTH.md v0.1 기반 영어 저작.
// 진범: 박진태(CFO). 한세라·유민호는 무고하지만 각자 다른 비밀을 숨긴다.

const briefing =
  'Lee Do-yoon (41), CEO of the startup Nearlight, was found dead in his ' +
  'office late Friday night. Preliminary time of death: 9:30–10:30 PM. ' +
  'Cause: blunt-force trauma to the back of the head.';

const evidences: Evidence[] = [
  {
    id: 'E1',
    name: 'Parking garage log',
    description:
      "Han Se-ra's car: out 9:02 PM → back in 9:38 PM → out 10:05 PM.",
    view: {
      type: 'parking',
      date: '2026-07-17',
      camera: 'B2 gate CAM-03',
      vehicle: '38GA 7124 · white sedan',
      owner: 'Han Se-ra',
      rows: [
        { time: '21:02:14', action: 'OUT', lane: 'B2-OUT', confidence: '99.1%' },
        { time: '21:38:47', action: 'IN', lane: 'B2-IN', confidence: '98.7%' },
        { time: '22:05:09', action: 'OUT', lane: 'B2-OUT', confidence: '99.4%' },
      ],
    },
  },
  {
    id: 'E2',
    name: 'Autopsy report',
    description:
      'Time of death 9:30–10:30 PM. Blunt trauma to the back of the head. No defensive wounds.',
    view: {
      type: 'document',
      documentNumber: 'NF-26-0718-044',
      organization: 'National Forensic Service',
      fields: [
        { label: 'Subject', value: 'Lee Do-yoon (M, 41)' },
        { label: 'Est. time of death', value: '2026-07-17, 9:30–10:30 PM' },
        {
          label: 'Cause of death',
          value: 'Intracranial hemorrhage from blunt force to the occiput',
        },
        { label: 'Notes', value: 'No defensive wounds · BAC negative' },
      ],
      note: 'Preliminary finding; may be revised after toxicology.',
    },
  },
  {
    id: 'E3',
    name: 'Two coffee cups on the desk',
    description:
      "Two cups facing each other on the victim's desk. One bears a lipstick mark.",
    view: {
      type: 'scene',
      capturedAt: '2026-07-18 00:42:18',
      location: "CEO's office desk · Exhibit P-07",
      caption:
        'Two cups placed across from each other. A red smudge is visible on the rim of the right cup.',
    },
  },
  {
    id: 'E4',
    name: "Victim's phone records",
    description:
      'Friday night: 9:40 PM, 11-minute call with Park Jin-tae. 10:07 PM, final outgoing call to Park Jin-tae, 45 seconds.',
    view: {
      type: 'document',
      documentNumber: 'TCR-0717-889',
      organization: 'Carrier call records (warrant)',
      fields: [
        { label: '9:40 PM', value: 'Call with Park Jin-tae — 11 min 04 sec' },
        {
          label: '10:07 PM',
          value: 'OUTGOING to Park Jin-tae — 45 sec (final activity)',
        },
        { label: 'After 10:08 PM', value: 'No further activity' },
      ],
      note: 'The 10:07 PM outgoing call places the victim alive at 10:07 PM.',
    },
  },
  {
    id: 'E5',
    name: 'Internal audit memo',
    description:
      "Irregular transfers from the company account. Scheduled as Monday's board agenda.",
    view: {
      type: 'document',
      documentNumber: 'AUD-26-031',
      organization: 'Nearlight internal audit (draft)',
      fields: [
        {
          label: 'Finding',
          value: 'Unexplained transfers totaling ₩380,000,000 over 14 months',
        },
        { label: 'Access', value: 'Authorization trail points to finance office' },
        { label: 'Status', value: "On the agenda for Monday's board meeting" },
      ],
      note: 'Draft was on the victim\'s desk; annotated in his handwriting.',
    },
  },
  {
    id: 'E6',
    name: 'Rear-entrance CCTV still',
    description:
      'A man entering through the rear door at 10:09 PM. Low quality; no vehicle record.',
    view: {
      type: 'scene',
      capturedAt: '2026-07-17 22:09:41',
      location: 'Rear entrance CAM-11',
      caption:
        'A male figure in a dark coat entering through the rear stairwell door. Face not identifiable from this frame.',
    },
  },
  {
    id: 'E7',
    name: 'Building security log',
    description:
      "Yu Min-ho's workstation session: 9:55 PM – 10:31 PM, dev room.",
    view: {
      type: 'document',
      documentNumber: 'SEC-0717-DEV',
      organization: 'Nearlight security office',
      fields: [
        { label: '9:52 PM', value: 'Dev room door badge — YU MIN-HO' },
        {
          label: '9:55 PM – 10:31 PM',
          value: 'Workstation session active (MINHO.YU)',
        },
        { label: '10:33 PM', value: 'Lobby exit — YU MIN-HO' },
      ],
      note: 'Dev room is on the same floor as the rear stairwell.',
    },
  },
  {
    id: 'E8',
    name: 'Forensics: award trophy',
    description:
      'The office trophy matches the wound. Prints wiped; cleaning-agent residue detected.',
    view: {
      type: 'document',
      documentNumber: 'FOR-26-P12',
      organization: 'Forensics — trace analysis',
      fields: [
        { label: 'Object', value: 'Nearlight founding award trophy (brass)' },
        { label: 'Blood', value: "Trace match with victim's blood type" },
        { label: 'Prints', value: 'None recovered — surface wiped' },
        { label: 'Residue', value: 'Alcohol-based cleaning agent detected' },
      ],
      note: 'Wiping suggests concealment after an unplanned attack.',
    },
  },
];

const materialLexicon = [
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
  'audit',
  'memo',
  'board',
  'trophy',
  'weapon',
  'documents',
  'files',
  'recording',
  'message',
  'stairs',
  'whistle',
];

const hanSeraContract: CaseContract = {
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
      allowedClaimIds: ['C_HS_WENT_HOME', 'C_HS_KNEW_SATURDAY', 'C_HS_DENY'],
    },
    {
      id: 'S1',
      strategy:
        'Resignedly admit returning, but minimize it to retrieving the tablet. Deny any harm.',
      allowedClaimIds: [
        'C_HS_TABLET',
        'C_HS_HEARD_PHONE',
        'C_HS_LEFT_2205',
        'C_HS_REFUSE_WORDS',
        'C_HS_DENY',
      ],
    },
    {
      id: 'S2',
      strategy:
        'Admit meeting Mr. Lee over coffee and the argument about finances. Refuse to repeat what you overheard. Deny killing him.',
      allowedClaimIds: [
        'C_HS_TABLET',
        'C_HS_HEARD_PHONE',
        'C_HS_LEFT_2205',
        'C_HS_ENTERED_OFFICE',
        'C_HS_COFFEE',
        'C_HS_MONEY_TALK',
        'C_HS_LEFT_ALIVE',
        'C_HS_REFUSE_WORDS',
        'C_HS_DENY',
      ],
    },
    {
      id: 'S3',
      strategy:
        'The audit memo is on the table — stop protecting the secret. Admit the whistleblowing work and repeat what you overheard. Still deny any violence.',
      allowedClaimIds: [
        'C_HS_TABLET',
        'C_HS_HEARD_PHONE',
        'C_HS_LEFT_2205',
        'C_HS_ENTERED_OFFICE',
        'C_HS_COFFEE',
        'C_HS_MONEY_TALK',
        'C_HS_LEFT_ALIVE',
        'C_HS_WHISTLEBLOW',
        'C_HS_CALL_WORDS',
        'C_HS_DENY',
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
      reactionLine:
        '…Fine. I did go back that night. But it was only for my tablet.',
    },
    {
      from: 'S1',
      to: 'S2',
      whenEvidencePresented: 'E3',
      unlockNotice:
        'Two cups facing each other — someone sat across from the victim that night.',
      reactionLine:
        "The lipstick is mine. We had coffee, and we argued — about money. That's all it was.",
    },
    {
      from: 'S2',
      to: 'S3',
      whenEvidencePresented: 'E5',
      unlockNotice:
        "The audit memo connects Han Se-ra's tablet to the finance dispute.",
      reactionLine:
        "…You already have the memo. Then there's no point hiding it anymore. Mr. Lee and I were building that file together.",
    },
  ],
  claims: [
    {
      id: 'C_HS_WENT_HOME',
      meaning:
        'I left work at 9 PM and went straight home. I never went near the office again.',
      truth: 'false',
      contradictedBy: ['E1'],
    },
    {
      id: 'C_HS_KNEW_SATURDAY',
      meaning:
        "I only learned of Mr. Lee's death on Saturday, when I got the call.",
      truth: 'true',
    },
    {
      id: 'C_HS_DENY',
      meaning: 'I did not harm Mr. Lee.',
      truth: 'true',
    },
    {
      id: 'C_HS_TABLET',
      meaning:
        'I came back at 9:38 PM to pick up the tablet I had left behind.',
      truth: 'partial',
    },
    {
      id: 'C_HS_HEARD_PHONE',
      meaning:
        'Outside his office I heard Mr. Lee arguing with someone on the phone, his voice raised.',
      truth: 'true',
    },
    {
      id: 'C_HS_LEFT_2205',
      meaning: 'I drove out of the parking garage at 10:05 PM.',
      truth: 'true',
    },
    {
      id: 'C_HS_ENTERED_OFFICE',
      meaning:
        'After the call ended I went into his office and sat down across from him.',
      truth: 'true',
    },
    {
      id: 'C_HS_COFFEE',
      meaning:
        'We drank the coffee he brewed; one of the cups ended up with my lipstick mark.',
      truth: 'true',
    },
    {
      id: 'C_HS_MONEY_TALK',
      meaning: "We argued briefly about the company's finances.",
      truth: 'true',
    },
    {
      id: 'C_HS_LEFT_ALIVE',
      meaning: 'Mr. Lee was alive when I left his office.',
      truth: 'true',
    },
    {
      id: 'C_HS_REFUSE_WORDS',
      meaning:
        "There are things about that call I'm not comfortable repeating yet.",
      truth: 'partial',
    },
    {
      id: 'C_HS_WHISTLEBLOW',
      meaning:
        'The tablet held files Mr. Lee and I were quietly preparing — an internal report on the missing money.',
      truth: 'true',
    },
    {
      id: 'C_HS_CALL_WORDS',
      meaning:
        "Through the door I heard him say 'the board' and 'put it back'.",
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'H_HS_PARKING',
      text: "There should be physical records that can verify Han Se-ra's movements after she left.",
      stageIds: ['S0'],
      targetEvidenceId: 'E1',
    },
    {
      id: 'H_HS_OBSERVATION',
      text: 'No one has asked what she saw or heard during her 27 minutes in the building.',
      stageIds: ['S1', 'S2', 'S3'],
      targetClaimId: 'C_HS_HEARD_PHONE',
    },
    {
      id: 'H_HS_COFFEE',
      text: 'The two coffee cups have not yet been put in front of her.',
      stageIds: ['S1'],
      targetEvidenceId: 'E3',
    },
    {
      id: 'H_HS_MEMO',
      text: 'She refuses to repeat what she overheard. The audit memo might loosen her tongue.',
      stageIds: ['S2'],
      targetEvidenceId: 'E5',
    },
    {
      id: 'H_HS_WORDS',
      text: 'Now that her secret is out, ask again what exactly she heard through that door.',
      stageIds: ['S3'],
      targetClaimId: 'C_HS_CALL_WORDS',
    },
  ],
  materialLexicon,
};

const parkJinTaeContract: CaseContract = {
  suspectId: 'park',
  language: 'en',
  starterQuestions: [
    'Where were you on Friday night between 9 and 11 PM?',
    'How were things between you and Mr. Lee lately?',
    'When did you last speak with Mr. Lee?',
  ],
  initialStageId: 'S0',
  stages: [
    {
      id: 'S0',
      strategy:
        'Cold and composed. You were home all evening and had no contact with the victim. Question the premise of every accusation.',
      allowedClaimIds: ['C_PJ_HOME', 'C_PJ_COFOUNDER', 'C_PJ_DENY'],
    },
    {
      id: 'S1',
      strategy:
        'Concede the phone call but frame it as routine business. You never went to the office.',
      allowedClaimIds: [
        'C_PJ_CALL_BUSINESS',
        'C_PJ_NOT_THERE',
        'C_PJ_COFOUNDER',
        'C_PJ_DENY',
      ],
    },
    {
      id: 'S2',
      strategy:
        'Concede the call was a heated argument about the audit, but insist it ended on the phone. Dismiss the audit as a misunderstanding.',
      allowedClaimIds: [
        'C_PJ_ARGUED_CALL',
        'C_PJ_AUDIT_MISUNDERSTANDING',
        'C_PJ_NOT_THERE',
        'C_PJ_DENY',
      ],
    },
    {
      id: 'S3',
      strategy:
        'The rear-door footage is on the table. Admit you went, through the back. Claim you found him already dead and panicked. Never confess.',
      allowedClaimIds: [
        'C_PJ_ARGUED_CALL',
        'C_PJ_WENT_BACKDOOR',
        'C_PJ_FOUND_DEAD',
        'C_PJ_PANICKED',
        'C_PJ_DENY',
      ],
    },
  ],
  transitions: [
    {
      from: 'S0',
      to: 'S1',
      whenEvidencePresented: 'E4',
      unlockNotice:
        "The phone records contradict Park Jin-tae's claim of no contact that night.",
      reactionLine:
        'Phone records. Of course. Yes — we spoke that evening. A business call, nothing more.',
    },
    {
      from: 'S1',
      to: 'S2',
      whenEvidencePresented: 'E5',
      unlockNotice:
        'The audit memo gives the 9:40 PM call a motive: the missing money was going to the board on Monday.',
      reactionLine:
        "So he kept a copy on his desk. Fine — the call got heated. He was waving that memo at me over the phone. It's a misunderstanding I intended to clear up.",
    },
    {
      from: 'S2',
      to: 'S3',
      whenEvidencePresented: 'E6',
      unlockNotice:
        'A man entered through the rear door at 10:09 PM — minutes after the victim called Park Jin-tae to come up.',
      reactionLine:
        "…That could be anyone. But yes. It was me. I went up because he told me to come — and when I walked in, he was already on the floor. I swear he was already dead.",
    },
  ],
  claims: [
    {
      id: 'C_PJ_HOME',
      meaning:
        'I was at home all evening. I had no contact with Do-yoon that night.',
      truth: 'false',
      contradictedBy: ['E4'],
    },
    {
      id: 'C_PJ_COFOUNDER',
      meaning:
        'We founded this company together twelve years ago. We were like brothers.',
      truth: 'partial',
    },
    {
      id: 'C_PJ_DENY',
      meaning: 'I did not kill Do-yoon.',
      truth: 'false',
    },
    {
      id: 'C_PJ_CALL_BUSINESS',
      meaning:
        'We spoke on the phone around 9:40 PM. Routine end-of-week business.',
      truth: 'false',
      contradictedBy: ['E5'],
    },
    {
      id: 'C_PJ_NOT_THERE',
      meaning: 'I never set foot in the office that night.',
      truth: 'false',
      contradictedBy: ['E6'],
    },
    {
      id: 'C_PJ_ARGUED_CALL',
      meaning:
        'The 9:40 call was an argument about the audit memo. He accused me over the phone.',
      truth: 'true',
    },
    {
      id: 'C_PJ_AUDIT_MISUNDERSTANDING',
      meaning:
        'The transfers are an accounting misunderstanding I planned to explain to the board myself.',
      truth: 'false',
    },
    {
      id: 'C_PJ_WENT_BACKDOOR',
      meaning:
        'After his 10:07 PM call I came to the office and took the rear stairs.',
      truth: 'true',
    },
    {
      id: 'C_PJ_FOUND_DEAD',
      meaning:
        'When I entered his office he was already on the floor. He was already dead.',
      truth: 'false',
    },
    {
      id: 'C_PJ_PANICKED',
      meaning: 'I panicked and left without calling anyone. That was cowardly.',
      truth: 'partial',
    },
  ],
  hints: [
    {
      id: 'H_PJ_PHONE',
      text: "Mr. Lee's own phone records would show who he spoke with that night.",
      stageIds: ['S0'],
      targetEvidenceId: 'E4',
    },
    {
      id: 'H_PJ_MEMO',
      text: 'A routine business call does not raise a dead man\'s voice. What was on the victim\'s desk that Friday?',
      stageIds: ['S1'],
      targetEvidenceId: 'E5',
    },
    {
      id: 'H_PJ_REAR',
      text: 'He insists he never came. The parking garage saw nothing — but the building has more than one door.',
      stageIds: ['S2'],
      targetEvidenceId: 'E6',
    },
    {
      id: 'H_PJ_TIMELINE',
      text: 'He says the CEO was already dead when he arrived — yet the victim was alive on the phone at 10:07 PM, two minutes before the rear door opened. Press the timeline.',
      stageIds: ['S3'],
    },
  ],
  materialLexicon,
};

const yuMinHoContract: CaseContract = {
  suspectId: 'minho',
  language: 'en',
  starterQuestions: [
    'Where were you on Friday night?',
    'What time did you leave the office, and how?',
    'Did you notice anything unusual in the building that evening?',
  ],
  initialStageId: 'S0',
  stages: [
    {
      id: 'S0',
      strategy:
        'Anxious and over-explaining. You left around 8 PM and went home. A bad liar — keep answers short and jittery.',
      allowedClaimIds: ['C_YM_LEFT_EIGHT', 'C_YM_ORDINARY_DAY', 'C_YM_DENY'],
    },
    {
      id: 'S1',
      strategy:
        'The security log is out. Admit staying late in the dev room for "backlog work". Do not mention the job offer or anything you saw.',
      allowedClaimIds: [
        'C_YM_WORKED_LATE',
        'C_YM_STAYED_LOGGED',
        'C_YM_DENY',
      ],
    },
    {
      id: 'S2',
      strategy:
        'Cornered by the rear-door still. Confess the job offer and the file archiving — and what you saw on the rear stairs. Beg them to keep the job thing quiet.',
      allowedClaimIds: [
        'C_YM_WORKED_LATE',
        'C_YM_STAYED_LOGGED',
        'C_YM_JOB_OFFER',
        'C_YM_SAW_PARK',
        'C_YM_DENY',
      ],
    },
  ],
  transitions: [
    {
      from: 'S0',
      to: 'S1',
      whenEvidencePresented: 'E7',
      unlockNotice:
        "The security log contradicts Yu Min-ho's claim that he left at 8 PM.",
      reactionLine:
        "Okay — okay, I was there. In the dev room. I was just… clearing some backlog, that's all.",
    },
    {
      from: 'S1',
      to: 'S2',
      whenEvidencePresented: 'E6',
      unlockNotice:
        'Shown the rear-door still, Yu Min-ho admits what he was doing — and what he saw on the rear stairs.',
      reactionLine:
        "…Please don't put this in writing. I've accepted an offer from a competitor — I was copying my own project files. And around ten past ten, on the rear stairs… I saw Director Park.",
    },
  ],
  claims: [
    {
      id: 'C_YM_LEFT_EIGHT',
      meaning: 'I left around 8 PM and went straight home.',
      truth: 'false',
      contradictedBy: ['E7'],
    },
    {
      id: 'C_YM_ORDINARY_DAY',
      meaning: 'It was an ordinary Friday. Nothing unusual happened.',
      truth: 'false',
    },
    {
      id: 'C_YM_DENY',
      meaning: 'I had no reason to hurt the CEO, and I did not.',
      truth: 'true',
    },
    {
      id: 'C_YM_WORKED_LATE',
      meaning:
        'I stayed late in the dev room clearing backlog work. I badged in around 9:52 PM.',
      truth: 'partial',
    },
    {
      id: 'C_YM_STAYED_LOGGED',
      meaning:
        'My workstation session ran until 10:31 PM, and I left through the lobby at 10:33 PM.',
      truth: 'true',
    },
    {
      id: 'C_YM_JOB_OFFER',
      meaning:
        "I've accepted an offer from a competitor. I came back to archive my own project files before resigning.",
      truth: 'true',
    },
    {
      id: 'C_YM_SAW_PARK',
      meaning:
        'Around 10:10 PM I saw Director Park Jin-tae on the rear stairs, heading up toward the executive floor.',
      truth: 'true',
    },
  ],
  hints: [
    {
      id: 'H_YM_LOG',
      text: 'If he was in the building, the security system would have logged his badge and workstation.',
      stageIds: ['S0'],
      targetEvidenceId: 'E7',
    },
    {
      id: 'H_YM_REAR',
      text: 'He is hiding why he stayed — and the rear-door still might shake loose what he saw from the dev room side.',
      stageIds: ['S1'],
      targetEvidenceId: 'E6',
    },
    {
      id: 'H_YM_WITNESS',
      text: 'He saw someone on the rear stairs. Pin down exactly who, where, and when.',
      stageIds: ['S2'],
      targetClaimId: 'C_YM_SAW_PARK',
    },
  ],
  materialLexicon,
};

export const case1: CaseDefinition = {
  id: 'case1',
  title: '니어라이트 대표 사망 사건',
  briefing,
  maxTurns: 12,
  evidences,
  suspects: [
    {
      id: 'sera',
      name: 'Han Se-ra',
      role: 'secretary, 29',
      persona:
        'Polite and composed, but defensive. Answers get shorter under pressure; occasionally answers a question with a question.',
      portrait: '한',
      introLine: 'Han Se-ra sits across from you, hands folded, waiting.',
      contract: hanSeraContract,
    },
    {
      id: 'park',
      name: 'Park Jin-tae',
      role: 'co-founder & CFO, 45',
      persona:
        'Cold, articulate, controlled. Speaks like a man used to boardrooms; deflects with counter-arguments rather than emotion. Never raises his voice.',
      portrait: '박',
      introLine:
        'Park Jin-tae checks his watch, then meets your eyes without a flicker.',
      contract: parkJinTaeContract,
    },
    {
      id: 'minho',
      name: 'Yu Min-ho',
      role: 'dev team lead, 34',
      persona:
        'Nervous, fast-talking, over-explains. Stumbles over words when pressed; a visibly bad liar who wants to be believed.',
      portrait: '유',
      introLine:
        'Yu Min-ho keeps folding and unfolding his hands under the table.',
      contract: yuMinHoContract,
    },
  ],
  // 점진 공개: 시작은 한세라와 현장 증거 3개뿐. 진술이 다음 단서를 연다.
  initialEvidenceIds: ['E1', 'E2', 'E3'],
  initialSuspectIds: ['sera'],
  unlocks: [
    {
      evidenceId: 'E4',
      notice:
        "Carrier records secured — the victim really was on the phone that night.",
      trigger: { type: 'claim', suspectId: 'sera', claimId: 'C_HS_HEARD_PHONE' },
    },
    {
      evidenceId: 'E5',
      notice:
        "A finance dispute? The annotated audit memo was recovered from the victim's desk.",
      trigger: { type: 'claim', suspectId: 'sera', claimId: 'C_HS_MONEY_TALK' },
    },
    {
      suspectId: 'park',
      notice: 'The man on the other end of both calls: co-founder Park Jin-tae.',
      trigger: { type: 'evidence', evidenceId: 'E4' },
    },
    {
      evidenceId: 'E6',
      notice:
        'He swears he never set foot here. The parking garage saw nothing — but the rear entrance camera did.',
      trigger: { type: 'claim', suspectId: 'park', claimId: 'C_PJ_NOT_THERE' },
    },
    {
      evidenceId: 'E7',
      notice:
        'Cross-checking the building logs for the same window turned up an active workstation in the dev room.',
      trigger: { type: 'evidence', evidenceId: 'E6' },
    },
    {
      suspectId: 'minho',
      notice:
        'Yu Min-ho — badged into the dev room during the murder window.',
      trigger: { type: 'evidence', evidenceId: 'E7' },
    },
    {
      evidenceId: 'E8',
      notice:
        'To test his story, forensics re-examined the office. The founding award trophy came back positive.',
      trigger: { type: 'stage', suspectId: 'park', stageId: 'S3' },
    },
  ],
  motiveOptions: [
    {
      id: 'M_EMBEZZLEMENT',
      label:
        'To bury the embezzlement the audit memo would expose at Monday\'s board meeting',
    },
    {
      id: 'M_AFFAIR',
      label: 'To hide a personal relationship with the victim',
    },
    {
      id: 'M_JOB_LEAK',
      label: 'To stop the victim from reporting stolen project files',
    },
    {
      id: 'M_DEMOTION',
      label: 'Revenge for being pushed out of the company leadership',
    },
  ],
  methodOptions: [
    {
      id: 'X_TROPHY',
      label:
        'Struck the back of his head with the office trophy in an unplanned attack, then wiped it clean',
    },
    {
      id: 'X_PUSH',
      label: 'Pushed him so that he struck his head on the desk',
    },
    {
      id: 'X_PLANNED',
      label: 'Brought a weapon to the office and attacked him as planned',
    },
    {
      id: 'X_POISON',
      label: 'Drugged his coffee, then staged the head injury',
    },
  ],
  solution: {
    culpritId: 'park',
    motiveId: 'M_EMBEZZLEMENT',
    methodId: 'X_TROPHY',
    proofEvidenceChains: [
      ['E4', 'E6', 'E8'],
      ['E4', 'E5', 'E8'],
    ],
    epilogue:
      'At 10:07 PM Lee Do-yoon called his co-founder and told him to come up. ' +
      'Park Jin-tae took the rear stairs at 10:09 PM — seen by Yu Min-ho, who ' +
      'was quietly archiving his own files before resigning. The argument over ' +
      "the audit memo turned physical; Park struck him with the founding award " +
      'trophy and wiped it down before leaving at 10:24 PM. Han Se-ra, who had ' +
      'been building the whistleblower file with the victim, had already driven ' +
      'out of the garage at 10:05 PM.',
  },
};
