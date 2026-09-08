import { randomUUID } from "node:crypto";
import { publishOperationalRecord } from "../../operational-inspection.js";
import {
  establishExternallyManagedGuildCalendarEvent,
  externallyManagedGuildCalendarEvent,
  type GuildCalendarEvent,
  type GuildCalendarEventInput,
  type GuildCalendarOccursAt,
  withdrawExternallyManagedGuildCalendarEvent,
} from "./registry.js";

export class GuildCalendarEventNotFoundError extends Error {
  constructor(public readonly eventId: string) {
    super(`Externally managed guild calendar event ${eventId} was not found`);
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

function failureDetails(eventId: string | null, error: unknown): Record<string, unknown> {
  return {
    event_id: eventId,
    error: error instanceof Error ? error.message : String(error),
  };
}

export async function createExternallyManagedGuildCalendarEvent(
  input: CreateGuildCalendarEventInput,
): Promise<GuildCalendarEvent> {
  const eventId = randomUUID();
  try {
    const event = await establishExternallyManagedGuildCalendarEvent({
      ...input,
      eventId,
    });

    await publishBestEffort({
      source: "calendar",
      operation: "create",
      kind: "result",
      result: "success",
      summary: `Created externally managed guild calendar event ${event.title}.`,
      details: { event_id: event.eventId },
    });

    return event;
  } catch (error) {
    await publishBestEffort({
      source: "calendar",
      operation: "create",
      kind: "exception",
      summary: "External guild calendar event creation did not complete.",
      details: failureDetails(eventId, error),
    });
    throw error;
  }
}

export async function updateExternallyManagedGuildCalendarEvent(
  eventId: string,
  input: UpdateGuildCalendarEventInput,
): Promise<GuildCalendarEvent> {
  try {
    const current = await externallyManagedGuildCalendarEvent(eventId);
    if (!current) throw new GuildCalendarEventNotFoundError(eventId);

    const event = await establishExternallyManagedGuildCalendarEvent({
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
      summary: `Updated externally managed guild calendar event ${event.title}.`,
      details: { event_id: event.eventId },
    });

    return event;
  } catch (error) {
    if (!(error instanceof GuildCalendarEventNotFoundError)) {
      await publishBestEffort({
        source: "calendar",
        operation: "update",
        kind: "exception",
        summary: "External guild calendar event update did not complete.",
        details: failureDetails(eventId, error),
      });
    }
    throw error;
  }
}

export async function withdrawExternallyManagedGuildCalendarEventOperation(
  eventId: string,
): Promise<void> {
  try {
    const current = await externallyManagedGuildCalendarEvent(eventId);
    if (!current) throw new GuildCalendarEventNotFoundError(eventId);

    const withdrawn = await withdrawExternallyManagedGuildCalendarEvent(eventId);
    if (!withdrawn) throw new GuildCalendarEventNotFoundError(eventId);

    await publishBestEffort({
      source: "calendar",
      operation: "withdraw",
      kind: "result",
      result: "success",
      summary: `Withdrew externally managed guild calendar event ${current.title}.`,
      details: { event_id: current.eventId },
    });
  } catch (error) {
    if (!(error instanceof GuildCalendarEventNotFoundError)) {
      await publishBestEffort({
        source: "calendar",
        operation: "withdraw",
        kind: "exception",
        summary: "External guild calendar event withdrawal did not complete.",
        details: failureDetails(eventId, error),
      });
    }
    throw error;
  }
}
