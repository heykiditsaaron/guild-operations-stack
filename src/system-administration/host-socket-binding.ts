import { chmod, lstat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Server } from "node:net";
import { verifyHostSocketDirectory } from "./host-lifecycle-socket.js";

/**
 * Bind only within a host-provisioned private directory. The provisioner
 * must assign the directory and socket group to the authorized client identity.
 * Never unlink an existing path: stale sockets require explicit host recovery.
 */
export async function bindHostLifecycleSocket(server: Server, socketPath: string): Promise<void> {
  if (!isAbsolute(socketPath) || resolve(socketPath) !== socketPath) {
    throw new Error("Host executor socket path must be absolute and canonical");
  }
  await verifyHostSocketDirectory(dirname(socketPath));
  try {
    await lstat(socketPath);
    throw new Error("Host executor socket path already exists");
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  await new Promise<void>((resolveListen, reject) => {
    const onError = (error: Error) => { server.off("listening", onListening); reject(error); };
    const onListening = () => { server.off("error", onError); resolveListen(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(socketPath);
  });
  try {
    await chmod(socketPath, 0o660);
    const stat = await lstat(socketPath);
    if (!stat.isSocket() || (stat.mode & 0o007) !== 0) {
      throw new Error("Host executor socket permissions are unsafe");
    }
  } catch (error) {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    throw error;
  }
}
