import type { Secret, SuspectSheet } from './types';

export function matchEvidenceToSecrets(
  suspect: SuspectSheet,
  evidenceId: string,
  unlockedSecretIds: readonly string[],
): Secret[] {
  const unlocked = new Set(unlockedSecretIds);

  return suspect.secrets.filter(
    (secret) => secret.gateEvidenceId === evidenceId && !unlocked.has(secret.id),
  );
}
