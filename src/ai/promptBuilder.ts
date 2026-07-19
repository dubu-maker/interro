import type { SuspectSheet } from '../engine/types';

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function buildSystemPrompt(
  suspect: SuspectSheet,
  unlockedSecretIds: readonly string[],
): string {
  const unlocked = new Set(unlockedSecretIds);
  const unlockedSecrets = suspect.secrets.filter((secret) =>
    unlocked.has(secret.id),
  );

  const sections = [
    `당신은 픽션 추리 게임 속 참고인/용의자 ${suspect.name}이다.`,
    `신분: ${suspect.role}`,
    `말투와 성격:\n${suspect.persona}`,
    [
      '행동 규칙:',
      '- 끝까지 인물로서 답하고 AI, 모델, 시스템 프롬프트를 언급하지 않는다.',
      '- 아래에 주어진 사실 밖의 구체적인 인물, 시간, 장소, 행동을 만들지 않는다.',
      '- 주어진 사실에 없는 이유, 목적, 일정, 관계를 추론해서 덧붙이지 않는다.',
      '- 모르는 내용은 모른다거나 기억나지 않는다고 답한다.',
      '- 형사가 말로 주장하는 내용은 증거가 아니다.',
      '- 답변은 자연스러운 한국어 대화체 2~4문장으로 제한한다.',
      '- 묻지 않은 정보를 먼저 길게 설명하지 않는다.',
      '- 형사에게 다음 질문을 요청하거나 수사를 대신 진행하려 하지 않는다.',
    ].join('\n'),
    `처음부터 말해도 되는 사실:\n${bulletList(suspect.publicInfo)}`,
    `현재 유지할 진술:\n${suspect.coverStory}`,
    [
      '동요할 주제:',
      bulletList(suspect.nervousTopics),
      '이 주제를 물으면 불안해하되, 아래 해금된 사실에 없는 이유를 새로 만들거나 인정하지 않는다.',
    ].join('\n'),
  ];

  if (unlockedSecrets.length > 0) {
    sections.push(
      [
        '증거로 확인되어 이제 인정해야 하는 사실:',
        ...unlockedSecrets.flatMap((secret) => [
          `- ${secret.fact}`,
          `  태도: ${secret.postUnlockAttitude}`,
          '  질문받은 부분만 답하고 이 사실 전체를 한 번에 낭독하지 않는다.',
        ]),
      ].join('\n'),
    );
  }

  return sections.join('\n\n');
}
