import { componentLogger } from "../../core/runtime-logger.js";
import { publishInspectionBestEffort } from "../../core/operational-inspection/best-effort.js";
import { publishOperationalRecord } from "../../operational-inspection.js";
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
    socket.on("message", (data) => this.onMessage(data.toString()));
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
    if (interaction.type !== 3 || !interaction.id || !interaction.token || !interaction.application_id) return;
    const config = await discordIntegrationConfiguration();
    if (!config?.enabled || !config.applicationVerifiedAt || !config.discordGuildId ||
        config.botToken !== this.botToken || interaction.application_id !== config.applicationId ||
        interaction.guild_id !== config.discordGuildId) return;
    const callback = `https://discord.com/api/v10/interactions/${encodeURIComponent(interaction.id)}/${encodeURIComponent(interaction.token)}/callback`;
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
      log.error({ err: error, interactionId: interaction.id, interactionKind, durationMs: Date.now() - startedAt }, "Discord Gateway interaction dispatch failed");
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
      // Only stable internal failure codes are safe for operator-visible details.
      // Arbitrary provider messages and stacks stay in the redacted runtime log.
      const failureCode = error instanceof Error && /^discord_gateway_(?:ack|edit)_[0-9]{3}$/.test(error.message)
        ? error.message
        : "discord_gateway_dispatch_failure";
      await publishInspectionBestEffort(
        () => publishOperationalRecord({
          source: "discord.gateway", operation: "interaction-delivery", kind: "exception",
          summary: "Discord interaction response could not be delivered",
          details: { interactionId: interaction.id, interactionKind, failureCode },
        }),
        (inspectionError) => log.error({ err: inspectionError, interactionId: interaction.id, interactionKind }, "Discord Gateway failure inspection publication failed"),
        () => {},
      );
    }
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }
}
