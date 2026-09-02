import { enrichGuildCharacters } from "./guild-character-enrichment.js";

try {
  const result = await enrichGuildCharacters();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.failed > 0 ? 1 : 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
