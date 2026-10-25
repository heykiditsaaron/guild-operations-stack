import { createServer, type Socket } from "node:net";
import { lstat } from "node:fs/promises";
import { decodeLifecycleMessage, MAX_LIFECYCLE_MESSAGE_BYTES } from "./lifecycle-socket-protocol.js";
import type { LifecycleRequest } from "./lifecycle-request.js";

/**
 * Host-side Unix socket listener. The host provisioner owns the socket path,
 * directory permissions, and process identity. Do not expose over TCP.
 * Authorization must be established before constructing this listener.
 */
export function createHostLifecycleSocketServer(
  execute: (request: LifecycleRequest) => Promise<void>,
  maxRequestMs = 120000,
) {
  let busy = false;
  return createServer((socket: Socket) => {
    let received = Buffer.alloc(0);
    let complete = false;
    socket.setTimeout(maxRequestMs);
    socket.on("timeout", () => socket.destroy());
    socket.on("data", (chunk: Buffer) => {
      if (complete) { socket.destroy(); return; }
      received = Buffer.concat([received, chunk]);
      if (received.length > MAX_LIFECYCLE_MESSAGE_BYTES) { socket.destroy(); return; }
      if (!received.includes(10)) return;
      complete = true;
      socket.pause();
      let request: LifecycleRequest;
      try { request = decodeLifecycleMessage(received); }
      catch { socket.end('{"ok":false}\n'); return; }
      if (busy) { socket.end('{"ok":false}\n'); return; }
      busy = true;
      void execute(request).then(
        () => socket.end('{"ok":true}\n'),
        () => socket.end('{"ok":false}\n'),
      ).finally(() => { busy = false; });
    });
  });
}

/** Fail closed when the host-owned socket directory is not private. */
export async function verifyHostSocketDirectory(directory: string): Promise<void> {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || (stat.mode & 0o007) !== 0) {
    throw new Error("Host executor socket directory must deny access to other users");
  }
}
