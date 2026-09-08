import type { FastifyInstance, FastifyRequest } from "fastify";
import { characterMembership, guildieState } from "./application-state.js";
import { config, parseRegion } from "./config.js";
import {
  createGuildCalendarEvent,
  GuildCalendarEventNotFoundError,
  updateGuildCalendarEvent,
  withdrawGuildCalendarEventOperation,
} from "./guild-events/calendar/operations.js";
import {
  discoverableGuildCalendarEvents,
  guildCalendarEvent,
  type GuildCalendarEvent,
  type GuildCalendarOccursAt,
} from "./guild-events/calendar/registry.js";

function readAuthorized(request: FastifyRequest): boolean {
  const configured = process.env.API_READ_KEY ?? process.env.EVENT_QUERY_API_KEY;
  if (!configured) return false;
  const header = request.headers.authorization;
  return header === configured || header === `Bearer ${configured}`;
}

function writeAuthorized(request: FastifyRequest): boolean {
  const configured = process.env.API_WRITE_KEY;
  if (!configured) return false;
  const header = request.headers.authorization;
  return header === configured || header === `Bearer ${configured}`;
}

function calendarEventRepresentation(event: GuildCalendarEvent) {
  return {
    event_id: event.eventId,
    title: event.title,
    occurs_at: event.occursAt,
    category: event.category,
    destination: event.destination,
    registered_at_unix: event.registeredAtUnix,
    updated_at_unix: event.updatedAtUnix,
  };
}

function parseOccursAt(value: unknown): GuildCalendarOccursAt | null {
  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  if (!value.every((part) => Number.isSafeInteger(part) && part >= 0)) return null;
  const start = value[0] as number;
  const end = value[1] as number | undefined;
  if (end !== undefined && end < start) return null;
  return end === undefined ? [start] : [start, end];
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("invalid optional text");
  const normalized = value.trim();
  return normalized || null;
}

function requiredTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function calendarEventId(request: FastifyRequest): string | null {
  const params = request.params as { eventId?: unknown };
  return typeof params.eventId === "string" && params.eventId.trim() ? params.eventId.trim() : null;
}

