import { pool } from "../../db.js";

export type IdentityPresentation = {
  label: string;
  displayName: string | null;
  wowAccountId: string | null;
};

export async function identityPresentation(identityId: string): Promise<IdentityPresentation> {
  const result = await pool.query<{ display_name: string | null; wow_account_id: string }>(
    "SELECT i.display_name, wai.wow_account_id FROM identities i JOIN wow_account_identities wai ON wai.identity_id = i.identity_id WHERE i.identity_id = $1",
    [identityId],
  );
  const row = result.rows[0];
  const wowAccountId = row?.wow_account_id ?? null;
  const displayName = row?.display_name?.trim() || null;

  return {
    label: displayName ?? (wowAccountId ? `WoW Account ${wowAccountId}` : identityId),
    displayName,
    wowAccountId,
  };
}

export async function setIdentityDisplayName(identityId: string, value: string): Promise<void> {
  const displayName = value.trim();
  if (!displayName || displayName.length > 64) throw new Error("invalid_display_name");
  const result = await pool.query(
    "UPDATE identities SET display_name = $2 WHERE identity_id = $1",
    [identityId, displayName],
  );
  if (!result.rowCount) throw new Error("identity_not_found");
}
