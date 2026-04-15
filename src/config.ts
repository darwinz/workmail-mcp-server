import { z } from "zod";

const ConfigSchema = z.object({
  ewsEndpoint: z
    .string()
    .url()
    .default("https://ews.mail.us-west-2.awsapps.com/EWS/Exchange.asmx"),
  maxEmailsPerRequest: z.coerce.number().int().min(1).max(100).default(25),
  maxCalendarDaysRange: z.coerce.number().int().min(1).max(90).default(30),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(60).default(30),
  logLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    ewsEndpoint: process.env.WORKMAIL_MCP_EWS_ENDPOINT,
    maxEmailsPerRequest: process.env.WORKMAIL_MCP_MAX_EMAILS,
    maxCalendarDaysRange: process.env.WORKMAIL_MCP_MAX_CALENDAR_DAYS,
    rateLimitPerMinute: process.env.WORKMAIL_MCP_RATE_LIMIT,
    logLevel: process.env.WORKMAIL_MCP_LOG_LEVEL,
  });
}
