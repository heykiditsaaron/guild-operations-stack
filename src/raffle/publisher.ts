export type RafflePublishedEvent =
  | {
      kind: "raffle.round.live";
      roundId: string;
    }
  | {
      kind: "raffle.claim.submitted";
      roundId: string;
      claimId: string;
    }
  | {
      kind: "raffle.claim.approved";
      roundId: string;
      claimId: string;
    }
  | {
      kind: "raffle.claim.denied";
      roundId: string;
      claimId: string;
    }
  | {
      kind: "raffle.claim.cancelled";
      roundId: string;
      claimId: string;
    }
  | {
      kind: "raffle.round.drawn";
      roundId: string;
      winningClaimId: string;
    }
  | {
      kind: "raffle.round.cancelled";
      roundId: string;
    }
  | {
      kind: "raffle.round.no-entry-cancelled";
      roundId: string;
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

function variablesForEvent(event: RafflePublishedEvent): BotGhostVariable[] {
  const variables = [
    variable("event_kind", event.kind),
    variable("round_id", event.roundId),
  ];

  if ("claimId" in event) {
    variables.push(variable("claim_id", event.claimId));
  }
  if ("winningClaimId" in event) {
    variables.push(variable("winning_claim_id", event.winningClaimId));
  }

  return variables;
}

export async function publishRaffleEvent(event: RafflePublishedEvent): Promise<void> {
  const webhookUrl = process.env.BOTGHOST_RAFFLE_WEBHOOK_URL;
  const apiKey = process.env.BOTGHOST_API_KEY;

  if (!webhookUrl || !apiKey) {
    console.error(`[raffle-publisher] publication skipped for ${event.kind}: BotGhost transport is not configured`);
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
  } catch (error) {
    console.error(`[raffle-publisher] publication failed for ${event.kind}`, error);
  }
}
