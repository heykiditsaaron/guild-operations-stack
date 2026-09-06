import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../auth.js";
import {
  discoverableGuildEventCalendarListings,
  type GuildEventCalendarListing,
} from "../../../guild-events/calendar/registry.js";
import {
  guildEventOfferings,
  type GuildEventOffering,
} from "../../../guild-events/offerings/registry.js";
import type { AssetRegistry } from "../../assets.js";
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

function presentationFor(listing: GuildEventCalendarListing): EventPresentation {
  return {
    title: listing.guildEventTitle ?? humanize(listing.guildEventKind),
    category: listing.guildEventCategory
      ? humanize(listing.guildEventCategory)
      : "Guild Event",
    destination: listing.guildEventDestination,
  };
}

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function eventTime(listing: GuildEventCalendarListing): string {
  const [start, end] = listing.guildEventOccursAt;
  if (end === undefined) return localTime(start);
  return `${localTime(start)}<span class="events-time-separator" aria-hidden="true">→</span>${localTime(end)}`;
}

function occursThrough(listing: GuildEventCalendarListing): number {
  return listing.guildEventOccursAt.length === 2
    ? listing.guildEventOccursAt[1]
    : listing.guildEventOccursAt[0];
}

function isHappeningNow(listing: GuildEventCalendarListing, nowUnix: number): boolean {
  const [start, end] = listing.guildEventOccursAt;
  if (end === undefined) return start === nowUnix;
  return start <= nowUnix && nowUnix <= end;
}

function renderOffering(offering: GuildEventOffering): string {
  const title = htmlText(offering.title);
  const tagline = htmlText(offering.tagline);
  const destination = htmlText(offering.destination);

  return `
    <a class="events-offering" href="${destination}" aria-label="Explore ${title}">
      <div class="events-offering-copy">
        <p class="events-offering-kicker">Guild offering</p>
        <h3>${title}</h3>
        <p class="events-offering-tagline">${tagline}</p>
      </div>
      <span class="events-offering-action">
        <span>Explore</span>
        <span class="events-offering-arrow" aria-hidden="true">→</span>
      </span>
    </a>`;
}

function renderOfferings(offerings: readonly GuildEventOffering[]): string {
  if (!offerings.length) return "";

  return `
    <section class="events-offerings" aria-labelledby="events-offerings-title">
      <div class="events-section-heading">
        <p class="eyebrow">Participation offerings</p>
        <h2 id="events-offerings-title">Ways to join in</h2>
        <p>Explore the activities the guild operates, whether or not one is scheduled right now.</p>
      </div>
      <div class="events-offering-grid">
        ${offerings.map(renderOffering).join("\n")}
      </div>
    </section>`;
}

function renderEventItem(listing: GuildEventCalendarListing): string {
  const presentation = presentationFor(listing);
  const title = htmlText(presentation.title);
  const category = htmlText(presentation.category);
  const destination = presentation.destination ? htmlText(presentation.destination) : null;
  const content = `
      <div class="events-item-copy">
        <p class="events-item-category">${category}</p>
        <h3>${title}</h3>
        <div class="events-item-time">${eventTime(listing)}</div>
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
  listings: GuildEventCalendarListing[],
  state: "live" | "upcoming",
): string {
  if (!listings.length) return "";

  return `
    <section class="events-section" aria-labelledby="${id}">
      <h3 class="events-status-banner events-status-banner-${state}" id="${id}">${title}</h3>
      <div class="events-list">
        ${listings.map(renderEventItem).join("\n")}
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
  happeningNow: GuildEventCalendarListing[],
  upcoming: GuildEventCalendarListing[],
): string {
  const calendarBody = happeningNow.length || upcoming.length
    ? `
      <div class="events-discovery">
        ${renderSection("events-happening-now", "Happening now", happeningNow, "live")}
        ${renderSection("events-upcoming", "Upcoming", upcoming, "upcoming")}
      </div>`
    : emptyCalendarState();

  return `
    <section class="events-calendar" aria-labelledby="events-calendar-title">
      <div class="events-section-heading">
        <p class="eyebrow">Guild Event Calendar</p>
        <h2 id="events-calendar-title">What&apos;s happening</h2>
        <p>Current and upcoming guild-operated events, ordered by the temporal truth established by their owning modules.</p>
      </div>
      ${calendarBody}
    </section>`;
}

export async function registerEventsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events", async (request, reply) => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const [viewer, listings] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      discoverableGuildEventCalendarListings(),
    ]);
    const offerings = guildEventOfferings();

    const relevant = listings.filter((listing) => occursThrough(listing) >= nowUnix);
    const happeningNow = relevant.filter((listing) => isHappeningNow(listing, nowUnix));
    const upcoming = relevant.filter((listing) => !isHappeningNow(listing, nowUnix));

    const body = `
      <div class="events-shell">
        ${renderOfferings(offerings)}
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
          <p class="lede">Find ways to take part in guild life, then see what is happening now and what is coming up next.</p>
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
