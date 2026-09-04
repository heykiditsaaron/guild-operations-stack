import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "../../../auth.js";
import {
  discoverableGuildEventRegistrations,
  type GuildEventRegistration,
} from "../../../guild-events/registry.js";
import type { AssetRegistry } from "../../assets.js";
import { htmlText, renderPage } from "../../render.js";
import { viewerForRequest } from "../../viewer.js";

type EventPresentation = {
  title: string;
  category: string;
  href: string | null;
};

function humanize(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function presentationFor(registration: GuildEventRegistration): EventPresentation {
  if (registration.guildEventKind === "raffle-round") {
    return {
      title: "Guild Raffle",
      category: "Raffle",
      href: "/events/raffle",
    };
  }

  return {
    title: humanize(registration.guildEventKind),
    category: registration.guildEventCategory
      ? humanize(registration.guildEventCategory)
      : "Guild Event",
    href: null,
  };
}

function localTime(unixSeconds: number): string {
  const instant = new Date(unixSeconds * 1000).toISOString();
  return `<time datetime="${instant}" data-local-time-unix="${unixSeconds}" data-local-time-date-style="full">${instant}</time>`;
}

function eventTime(registration: GuildEventRegistration): string {
  const [start, end] = registration.guildEventOccursAt;
  if (end === undefined) return localTime(start);
  return `${localTime(start)}<span class="events-time-separator" aria-hidden="true">→</span>${localTime(end)}`;
}

function occursThrough(registration: GuildEventRegistration): number {
  return registration.guildEventOccursAt.length === 2
    ? registration.guildEventOccursAt[1]
    : registration.guildEventOccursAt[0];
}

function isHappeningNow(registration: GuildEventRegistration, nowUnix: number): boolean {
  const [start, end] = registration.guildEventOccursAt;
  if (end === undefined) return start === nowUnix;
  return start <= nowUnix && nowUnix <= end;
}

function renderEventCard(registration: GuildEventRegistration, happeningNow: boolean): string {
  const presentation = presentationFor(registration);
  const title = htmlText(presentation.title);
  const category = htmlText(presentation.category);
  const content = `
      <div class="events-card-heading">
        <div>
          <p class="events-card-category">${category}</p>
          <h3>${title}</h3>
        </div>
        ${happeningNow ? '<span class="events-live-label">Happening now</span>' : ""}
      </div>
      <div class="events-card-time">${eventTime(registration)}</div>
      ${presentation.href ? '<span class="events-card-action">View event <span aria-hidden="true">→</span></span>' : ""}`;

  if (!presentation.href) {
    return `<article class="events-card">${content}</article>`;
  }

  return `<a class="events-card events-card-link" href="${presentation.href}" aria-label="View ${title}">${content}</a>`;
}

function renderSection(
  id: string,
  title: string,
  intro: string,
  registrations: GuildEventRegistration[],
  happeningNow: boolean,
): string {
  if (!registrations.length) return "";

  return `
    <section class="events-section" aria-labelledby="${id}">
      <div class="events-section-heading">
        <h2 id="${id}">${title}</h2>
        <p>${intro}</p>
      </div>
      <div class="events-list">
        ${registrations.map((registration) => renderEventCard(registration, happeningNow)).join("\n")}
      </div>
    </section>`;
}

function emptyState(): string {
  return `
    <section class="events-empty" aria-labelledby="events-empty-title">
      <p class="eyebrow">Quiet for now</p>
      <h2 id="events-empty-title">Nothing is scheduled.</h2>
      <p>When the guild has something happening or coming up, it will appear here.</p>
    </section>`;
}

export async function registerEventsPage(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  app.get("/events", async (request, reply) => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const [viewer, registrations] = await Promise.all([
      viewerForRequest(request.cookies[SESSION_COOKIE_NAME]),
      discoverableGuildEventRegistrations(),
    ]);

    const relevant = registrations.filter((registration) => occursThrough(registration) >= nowUnix);
    const happeningNow = relevant.filter((registration) => isHappeningNow(registration, nowUnix));
    const upcoming = relevant.filter((registration) => !isHappeningNow(registration, nowUnix));

    const body = happeningNow.length || upcoming.length
      ? `
        <div class="events-discovery">
          ${renderSection(
            "events-happening-now",
            "Happening now",
            "Guild events whose registered time includes right now.",
            happeningNow,
            true,
          )}
          ${renderSection(
            "events-coming-up",
            "Coming up",
            "Guild events with participation ahead.",
            upcoming,
            false,
          )}
        </div>`
      : emptyState();

    const html = renderPage(assets, {
      pathname: "/events",
      title: "Events · OH CRIT I Pulled! Guild Operations",
      description: "Current and upcoming OH CRIT I Pulled! guild events.",
      viewer,
      stylesheets: ["events.css"],
      header: `
        <div class="events-page-header">
          <p class="eyebrow">Guild participation</p>
          <h1 id="page-title">Events</h1>
          <p class="lede">See what the guild is doing now and what is coming up next.</p>
        </div>`,
      body,
    });

    return reply
      .header("Cache-Control", "no-cache")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}
