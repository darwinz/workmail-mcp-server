import { Sanitizer } from "./sanitizer";

type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class Logger {
  private readonly level: number;
  private readonly sanitize: Sanitizer;

  constructor(level: LogLevel, sanitize: Sanitizer) {
    this.level = LEVEL_ORDER[level];
    this.sanitize = sanitize;
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log("error", msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log("warn", msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log("info", msg, data);
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log("debug", msg, data);
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] > this.level) return;

    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...data,
    });

    // stdout is reserved for MCP protocol — always use stderr
    process.stderr.write(this.sanitize(entry) + "\n");
  }
}
