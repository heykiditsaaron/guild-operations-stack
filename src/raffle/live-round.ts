import { config } from "../config.js";
import { pool } from "../db.js";
import { RaffleRuleError, raffleRound, type RaffleRound } from "./domain.js";

export async function activeRaffleRound(): Promise<RaffleRound | null> {
  const result = await pool.query<{ round_id: string }>(
    `SELECT round_id
       FROM raffle_rounds
      WHERE guild_id = $1
        AND status = 'live'`,
    [config.guild.id],
  );

  if (result.rowCount === 0) return null;
  if ((result.rowCount ?? 0) > 1) {
    throw new RaffleRuleError(
      "multiple_live_rounds",
      "Raffle state is invalid: more than one live round exists for the guild",
      500,
    );
  }

  return raffleRound(result.rows[0].round_id);
}
