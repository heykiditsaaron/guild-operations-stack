import { createConnection } from "node:net";
import { validateLifecycleRequest, type LifecycleRequest } from "./lifecycle-request.js";

export const MAX_LIFECYCLE_MESSAGE_BYTES = 1024;

/** Minimal versioned request envelope; no paths, commands, or credentials cross the socket. */
export function encodeLifecycleMessage(value: unknown): Buffer {
  const request = validateLifecycleRequest(value);
  return Buffer.from(JSON.stringify(request) + "\n", "utf8");
}

export function decodeLifecycleMessage(bytes: Buffer): LifecycleRequest {
  if (bytes.length > MAX_LIFECYCLE_MESSAGE_BYTES || bytes.at(-1) !== 10 ||
      bytes.subarray(0, -1).includes(10)) {
    throw new Error("Invalid lifecycle message framing");
  }
  let value: unknown;
  try { value = JSON.parse(bytes.subarray(0, -1).toString("utf8")); }
  catch { throw new Error("Invalid lifecycle message JSON"); }
  return validateLifecycleRequest(value);
}

/**
 * Client transport only. Socket permissions and peer authorization belong to
 * the host-owned service. A response never includes Docker diagnostics.
 */
export async function submitLifecycleRequest(
  socketPath: string,
  request: unknown,
  timeoutMs = 5000,
): Promise<void> {
  if (!socketPath.startsWith("/") || socketPath.includes("\0")) {
    throw new Error("Absolute Unix socket path required");
  }
  const message = encodeLifecycleMessage(request);
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    let response = Buffer.alloc(0);
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => socket.write(message));
    socket.on("data", (chunk: Buffer) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > MAX_LIFECYCLE_MESSAGE_BYTES) {
        socket.destroy(new Error("Oversized executor response"));
        return;
      }
      if (response.includes(10)) socket.end();
    });
    socket.on("timeout", () => socket.destroy(new Error("Executor response timed out")));
    socket.on("error", reject);
    socket.on("close", () => {
      if (response.equals(Buffer.from('{"ok":true}\n'))) resolve();
      else reject(new Error("Host executor did not confirm lifecycle request"));
    });
  });
}
