import type { FastifyInstance } from "fastify";
import { guildState } from "../../../application-state.js";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../../auth.js";
import {
  calendarViewForGuildie,
  isCalendarViewMode,
  setCalendarViewForGuildie,
  type CalendarViewMode,
} from "../../../calendar-preference.js";
import {
  RAID_ASSIGN_CAPABILITY,
  RAID_MODIFY_CAPABILITY,
  RAID_STAGE_CAPABILITY,
  RAFFLE_CLAIMS_CAPABILITY,
  RAFFLE_DRAW_CAPABILITY,
  RAFFLE_MODIFY_CAPABILITY,
  RAFFLE_STAGE_CAPABILITY,
  guildieHasGuildCapability,
  guildieHasGuildCapabilityOrOperator,
} from "../../../guild-permissions.js";
import {
  discoverableGuildCalendarPoints,
  type GuildCalendarOccursAt,
  type GuildCalendarPoint,
} from "../../../guild-events/calendar/registry.js";
import {
  guildEventOfferings,
  type GuildEventOffering,
} from "../../../guild-events/offerings/registry.js";
import {
  packagedModuleForPath,
  packagedModuleStates,
  type PackagedModuleState,
} from "../../../module-lifecycle.js";
import { raffleCalendarProjection } from "../../../modules/raffle/application.js";
import { raidCalendarProjection } from "../../../modules/raid/application.js";
import { assetUrl, type AssetName, type AssetRegistry } from "../../assets.js";
import { htmlText, renderPage } from "../../render.js";
import { viewerForRequest } from "../../viewer.js";

type CalendarProjection = {
  title: string;
  description: string | null;
  category: string;
  publicAction: { label: string; href: string };
  participationAction: { label: string; href: string } | null;
  operationAction: { label: string; href: string };
};

type CalendarOccurrence = {
  point: GuildCalendarPoint;
  projection: CalendarProjection;
  occursAt: GuildCalendarOccursAt;
};

async function projectionForPoint(point: GuildCalendarPoint): Promise<CalendarProjection | null> {
  if (point.sourceKind === "raid") return raidCalendarProjection(point.sourceSubject);
  if (point.sourceKind === "raffle") return raffleCalendarProjection(point.sourceSubject);
  return null;
}

async function calendarOccurrences(points: readonly GuildCalendarPoint[]): Promise<CalendarOccurrence[]> {
  const resolved = await Promise.all(points.map(async (point) => {
    const projection = await projectionForPoint(point);
    return projection ? { point, projection, occursAt: point.occursAt } : null;
  }));
  return resolved.filter((item): item is CalendarOccurrence => item !== null);
}

