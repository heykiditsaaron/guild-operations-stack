import { pool } from "../../db.js";

export async function guildieExists(guildieId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM guildies WHERE identity_id = $1",
    [guildieId],
  );
  return (result.rowCount ?? 0) > 0;
}
