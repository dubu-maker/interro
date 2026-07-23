export interface ParkingLogRow {
  time: string;
  action: string;
  lane: string;
  confidence: string;
}

export type EvidenceView =
  | {
      type: 'parking';
      date: string;
      camera: string;
      vehicle: string;
      owner: string;
      rows: ParkingLogRow[];
    }
  | {
      type: 'document';
      // 감정서 외에도 통화기록·CCTV 분석표 등 사건별 문서 제목을 쓸 수 있다.
      title?: string;
      documentNumber: string;
      organization: string;
      fields: Array<{ label: string; value: string }>;
      note: string;
    }
  | {
      type: 'scene';
      capturedAt: string;
      location: string;
      caption: string;
    };

export interface Evidence {
  id: string;
  name: string;
  description: string;
  view: EvidenceView;
}

export interface Secret {
  id: string;
  fact: string;
  gateEvidenceId: string;
  unlockNotice: string;
  postUnlockAttitude: string;
}

export interface SuspectSheet {
  id: string;
  name: string;
  role: string;
  persona: string;
  publicInfo: string[];
  coverStory: string;
  nervousTopics: string[];
  forbiddenClaims: string[];
  secrets: Secret[];
}

export interface GameState {
  turn: number;
  maxTurns: number;
  presentedEvidenceIds: string[];
  unlockedSecretIds: string[];
}

export interface EvidencePresentationResult {
  state: GameState;
  newlyUnlockedSecretIds: string[];
}
