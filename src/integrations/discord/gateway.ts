import { componentLogger } from "../../core/runtime-logger.js";
import { emitDiagnosticEvent } from "../../core/diagnostic-event.js";
import { observeDiscordFallback } from "./fallback-diagnostics.js";
import WebSocket from "ws";
import { discordIntegrationConfiguration } from "./configuration.js";
import { dispatchDiscordComponentInteraction, type DiscordComponentInteraction } from "./interaction-handlers.js";

const log = componentLogger("discord.gateway");

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENTS_GUILDS = 1;

type GatewayPayload = { op: number; d?: unknown; s?: number | null; t?: string | null };
type HelloPayload = { heartbeat_interval: number };

export type DiscordGatewayHealth = "connecting" | "ready" | "disconnected";

export class DiscordGateway {
  private socket: WebSocket | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private reconnect: NodeJS.Timeout | null = null;
  private sequence: number | null = null;
  private stopped = false;
  private heartbeatAcknowledged = true;
  private health: DiscordGatewayHealth = "disconnected";

  constructor(private readonly botToken: string, private readonly onHealth: (health: DiscordGatewayHealth) => void) {}

  start(): void { this.stopped = false; this.connect(); }
  stop(): void {
    this.stopped = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.reconnect) clearTimeout(this.reconnect);
    this.heartbeat = null; this.reconnect = null;
    this.socket?.close(1000);
    this.socket = null;
    this.setHealth("disconnected");
  }

  private setHealth(health: DiscordGatewayHealth): void {
    if (health === this.health) return;
    this.health = health;
    this.onHealth(health);
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    this.setHealth("connecting");
    const socket = new WebSocket(GATEWAY_URL);
    this.socket = socket;
    socket.on("message", (data) => {
      try {
        this.onMessage(data.toString());
      } catch (error) {
        log.error({ err: error }, "Discord Gateway message processing failed");
        socket.close();
      }
    });
    socket.on("close", () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null; this.socket = null;
      this.setHealth("disconnected");
      if (!this.stopped) this.reconnect = setTimeout(() => this.connect(), 5000);
    });
    socket.on("error", (error) => log.error({ err: error }, "Discord Gateway socket error"));
  }

  private onMessage(raw: string): void {
    const payload = JSON.parse(raw) as GatewayPayload;
    if (typeof payload.s === "number") this.sequence = payload.s;
    if (payload.op === 10) {
      const hello = payload.d as HelloPayload;
      this.heartbeatAcknowledged = true;
      this.heartbeat = setInterval(() => {
        if (!this.heartbeatAcknowledged) { this.socket?.close(); return; }
        this.heartbeatAcknowledged = false;
        this.send({ op: 1, d: this.sequence });
      }, hello.heartbeat_interval);
      this.send({
        op: 2,
        d: {
          token: this.botToken,
          intents: INTENTS_GUILDS,
          properties: { os: process.platform, browser: "guild-operations", device: "guild-operations" },
        },
      });
      return;
    }
    if (payload.op === 1) { this.heartbeatAcknowledged = false; this.send({ op: 1, d: this.sequence }); return; }
    if (payload.op === 11) { this.heartbeatAcknowledged = true; return; }
    if (payload.op === 7) { this.socket?.close(); return; }
    if (payload.op === 9) { this.sequence = null; this.socket?.close(); return; }
    if (payload.op === 0 && payload.t === "READY") this.setHealth("ready");
    if (payload.op === 0 && payload.t === "INTERACTION_CREATE") {
      void this.handleInteraction(payload.d as DiscordComponentInteraction & { token?: string }).catch((error) => log.error({ err: error, interactionId: (payload.d as DiscordComponentInteraction)?.id }, "Discord Gateway interaction failed"));
    }
  }

  private async handleInteraction(interaction: DiscordComponentInteraction & { token?: string }): Promise<void> {
    if ((interaction.type !== 3 && interaction.type !== 5) || !interaction.id || !interaction.token || !interaction.application_id) return;
    const config = await discordIntegrationConfiguration();
    if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId ||
        config.botToken !== this.botToken || interaction.application_id !== config.applicationId ||
        interaction.guild_id !== config.discordGuildId) return;
    const callback = `https://discord.com/api/v10/interactions/${encodeURIComponent(interaction.id)}/${encodeURIComponent(interaction.token)}/callback`;
    // Modal responses must be sent as the initial interaction callback, never as a webhook edit.
    // These Raffle components can open a modal depending on current participation state.
    if (/^go:raffle:(enter|character|deny):[0-9a-f-]{36}$/.test(interaction.data?.custom_id ?? "")) {
      const startedAt = Date.now();
      const interactionKind = interaction.data?.custom_id?.split(":").slice(0, 3).join(":");
      try {
        const response = await dispatchDiscordComponentInteraction(interaction);
        const delivered = await fetch(callback, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });
        if (!delivered.ok) throw new Error(`discord_gateway_callback_${delivered.status}`);
        log.info({ interactionId: interaction.id, interactionKind, responseType: response.type, durationMs: Date.now() - startedAt }, "Discord Gateway interaction completed");
      } catch (error) {
        await emitDiagnosticEvent({
          severity: "error", source: "discord.gateway", operation: "interaction-delivery",
          kind: "exception", summary: "Discord Gateway initial interaction callback failed",
          correlation: { interactionId: interaction.id }, runtimeError: error,
          details: { interactionKind: interactionKind ?? "unknown", durationMs: Date.now() - startedAt },
        }, log);
        // An unacknowledged interaction can still receive an ephemeral error.
        await observeDiscordFallback(
          fetch(callback, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: 4, data: { flags: 64, content: "The interaction could not be completed. Please try again or use Guild Operations." } }),
          }),
          log, { interactionId: interaction.id, interactionKind },
          "Discord Gateway initial interaction failure response was rejected",
          "Discord Gateway initial interaction failure response could not be delivered",
        );
      }
      return;
    }
    const acknowledged = await fetch(callback, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(/^go:raid:(character|spec):/.test(interaction.data?.custom_id ?? "") ? { type: 6 } : { type: 5, data: { flags: 64 } }),
    });
    if (!acknowledged.ok) throw new Error(`discord_gateway_ack_${acknowledged.status}`);
    const startedAt = Date.now();
    const interactionKind = interaction.data?.custom_id?.split(":").slice(0, 3).join(":");
    try {
      const response = await dispatchDiscordComponentInteraction(interaction);
      const { flags: _flags, ...data } = response.data ?? { content: "Interaction unavailable." };
      if (!("components" in data)) Object.assign(data, { components: [] });
      const result = await fetch(`https://discord.com/api/v10/webhooks/${encodeURIComponent(config.applicationId)}/${encodeURIComponent(interaction.token)}/messages/@original`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!result.ok) throw new Error(`discord_gateway_edit_${result.status}`);
      log.info({ interactionId: interaction.id, interactionKind, responseType: response.type, durationMs: Date.now() - startedAt }, "Discord Gateway interaction completed");
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const failureCode = error instanceof Error && /^discord_gateway_(?:ack|edit)_[0-9]{3}$/.test(error.message)
        ? error.message : "discord_gateway_dispatch_failure";
      await emitDiagnosticEvent({
        severity: "error", source: "discord.gateway", operation: "interaction-delivery",
        kind: "exception", summary: "Discord Gateway interaction dispatch failed",
        correlation: { interactionId: interaction.id }, runtimeError: error,
        details: { interactionKind: interactionKind ?? "unknown", durationMs, failureCode },
      }, log);
      await observeDiscordFallback(
        fetch(`https://discord.com/api/v10/webhooks/${encodeURIComponent(config.applicationId)}/${encodeURIComponent(interaction.token)}/messages/@original`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "The interaction could not be completed. Please try again or use Guild Operations.", components: [] }),
        }),
        log,
        { interactionId: interaction.id, interactionKind },
        "Discord Gateway interaction failure response was rejected",
        "Discord Gateway interaction failure response could not be delivered",
      );
    }
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }
}
