import { randomUUID } from "node:crypto";
import { publishOperationalRecord } from "../../operational-inspection.js";
import {
  establishGuildCalendarEvent,
  guildCalendarEvent,
  type GuildCalendarEvent,
  type GuildCalendarEventInput,
  type GuildCalendarOccursAt,
  withdrawGuildCalendarEvent,
} from "./registry.js";

export class GuildCalendarEventNotFoundError extends Error {
  constructor(public readonly eventId: string) {
    super(`Guild calendar event ${eventId} was not found`);
    this.name = "GuildCalendarEventNotFoundError";
  }
}

export type CreateGuildCalendarEventInput = Omit<GuildCalendarEventInput, "eventId">;

export type UpdateGuildCalendarEventInput = {
  title?: string;
  occursAt?: GuildCalendarOccursAt;
  destination?: string | null;
  category?: string | null;
};

async function publishBestEffort(input: Parameters<typeof publishOperationalRecord>[0]): Promise<void> {
  try {
    await publishOperationalRecord(input);
  } catch (error) {
    console.error("Operational inspection publication failed", error);
  }
}

export async function createGuildCalendarEvent(
  input: CreateGuildCalendarEventInput,
): Promise<GuildCalendarEvent> {
  const event = await establishGuildCalendarEvent({
    ...input,
    eventId: randomUUID(),
  });

  await publishBestEffort({
    source: "calendar",
    operation: "create",
    kind: "result",
    result: "success",
    summary: `Created guild calendar event ${event.title}.`,
    details: { event_id: event.eventId },
  });

  return event;
}

export async function updateGuildCalendarEvent(
  eventId: string,
  input: UpdateGuildCalendarEventInput,
): Promise<GuildCalendarEvent> {
  const current = await guildCalendarEvent(eventId);
  if (!current) throw new GuildCalendarEventNotFoundError(eventId);

  const event = await establishGuildCalendarEvent({
    eventId: current.eventId,
    title: input.title ?? current.title,
    occursAt: input.occursAt ?? current.occursAt,
    destination: input.destination === undefined ? current.destination : input.destination,
    category: input.category === undefined ? current.category : input.category,
  });

  await publishBestEffort({
    source: "calendar",
    operation: "update",
    kind: "result",
    result: "success",
    summary: `Updated guild calendar event ${event.title}.`,
    details: { event_id: event.eventId },
  });

  return event;
}

export async function withdrawGuildCalendarEventOperation(eventId: string): Promise<void> {
  const current = await guildCalendarEvent(eventId);
  if (!current) throw new GuildCalendarEventNotFoundError(eventId);

  const withdrawn = await withdrawGuildCalendarEvent(eventId);
  if (!withdrawn) throw new GuildCalendarEventNotFoundError(eventId);

  await publishBestEffort({
    source: "calendar",
    operation: "withdraw",
    kind: "result",
    result: "success",
    summary: `Withdrew guild calendar event ${current.title}.`,
    details: { event_id: current.eventId },
  });
}
