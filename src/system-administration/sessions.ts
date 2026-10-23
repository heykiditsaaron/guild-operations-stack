import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readAdministratorCredential, validAdministratorCredential } from "./authorization.js";

const SESSION_LIFETIME_MS = 15 * 60 * 1000;
type Session = { digest: string; credentialDigest: string; expiresAt: number };
export class AdministrationSessions {
  private readonly sessions = new Map<string, Session>();
  constructor(private readonly directory?: string) {}

  async create(credential: unknown): Promise<string | null> {
    if (!(await validAdministratorCredential(credential, this.directory))) return null;
    const credentialDigest = await readAdministratorCredential(this.directory);
    if (!credentialDigest) return null;
    const token = randomBytes(32).toString("hex");
    const digest = createHash("sha256").update(token).digest("hex");
    this.sessions.set(digest, { digest, credentialDigest, expiresAt: Date.now() + SESSION_LIFETIME_MS });
    return token;
  }

  async valid(token: unknown): Promise<boolean> {
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
    const digest = createHash("sha256").update(token).digest("hex");
    const session = this.sessions.get(digest);
    if (!session) return false;
    if (Date.now() >= session.expiresAt) { this.sessions.delete(digest); return false; }
    const current = await readAdministratorCredential(this.directory);
    if (!current || !timingSafeEqual(Buffer.from(current, "hex"), Buffer.from(session.credentialDigest, "hex"))) {
      this.sessions.delete(digest);
      return false;
    }
    return true;
  }

  revoke(token: unknown): void {
    if (typeof token === "string") this.sessions.delete(createHash("sha256").update(token).digest("hex"));
  }
}
