import type { FastifyInstance } from "fastify";
import { guildState } from "../../../application-state.js";
import { SESSION_COOKIE_NAME } from "../../../auth.js";
import {
  discoverableGuildCalendarEvents,
  type GuildCalendarEvent,
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
import { assetUrl, type AssetName, type AssetRegistry } from "../../assets.js";
import { htmlText, renderPage } from "../../render.js";
import { viewerForRequest } from "../../viewer.js";

type EventPresentation = {
  title: string;
  category: string;
  destination: string | null;
};

function humanize(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function presentationFor(event: GuildCalendarEvent): EventPresentation {
  return {
    title: event.title,
    category: event.category ? humanize(event.category) : "Guild Event",
    destination: event.destination,
  };
}

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function eventTime(event: GuildCalendarEvent): string {
  const [start, end] = event.occursAt;
  if (end === undefined) return localTime(start);
  return `${localTime(start)}<span class="events-time-separator" aria-hidden="true">→</span>${localTime(end)}`;
}

function occursThrough(event: GuildCalendarEvent): number {
  return event.occursAt.length === 2 ? event.occursAt[1] : event.occursAt[0];
}

function isHappeningNow(event: GuildCalendarEvent, nowUnix: number): boolean {
  const [start, end] = event.occursAt;
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
    <section class="events-offerings" aria-label="Participation offerings">
      <div class="events-offering-grid">
        ${offerings.map((offering) => renderOffering(offering, assets)).join("\n")}
      </div>
    </section>`;
}

function renderEventItem(event: GuildCalendarEvent): string {
  const presentation = presentationFor(event);
  const title = htmlText(presentation.title);
  const category = htmlText(presentation.category);
  const destination = presentation.destination ? htmlText(presentation.destination) : null;
  const content = `
      <div class="events-item-copy">
        <p class="events-item-category">${category}</p>
        <h3>${title}</h3>
        <div class="events-item-time">${eventTime(event)}</div>
      </div>
      ${destination ? '<span class="events-item-action">View event <span aria-hidden="true">→</span></span>' : ""}`;

  if (!destination) {
    return `<article class="events-item">${content}</article>`;
  }

  return `<a class="events-item events-item-link" href="${destination}" aria-label="View ${title}">${content}</a>`;
}

function renderSection(
  id: string,
  title: string,
  events: GuildCalendarEvent[],
  state: "live" | "upcoming",
): string {
  if (!events.length) return "";

  return `
    <section class="events-section" aria-labelledby="${id}">
      <h3 class="events-status-banner events-status-banner-${state}" id="${id}">${title}</h3>
      <div class="events-list">
        ${events.map(renderEventItem).join("\n")}
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
  happeningNow: GuildCalendarEvent[],
  upcoming: GuildCalendarEvent[],
): string {
  const calendarBody = happeningNow.length || upcoming.length
    ? `
      <div class="events-discovery">
        ${renderSection("events-happening-now", "Happening now", happeningNow, "live")}
        ${renderSection("events-upcoming", "Upcoming", upcoming, "upcoming")}
      </div>`
    : emptyCalendarState();

  return `
    <section class="events-calendar-widget" aria-labelledby="events-calendar-title">
      <h2 class="eyebrow events-calendar-title" id="events-calendar-title">Guild Event Calendar</h2>
      ${calendarBody}
    </section>`;
}

export async function registerEventsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events", async (request, reply) => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const [viewer, events, guild, moduleStates] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      discoverableGuildCalendarEvents(),
      guildState(),
      packagedModuleStates(),
    ]);
    const moduleStateByKey = new Map(moduleStates.map((module) => [module.key, module]));
    const offerings = guildEventOfferings().filter((offering) => offeringAvailable(offering.destination, moduleStateByKey));

    const relevant = events.filter((event) => occursThrough(event) >= nowUnix);
    const happeningNow = relevant.filter((event) => isHappeningNow(event, nowUnix));
    const upcoming = relevant.filter((event) => !isHappeningNow(event, nowUnix));
    const guildCommunity = guild ? `${htmlText(guild.name)}&apos;s community` : "the guild&apos;s community";

    const body = `
      <div class="events-shell">
        ${renderOfferings(offerings, assets)}
        ${renderCalendar(happeningNow, upcoming)}
      </div>`;

    const html = renderPage(assets, {
      pathname: "/events",
      title: "Events · OH CRIT I Pulled! Guild Operations",
      description: "Discover OH CRIT I Pulled! guild participation offerings and current or upcoming events.",
      viewer,
      stylesheets: ["events.css"],
      header: `
        <div class="events-page-header">
          <p class="eyebrow">Guild participation</p>
          <h1 id="page-title">Events</h1>
          <p class="lede">Find out ways to take part in ${guildCommunity}. Below you&apos;ll find what the guild offers and when you can join along.</p>
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
