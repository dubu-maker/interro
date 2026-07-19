export interface Evidence {
  id: string;
  name: string;
  description: string;
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