export async function registerApiV1Routes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/guildies/:guildieId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

    const params = request.params as { guildieId?: unknown };
    if (typeof params.guildieId !== "string" || !params.guildieId) {
      return reply.code(400).send({ error: "invalid_guildie_coordinate" });
    }

    const state = await guildieState(params.guildieId);
    if (!state) return reply.code(404).send({ error: "guildie_not_found" });

    return reply.send({
      guildie_id: state.guildieId,
      discord: state.discordAssociation
        ? {
            discord_user_id: state.discordAssociation.discordUserId,
            username: state.discordAssociation.username,
            connected_at: state.discordAssociation.connectedAt,
          }
        : null,
      guild: {
        membership: state.guildAuthority
          ? {
              guild_id: state.guildAuthority.guildId,
              rank: state.guildAuthority.rankIndex,
              rank_name: state.guildAuthority.rankDisplayName,
            }
          : null,
        main_character: state.selectedMain
          ? {
              guild_id: state.selectedMain.guildId,
              character_id: state.selectedMain.characterId,
              realm_id: state.selectedMain.realmId,
              name: state.selectedMain.name,
              realm_name: state.selectedMain.realmName,
              rank: state.selectedMain.rankIndex,
              currently_eligible: state.selectedMain.currentlyEligible,
              avatar_url: state.selectedMain.avatarUrl,
            }
          : null,
      },
    });
  });

  app.get(
    "/api/v1/guilds/:guildId/characters/:region/:realmId/:characterId",
    async (request, reply) => {
      if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });

      const params = request.params as {
        guildId?: unknown;
        region?: unknown;
        realmId?: unknown;
        characterId?: unknown;
      };
      if (
        typeof params.guildId !== "string" || !params.guildId ||
        typeof params.realmId !== "string" || !params.realmId ||
        typeof params.characterId !== "string" || !params.characterId
      ) {
        return reply.code(400).send({ error: "invalid_character_coordinate" });
      }
      const region = parseRegion(params.region);
      if (!region) return reply.code(400).send({ error: "invalid_character_coordinate" });
      if (params.guildId !== config.guild.id) return reply.code(404).send({ error: "guild_not_found" });

      const membership = await characterMembership({
        guildId: params.guildId,
        region,
        realmId: params.realmId,
        characterId: params.characterId,
      });

      return reply.send({
        guild_id: params.guildId,
        region,
        realm_id: params.realmId,
        character_id: params.characterId,
        membership: membership
          ? {
              currently_present: membership.currentlyPresent,
              rank: membership.rankIndex,
              character_name: membership.characterName,
              realm_name: membership.realmName,
              realm_slug: membership.realmSlug,
            }
          : null,
      });
    },
  );

  app.get("/api/v1/calendar/events", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const events = await discoverableGuildCalendarEvents();
    return reply.send({ events: events.map(calendarEventRepresentation) });
  });

  app.get("/api/v1/calendar/events/:eventId", async (request, reply) => {
    if (!readAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const eventId = calendarEventId(request);
    if (!eventId) return reply.code(400).send({ error: "invalid_calendar_event_coordinate" });
    const event = await guildCalendarEvent(eventId);
    if (!event) return reply.code(404).send({ error: "calendar_event_not_found" });
    return reply.send(calendarEventRepresentation(event));
  });

  app.post("/api/v1/calendar/events", async (request, reply) => {
    if (!writeAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const body = request.body as Record<string, unknown> | null;
    if (!body || Array.isArray(body)) return reply.code(400).send({ error: "invalid_calendar_event" });

    const title = requiredTitle(body.title);
    const occursAt = parseOccursAt(body.occurs_at);
    if (!title || !occursAt) return reply.code(400).send({ error: "invalid_calendar_event" });

    try {
      const event = await createGuildCalendarEvent({
        title,
        occursAt,
        category: optionalText(body.category),
        destination: optionalText(body.destination),
      });
      return reply.code(201).send(calendarEventRepresentation(event));
    } catch (error) {
      if (error instanceof Error && error.message === "invalid optional text") {
        return reply.code(400).send({ error: "invalid_calendar_event" });
      }
      throw error;
    }
  });

  app.patch("/api/v1/calendar/events/:eventId", async (request, reply) => {
    if (!writeAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const eventId = calendarEventId(request);
    if (!eventId) return reply.code(400).send({ error: "invalid_calendar_event_coordinate" });
    const body = request.body as Record<string, unknown> | null;
    if (!body || Array.isArray(body)) return reply.code(400).send({ error: "invalid_calendar_event" });

    const hasTitle = Object.hasOwn(body, "title");
    const hasOccursAt = Object.hasOwn(body, "occurs_at");
    const hasCategory = Object.hasOwn(body, "category");
    const hasDestination = Object.hasOwn(body, "destination");
    if (!hasTitle && !hasOccursAt && !hasCategory && !hasDestination) {
      return reply.code(400).send({ error: "invalid_calendar_event" });
    }

    const title = hasTitle ? requiredTitle(body.title) : undefined;
    const occursAt = hasOccursAt ? parseOccursAt(body.occurs_at) : undefined;
    if ((hasTitle && !title) || (hasOccursAt && !occursAt)) {
      return reply.code(400).send({ error: "invalid_calendar_event" });
    }

    try {
      const event = await updateGuildCalendarEvent(eventId, {
        title,
        occursAt,
        category: hasCategory ? optionalText(body.category) : undefined,
        destination: hasDestination ? optionalText(body.destination) : undefined,
      });
      return reply.send(calendarEventRepresentation(event));
    } catch (error) {
      if (error instanceof GuildCalendarEventNotFoundError) {
        return reply.code(404).send({ error: "calendar_event_not_found" });
      }
      if (error instanceof Error && error.message === "invalid optional text") {
        return reply.code(400).send({ error: "invalid_calendar_event" });
      }
      throw error;
    }
  });

  app.delete("/api/v1/calendar/events/:eventId", async (request, reply) => {
    if (!writeAuthorized(request)) return reply.code(401).send({ error: "invalid_machine_authority" });
    const eventId = calendarEventId(request);
    if (!eventId) return reply.code(400).send({ error: "invalid_calendar_event_coordinate" });

    try {
      await withdrawGuildCalendarEventOperation(eventId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof GuildCalendarEventNotFoundError) {
        return reply.code(404).send({ error: "calendar_event_not_found" });
      }
      throw error;
    }
  });
}
