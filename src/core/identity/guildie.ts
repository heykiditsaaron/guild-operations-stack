import { pool } from "../../db.js";

export async function identityExists(identityId: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM identities WHERE identity_id = $1", [identityId]);
  return (result.rowCount ?? 0) > 0;
}
