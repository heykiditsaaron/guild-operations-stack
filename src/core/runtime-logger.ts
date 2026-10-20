import pino from "pino";

// One runtime logging contract for API, workers, and background processes.
// Technical diagnostics always go to stdout; operator publication is separate.
const levels = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
const requestedLevel = process.env.LOG_LEVEL?.toLowerCase() ?? "info";

export const runtimeLoggerOptions = {
  level: levels.has(requestedLevel) ? requestedLevel : "info",
  base: { service: "guild-operations", process: process.env.GUILD_OPERATIONS_PROCESS ?? "application" },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
  redact: {
    paths: [
      "token", "accessToken", "refreshToken", "clientSecret", "botToken",
      "authorization", "cookie", "headers.authorization", "headers.cookie",
      "req.headers.authorization", "req.headers.cookie",
      "config.botToken", "configuration.botToken",
      "*.token", "*.accessToken", "*.refreshToken", "*.clientSecret", "*.botToken",
    ],
    censor: "[REDACTED]",
  },
} satisfies pino.LoggerOptions;

export const runtimeLogger = pino(runtimeLoggerOptions);

export function componentLogger(component: string) {
  return runtimeLogger.child({ component });
}
