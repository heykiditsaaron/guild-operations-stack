export type PublishedEvent =
  | {
      kind: "subject.discord.linked";
      subjectId: string;
      discordUserId: string;
    }
  | {
      kind: "subject.discord.unlinked";
      subjectId: string;
      discordUserId: string;
    }
  | {
      kind: "subject.main.changed";
      subjectId: string;
      guildId: string;
    };

type BotGhostVariable = {
  name: string;
  variable: string;
  value: string;
};

function variable(name: string, value: string): BotGhostVariable {
  return {
    name,
    variable: `{${name}}`,
    value,
  };
}

function variablesForEvent(event: PublishedEvent): BotGhostVariable[] {
  const variables = [
    variable("event_kind", event.kind),
    variable("subject_id", event.subjectId),
  ];

  if ("discordUserId" in event) {
    variables.push(variable("discord_user_id", event.discordUserId));
  }
  if ("guildId" in event) {
    variables.push(variable("guild_id", event.guildId));
  }

  return variables;
}

export async function publishEvent(event: PublishedEvent): Promise<void> {
  const webhookUrl = process.env.BOTGHOST_EVENTS_WEBHOOK_URL;
  const apiKey = process.env.BOTGHOST_API_KEY;

  if (!webhookUrl || !apiKey) {
    console.error(`[event-publisher] publication skipped for ${event.kind}: BotGhost transport is not configured`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ variables: variablesForEvent(event) }),
    });

    if (!response.ok) {
      throw new Error(`BotGhost responded with HTTP ${response.status}`);
    }

    console.info(`[event-publisher] published ${event.kind}`);
  } catch (error) {
    console.error(`[event-publisher] publication failed for ${event.kind}`, error);
  }
}
