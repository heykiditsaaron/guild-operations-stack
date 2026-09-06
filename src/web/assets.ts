import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export type AssetName =
  | "app.css"
  | "app.js"
  | "navigation-shelves.css"
  | "navigation-shelves.js"
  | "home-raffle.css"
  | "events.css"
  | "admin.css"
  | "raffle.css"
  | "raffle-admin.css"
  | "raffle-winner.css"
  | "raffle.js"
  | "raffle-entry.js"
  | "raffle-public.js"
  | "images/raffle/gold-sack.png";

type WebAsset = {
  name: AssetName;
  contentType: string;
  body: Buffer;
  pathname: string;
  url: string;
};

const assetDefinitions: Array<{ name: AssetName; contentType: string }> = [
  { name: "app.css", contentType: "text/css; charset=utf-8" },
  { name: "navigation-shelves.css", contentType: "text/css; charset=utf-8" },
  { name: "home-raffle.css", contentType: "text/css; charset=utf-8" },
  { name: "events.css", contentType: "text/css; charset=utf-8" },
  { name: "admin.css", contentType: "text/css; charset=utf-8" },
  { name: "raffle.css", contentType: "text/css; charset=utf-8" },
  { name: "raffle-admin.css", contentType: "text/css; charset=utf-8" },
  { name: "raffle-winner.css", contentType: "text/css; charset=utf-8" },
  { name: "app.js", contentType: "text/javascript; charset=utf-8" },
  { name: "navigation-shelves.js", contentType: "text/javascript; charset=utf-8" },
  { name: "raffle.js", contentType: "text/javascript; charset=utf-8" },
  { name: "raffle-entry.js", contentType: "text/javascript; charset=utf-8" },
  { name: "raffle-public.js", contentType: "text/javascript; charset=utf-8" },
  { name: "images/raffle/gold-sack.png", contentType: "image/png" },
];

function fingerprint(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

export type AssetRegistry = ReadonlyMap<AssetName, WebAsset>;

export async function loadAssetRegistry(): Promise<AssetRegistry> {
  const entries = await Promise.all(
    assetDefinitions.map(async ({ name, contentType }) => {
      const sourceUrl = new URL(`./public/${name}`, import.meta.url);
      const body = await readFile(fileURLToPath(sourceUrl));
      const extensionIndex = name.lastIndexOf(".");
      const basename = name.slice(0, extensionIndex);
      const extension = name.slice(extensionIndex);
      const pathname = `/assets/${basename}.${fingerprint(body)}${extension}`;
      return [
        name,
        {
          name,
          contentType,
          body,
          pathname,
          url: new URL(pathname, config.appOrigin).toString(),
        },
      ] as const;
    }),
  );

  return new Map(entries);
}

export function assetUrl(assets: AssetRegistry, name: AssetName): string {
  const asset = assets.get(name);
  if (!asset) throw new Error(`Unknown web asset: ${name}`);
  return asset.url;
}

export async function registerAssetRoutes(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  for (const asset of assets.values()) {
    app.get(asset.pathname, async (_request, reply) => {
      return reply
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .type(asset.contentType)
        .send(asset.body);
    });
  }
}
