/** Claim a pending receipt for one delivery attempt using the shared database time gate. */
export async function claimEmissionReceipt(
  query: (sql: string, values: string[]) => Promise<{ rowCount: number | null; rows: Array<{ attempt_count: number }> }>,
  publicationId: string,
  consumerId: string,
): Promise<number | null> {
  const claimed = await query(
    `UPDATE emission_consumer_receipts
        SET last_attempted_at_unix = extract(epoch FROM now())::bigint,
            attempt_count = attempt_count + 1
      WHERE publication_id = $1
        AND consumer_id = $2
        AND acknowledged_at_unix IS NULL
        AND (
          last_attempted_at_unix IS NULL
          OR last_attempted_at_unix <= extract(epoch FROM now())::bigint - 30
        )
      RETURNING attempt_count`,
    [publicationId, consumerId],
  );
  return claimed.rowCount ? Number(claimed.rows[0].attempt_count) : null;
}
