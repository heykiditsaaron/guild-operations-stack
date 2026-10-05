import { pool } from "../../db.js";

export type IdentityPresentation = {
  label: string;
  wowAccountId: string | null;
};

export async function identityPresentation(identityId: string): Promise<IdentityPresentation> {
  const result = await pool.query<{ wow_account_id: string }>(
    "SELECT wow_account_id FROM wow_account_identities WHERE identity_id = $1",
    [identityId],
  );
  const wowAccountId = result.rows[0]?.wow_account_id ?? null;

  return {
    label: wowAccountId ? `WoW Account ${wowAccountId}` : identityId,
    wowAccountId,
  };
}
