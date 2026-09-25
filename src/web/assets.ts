import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

export type AssetName = string;

type WebAsset = { name: AssetName; contentType: string; body: Buffer; pathname: string; url: string };

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
]);

function fingerprint(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

function contentType(name: string): string {
  const type = contentTypes.get(extname(name).toLowerCase());
  if (!type) throw new Error(`Unsupported web asset type: ${name}`);
  return type;
}

async function assetFiles(directory: URL): Promise<Array<{ name: string; source: string }>> {
  const root = fileURLToPath(directory);
  let entries;
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") return [];
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name !== ".gitkeep")
    .map((entry) => {
      const source = join(entry.parentPath, entry.name);
      return { name: relative(root, source).replaceAll("\\", "/"), source };
    });
}

async function activityAssetFiles(): Promise<Array<{ name: string; source: string }>> {
  const activitiesDirectory = new URL("../activities/", import.meta.url);
  let activities;
  try {
    activities = await readdir(activitiesDirectory, { withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") return [];
    throw error;
  }

  const files = await Promise.all(
    activities
      .filter((entry) => entry.isDirectory())
      .map((entry) => assetFiles(new URL(`../activities/${entry.name}/public/`, import.meta.url))),
  );
  return files.flat();
}

export type AssetRegistry = ReadonlyMap<AssetName, WebAsset>;

export async function loadAssetRegistry(): Promise<AssetRegistry> {
  const files = [
    ...(await assetFiles(new URL("./public/", import.meta.url))),
    ...(await activityAssetFiles()),
  ];
  const assets = new Map<AssetName, WebAsset>();

  for (const { name, source } of files) {
    if (assets.has(name)) throw new Error(`Duplicate web asset: ${name}`);
    const body = await readFile(source);
    const extension = extname(name);
    const basename = name.slice(0, -extension.length);
    const pathname = `/assets/${basename}.${fingerprint(body)}${extension}`;
    assets.set(name, { name, contentType: contentType(name), body, pathname, url: pathname });
  }

  return assets;
}

export function assetUrl(assets: AssetRegistry, name: AssetName): string {
  const asset = assets.get(name);
  if (!asset) throw new Error(`Unknown web asset: ${name}`);
  return asset.url;
}

export async function registerAssetRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  for (const asset of assets.values()) {
    app.get(asset.pathname, async (_request, reply) =>
      reply.header("Cache-Control", "public, max-age=31536000, immutable").type(asset.contentType).send(asset.body),
    );
  }
}
