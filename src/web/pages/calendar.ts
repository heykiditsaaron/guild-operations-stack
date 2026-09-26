import type { FastifyInstance } from "fastify";
import { guildState } from "../../core/guild/guild-state.js";
import { authenticatedGuildie, SESSION_COOKIE_NAME } from "../../auth.js";
import { calendarViewForGuildie, isCalendarViewMode, setCalendarViewForGuildie, type CalendarViewMode } from "../../core/calendar/preference.js";
import { discoverableGuildCalendarPoints, type GuildCalendarOccursAt, type GuildCalendarPoint } from "../../core/calendar/registry.js";
import { activityOccurrence, type ActivityOccurrence } from "../../core/activity/registry.js";
import type { AssetRegistry } from "../assets.js";
import { htmlText, renderPage } from "../render.js";
import { viewerForRequest } from "../viewer.js";

type CalendarOccurrence = {
  point: GuildCalendarPoint;
  occurrence: ActivityOccurrence;
  occursAt: GuildCalendarOccursAt;
};

async function occurrenceForPoint(point: GuildCalendarPoint): Promise<ActivityOccurrence | null> {
  return activityOccurrence(point.sourceKind, point.sourceSubject);
}

async function calendarOccurrences(points: readonly GuildCalendarPoint[]): Promise<CalendarOccurrence[]> {
  const resolved = await Promise.all(points.map(async (point) => {
    const occurrence = await occurrenceForPoint(point);
    return occurrence ? { point, occurrence, occursAt: point.occursAt } : null;
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

function renderAttributeValue(attribute: ActivityOccurrence["attributes"][number]): string {
  if (attribute.value.kind === "quantity") {
    return `${htmlText(attribute.value.value)} ${htmlText(attribute.value.unit)}`;
  }
  return htmlText(String(attribute.value.value));
}

function renderEventItem(item: CalendarOccurrence, _canOperate: boolean): string {
  const { occurrence, occursAt } = item;
  const title = htmlText(occurrence.title);
  const category = htmlText(humanize(occurrence.activityKind));
  const description = occurrence.description
    ? `<p class="events-item-description">${htmlText(occurrence.description)}</p>`
    : "";
  const attributes = occurrence.attributes.slice(0, 3);
  const facts = attributes.length
    ? `<div class="facts">${attributes.map((attribute) => `<div class="fact"><span class="fact-label">${htmlText(attribute.label)}</span><strong class="fact-value">${renderAttributeValue(attribute)}</strong></div>`).join("")}</div>`
    : "";

  return `
    <article class="events-item" data-calendar-occurrence data-activity-kind="${htmlText(occurrence.activityKind)}" data-activity-id="${htmlText(occurrence.activityId)}" data-start-unix="${occursAt[0]}" data-end-unix="${occursAt.length === 2 ? occursAt[1] : occursAt[0]}">
      <div class="events-item-main">
        <div class="events-item-copy">
          <p class="events-item-category">${category}</p>
          <h3>${title}</h3>
          ${description}
          <div class="events-item-time">${eventTime(occursAt)}</div>
          ${facts}
        </div>
      </div>
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

export async function registerCalendarPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.post("/calendar/view", async (request, reply) => {
    const guildie = await authenticatedGuildie(request.cookies[SESSION_COOKIE_NAME]);
    if (!guildie) return reply.code(401).send({ error: "authentication_required" });
    const view = (request.body as { view?: unknown } | null)?.view;
    if (!isCalendarViewMode(view)) return reply.code(400).send({ error: "invalid_calendar_view" });
    await setCalendarViewForGuildie(guildie.guildieId, view);
    return reply.code(204).send();
  });

  app.get("/calendar", async (request, reply) => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const [viewer, guildie, calendarPoints, guild] = await Promise.all([
      viewerForRequest(sessionToken),
      authenticatedGuildie(sessionToken),
      discoverableGuildCalendarPoints(),
      guildState(),
    ]);
    const selectedView = guildie ? await calendarViewForGuildie(guildie.guildieId) : "agenda";
    const createEvent = "";

    const occurrences = await calendarOccurrences(calendarPoints);
    const relevant = occurrences.filter((event) => occursThrough(event.occursAt) >= nowUnix);
    const happeningNow = relevant.filter((event) => isHappeningNow(event.occursAt, nowUnix));
    const upcoming = relevant.filter((event) => !isHappeningNow(event.occursAt, nowUnix));
    const canOperateOccurrence = (_event: CalendarOccurrence): boolean => false;
    const guildCommunity = guild ? `${htmlText(guild.name)}&apos;s community` : "the guild&apos;s community";
    const body = `
      <div class="events-shell">
        ${renderCalendar(happeningNow, upcoming, occurrences, selectedView, canOperateOccurrence)}
        
      </div>`;

    const html = renderPage(assets, {
      pathname: "/calendar",
      title: `Calendar · ${viewer.guildPresentation.guildName} Guild Operations`,
      description: `See current and upcoming ${viewer.guildPresentation.guildName} guild activities.`,
      viewer,
      stylesheets: ["events.css"],
      scripts: ["events.js"],
      header: `
        <div class="events-page-header-row">
          <div class="events-page-header">
            <p class="eyebrow">Guild participation</p>
            <h1 id="page-title">Calendar</h1>
            <p class="lede">See what&apos;s happening in ${guildCommunity} and when.</p>
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
