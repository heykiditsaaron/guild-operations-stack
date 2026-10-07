import WebSocket from "ws";

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
    socket.on("error", (error) => console.error("Discord Gateway socket error", error));
  }

  private onMessage(raw: string): void {
    const payload = JSON.parse(raw) as GatewayPayload;
    if (typeof payload.s === "number") this.sequence = payload.s;
    if (payload.op === 10) {
      const hello = payload.d as HelloPayload;
      this.heartbeat = setInterval(() => this.send({ op: 1, d: this.sequence }), hello.heartbeat_interval);
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
    if (payload.op === 1) { this.send({ op: 1, d: this.sequence }); return; }
    if (payload.op === 7) { this.socket?.close(); return; }
    if (payload.op === 9) { this.sequence = null; this.socket?.close(); return; }
    if (payload.op === 0 && payload.t === "READY") this.setHealth("ready");
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }
}