function humanize(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function eventTime(occurrence: GuildCalendarOccursAt): string {
  const [start, end] = occurrence;
  if (end === undefined) return localTime(start);
  return `${localTime(start)}<span class="events-time-separator" aria-hidden="true">→</span>${localTime(end)}`;
}

function occursThrough(occurrence: GuildCalendarOccursAt): number {
  return occurrence.length === 2 ? occurrence[1] : occurrence[0];
}

function isHappeningNow(occurrence: GuildCalendarOccursAt, nowUnix: number): boolean {
  const [start, end] = occurrence;
  if (end === undefined) return start === nowUnix;
  return start <= nowUnix && nowUnix <= end;
}

function offeringAvailable(
  destination: string,
  modules: Map<string, PackagedModuleState>,
): boolean {
  const moduleKey = packagedModuleForPath(destination);
  return moduleKey === null || modules.get(moduleKey)?.enabled !== false;
}

function offeringArtworkUrl(offering: GuildEventOffering, assets: AssetRegistry): string | null {
  if (!offering.artwork) return null;
  if (offering.artwork.kind === "url") return offering.artwork.url;
  return assetUrl(assets, offering.artwork.asset as AssetName);
}

function renderOffering(offering: GuildEventOffering, assets: AssetRegistry): string {
  const title = htmlText(offering.title);
  const tagline = htmlText(offering.tagline);
  const destination = htmlText(offering.destination);
  const artwork = offeringArtworkUrl(offering, assets);
  const artworkMarkup = artwork
    ? `<img class="events-offering-art" src="${htmlText(artwork)}" alt="" aria-hidden="true">`
    : "";
  const artworkClass = artwork ? " events-offering-with-art" : "";

  return `
    <a class="events-offering${artworkClass}" href="${destination}" aria-label="Check out ${title}">
      <div class="events-offering-main">
        ${artworkMarkup}
        <div class="events-offering-copy">
          <p class="events-offering-kicker">Guild activity</p>
          <h2>${title}</h2>
          <p class="events-offering-tagline">${tagline}</p>
        </div>
      </div>
      <span class="events-offering-action">
        <span>Check it out</span>
        <span class="events-offering-arrow" aria-hidden="true">→</span>
      </span>
    </a>`;
}

function renderOfferings(offerings: readonly GuildEventOffering[], assets: AssetRegistry): string {
  if (!offerings.length) return "";

  return `
    <section class="events-offerings" aria-labelledby="events-offerings-title">
      <h2 class="eyebrow events-section-title" id="events-offerings-title">More ways to participate</h2>
      <div class="events-offering-grid">
        ${offerings.map((offering) => renderOffering(offering, assets)).join("\n")}
      </div>
    </section>`;
}

function renderEventItem(item: CalendarOccurrence, canOperate: boolean): string {
  const { projection, occursAt } = item;
  const title = htmlText(projection.title);
  const category = htmlText(humanize(projection.category));
  const publicHref = htmlText(projection.publicAction.href);
  const publicLabel = htmlText(projection.publicAction.label);
  const description = projection.description
    ? `<p class="events-item-description">${htmlText(projection.description)}</p>`
    : "";
  const participationAction = projection.participationAction
    ? `<a class="button button-primary events-item-secondary-action" href="${htmlText(projection.participationAction.href)}">${htmlText(projection.participationAction.label)}</a>`
    : "";
  const operationAction = canOperate
    ? `<a class="button button-secondary events-item-secondary-action" href="${htmlText(projection.operationAction.href)}">Manage</a>`
    : "";

  return `
    <article class="events-item" data-calendar-occurrence data-start-unix="${occursAt[0]}" data-end-unix="${occursAt.length === 2 ? occursAt[1] : occursAt[0]}">
      <a class="events-item-main events-item-link" href="${publicHref}" aria-label="${publicLabel}: ${title}">
        <div class="events-item-copy">
          <p class="events-item-category">${category}</p>
          <h3>${title}</h3>
          ${description}
          <div class="events-item-time">${eventTime(occursAt)}</div>
        </div>
        <span class="events-item-action">${publicLabel} <span aria-hidden="true">→</span></span>
      </a>
      ${participationAction || operationAction ? `<nav class="events-item-actions" aria-label="${title} actions">${participationAction}${operationAction}</nav>` : ""}
    </article>`;
}

function renderSection(
  id: string,
  title: string,
  events: CalendarOccurrence[],
  state: "live" | "upcoming",
  canOperate: (event: CalendarOccurrence) => boolean,
): string {
  if (!events.length) return "";

  return `
    <section class="events-section" aria-labelledby="${id}">
      <h3 class="events-status-banner events-status-banner-${state}" id="${id}">${title}</h3>
      <div class="events-list">
        ${events.map((event) => renderEventItem(event, canOperate(event))).join("\n")}
      </div>
    </section>`;
}

function emptyCalendarState(): string {
  return `
    <div class="events-empty">
      <p class="eyebrow">Quiet for now</p>
      <h3>Nothing is scheduled.</h3>
      <p>When the guild has something happening or coming up, it will appear here.</p>
    </div>`;
}

function renderCalendar(
  happeningNow: CalendarOccurrence[],
  upcoming: CalendarOccurrence[],
  occurrences: CalendarOccurrence[],
  selectedView: CalendarViewMode,
  canOperate: (event: CalendarOccurrence) => boolean,
): string {
  const calendarBody = happeningNow.length || upcoming.length
    ? `
      <div class="events-discovery">
        ${renderSection("events-happening-now", "Happening now", happeningNow, "live", canOperate)}
        ${renderSection("events-upcoming", "Upcoming", upcoming, "upcoming", canOperate)}
      </div>`
    : emptyCalendarState();

  return `
    <section class="events-calendar-widget" aria-labelledby="events-calendar-title" data-calendar-initial-view="${selectedView}">
      <div class="events-calendar-heading">
        <h2 class="eyebrow events-calendar-title" id="events-calendar-title">What&apos;s happening</h2>
        <div class="events-view-switcher" role="group" aria-label="Calendar view">
          <button type="button" class="events-view-option" data-calendar-view="agenda" aria-label="Agenda view" title="Agenda" aria-pressed="false"><span aria-hidden="true">☷</span></button>
          <button type="button" class="events-view-option" data-calendar-view="week" aria-label="Week view" title="Week" aria-pressed="false"><span aria-hidden="true">▥</span></button>
          <button type="button" class="events-view-option" data-calendar-view="month" aria-label="Month view" title="Month" aria-pressed="false"><span aria-hidden="true">▦</span></button>
        </div>
      </div>
      <div class="events-view-panel" data-calendar-panel="agenda">
        ${calendarBody}
      </div>
      <div class="events-view-panel" data-calendar-panel="week" hidden>
        <div class="events-period-toolbar">
          <button type="button" class="button button-secondary events-period-nav" data-calendar-shift="-1" aria-label="Previous week">←</button>
          <strong data-calendar-period-label></strong>
          <button type="button" class="button button-secondary events-period-nav" data-calendar-shift="1" aria-label="Next week">→</button>
        </div>
        <div class="events-week" data-calendar-week></div>
      </div>
      <div class="events-view-panel" data-calendar-panel="month" hidden>
        <div class="events-period-toolbar">
          <button type="button" class="button button-secondary events-period-nav" data-calendar-shift="-1" aria-label="Previous month">←</button>
          <strong data-calendar-period-label></strong>
          <button type="button" class="button button-secondary events-period-nav" data-calendar-shift="1" aria-label="Next month">→</button>
        </div>
        <div class="events-month" data-calendar-month></div>
      </div>
      <div class="events-calendar-source" hidden>
        ${occurrences.map((event) => renderEventItem(event, canOperate(event))).join("\n")}
      </div>
    </section>`;
}

export async function registerEventsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.post("/events/view", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    const view = (request.body as { view?: unknown } | null)?.view;
    if (!isCalendarViewMode(view)) return reply.code(400).send({ error: "invalid_calendar_view" });
    await setCalendarViewForGuildie(guildie.guildieId, view);
    return reply.code(204).send();
  });

  app.get("/events", async (request, reply) => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie, calendarPoints, guild, moduleStates] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
      discoverableGuildCalendarPoints(),
      guildState(),
      packagedModuleStates(),
    ]);
    const selectedView = guildie ? await calendarViewForGuildie(guildie.guildieId) : "agenda";
    const [canCreateRaid, canCreateRaffle, canOperateRaid, canOperateRaffle] = guildie
      ? await Promise.all([
          guildieHasGuildCapability(guildie.guildieId, RAID_MODIFY_CAPABILITY),
          guildieHasGuildCapability(guildie.guildieId, RAFFLE_MODIFY_CAPABILITY),
          Promise.all([
            RAID_MODIFY_CAPABILITY,
            RAID_STAGE_CAPABILITY,
            RAID_ASSIGN_CAPABILITY,
          ].map((capability) => guildieHasGuildCapabilityOrOperator(guildie.guildieId, capability))).then((values) => values.some(Boolean)),
          Promise.all([
            RAFFLE_MODIFY_CAPABILITY,
            RAFFLE_STAGE_CAPABILITY,
            RAFFLE_CLAIMS_CAPABILITY,
            RAFFLE_DRAW_CAPABILITY,
          ].map((capability) => guildieHasGuildCapabilityOrOperator(guildie.guildieId, capability))).then((values) => values.some(Boolean)),
        ])
      : [false, false, false, false];
    const moduleStateByKey = new Map(moduleStates.map((module) => [module.key, module]));
    const offerings = guildEventOfferings().filter((offering) => offeringAvailable(offering.destination, moduleStateByKey));
    const raidEnabled = moduleStateByKey.get("raid")?.enabled !== false;
    const raffleEnabled = moduleStateByKey.get("raffle")?.enabled !== false;
    const createChoices = [
      raidEnabled && canCreateRaid
        ? `<a href="/events/raid/manage"><strong>Raid</strong><span>Schedule a guild raid</span></a>`
        : "",
      raffleEnabled && canCreateRaffle
        ? `<a href="/events/raffle/manage"><strong>Raffle</strong><span>Establish a guild raffle</span></a>`
        : "",
    ].filter(Boolean).join("");
    const createEvent = createChoices
      ? `<details class="events-create"><summary class="button button-primary">Create New Event</summary><div class="events-create-menu" role="menu">${createChoices}</div></details>`
      : "";

    const occurrences = await calendarOccurrences(calendarPoints);
    const relevant = occurrences.filter((event) => occursThrough(event.occursAt) >= nowUnix);
    const happeningNow = relevant.filter((event) => isHappeningNow(event.occursAt, nowUnix));
    const upcoming = relevant.filter((event) => !isHappeningNow(event.occursAt, nowUnix));
    const canOperateOccurrence = (event: CalendarOccurrence): boolean =>
      event.point.sourceKind === "raid"
        ? canOperateRaid
        : event.point.sourceKind === "raffle"
          ? canOperateRaffle
          : false;
    const guildCommunity = guild ? `${htmlText(guild.name)}&apos;s community` : "the guild&apos;s community";
    const body = `
      <div class="events-shell">
        ${renderCalendar(happeningNow, upcoming, occurrences, selectedView, canOperateOccurrence)}
        ${renderOfferings(offerings, assets)}
      </div>`;

    const html = renderPage(assets, {
      pathname: "/events",
      title: `Events · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: `Discover ${viewer.guildPresentation.guildName} guild participation offerings and current or upcoming events.`,
      viewer,
      stylesheets: ["events.css"],
      scripts: ["events.js"],
      header: `
        <div class="events-page-header-row">
          <div class="events-page-header">
            <p class="eyebrow">Guild participation</p>
            <h1 id="page-title">Events</h1>
            <p class="lede">Find out what&apos;s happening in ${guildCommunity} and ways you can take part.</p>
          </div>
          ${createEvent}
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
