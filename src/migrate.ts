import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(here, "../sql/001_initial.sql");
const sql = await readFile(migrationPath, "utf8");

await pool.query(sql);
await pool.end();
console.log("Database migration complete");
