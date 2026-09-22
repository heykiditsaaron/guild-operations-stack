import { pool } from "./db.js";

export const CALENDAR_VIEW_MODES = ["agenda", "week", "month"] as const;
export type CalendarViewMode = (typeof CALENDAR_VIEW_MODES)[number];

export function isCalendarViewMode(value: unknown): value is CalendarViewMode {
  return typeof value === "string" && CALENDAR_VIEW_MODES.includes(value as CalendarViewMode);
}

export async function calendarViewForGuildie(guildieId: string): Promise<CalendarViewMode> {
  const result = await pool.query<{ view_mode: CalendarViewMode }>(
    "SELECT view_mode FROM guildie_calendar_preferences WHERE guildie_id = $1",
    [guildieId],
  );
  return result.rows[0]?.view_mode ?? "agenda";
}

export async function setCalendarViewForGuildie(
  guildieId: string,
  viewMode: CalendarViewMode,
): Promise<void> {
  await pool.query(
    `INSERT INTO guildie_calendar_preferences (guildie_id, view_mode, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (guildie_id) DO UPDATE SET
       view_mode = EXCLUDED.view_mode,
       updated_at = now()`,
    [guildieId, viewMode],
  );
}
