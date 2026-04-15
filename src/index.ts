import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config";
import { getCredentials } from "./credentials";
import { createSanitizer } from "./sanitizer";
import { RateLimiter } from "./rate-limiter";
import { Logger } from "./logger";
import { EwsClient } from "./ews-client";
import {
  ListEmailsSchema,
  ReadEmailSchema,
  SearchEmailsSchema,
  SendEmailSchema,
  ListCalendarEventsSchema,
  GetCalendarEventSchema,
  CreateCalendarEventSchema,
} from "./schemas";

async function main() {
  // 1. Load configuration
  const config = loadConfig();

  // 2. Retrieve credentials from macOS Keychain
  const creds = getCredentials();

  // 3. Create sanitizer that knows the credential values
  const sanitize = createSanitizer([creds.email, creds.password]);

  // 4. Create logger (writes to stderr, sanitizes all output)
  const logger = new Logger(config.logLevel, sanitize);
  logger.info("WorkMail MCP server starting...");

  // 5. Create rate limiter
  const rateLimiter = new RateLimiter(config.rateLimitPerMinute);

  // 6. Create EWS client and validate connection
  const ews = new EwsClient(config.ewsEndpoint, creds.email, creds.password, logger);
  try {
    await ews.validateConnection();
  } catch (err: any) {
    logger.error("Failed to connect to WorkMail EWS", {
      error: sanitize(err.message || String(err)),
    });
    process.exit(1);
  }

  // Helper: check rate limit and return error if exceeded
  function checkRateLimit(): string | null {
    if (!rateLimiter.tryAcquire()) {
      return "Rate limit exceeded. Please wait before making more requests.";
    }
    return null;
  }

  // Helper: wrap errors safely
  function errorResponse(err: unknown): { content: Array<{ type: "text"; text: string }> } {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: sanitize(`Error: ${msg}`) }],
    };
  }

  // 7. Create MCP server
  const server = new McpServer({
    name: "workmail",
    version: "1.0.0",
  });

  // --- Read Tools ---

  server.tool(
    "list_emails",
    "List emails from a WorkMail folder with pagination",
    ListEmailsSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = ListEmailsSchema.parse(params);
        const emails = await ews.listEmails(parsed.folder, parsed.count, parsed.offset);
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(emails, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  server.tool(
    "read_email",
    "Read the full content of an email by its ID",
    ReadEmailSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = ReadEmailSchema.parse(params);
        const email = await ews.readEmail(parsed.emailId);
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(email, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  server.tool(
    "search_emails",
    "Search emails by query string in a folder",
    SearchEmailsSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = SearchEmailsSchema.parse(params);
        const emails = await ews.searchEmails(parsed.query, parsed.folder, parsed.count);
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(emails, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  server.tool(
    "list_calendar_events",
    "List calendar events within a date range",
    ListCalendarEventsSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = ListCalendarEventsSchema.parse(params);

        // Validate date range
        const start = new Date(parsed.startDate);
        const end = new Date(parsed.endDate);
        const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > config.maxCalendarDaysRange) {
          return {
            content: [
              {
                type: "text",
                text: `Date range exceeds maximum of ${config.maxCalendarDaysRange} days`,
              },
            ],
          };
        }
        if (daysDiff < 0) {
          return {
            content: [{ type: "text", text: "End date must be after start date" }],
          };
        }

        const events = await ews.listCalendarEvents(parsed.startDate, parsed.endDate);
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(events, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  server.tool(
    "get_calendar_event",
    "Get full details of a calendar event by its ID",
    GetCalendarEventSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = GetCalendarEventSchema.parse(params);
        const event = await ews.getCalendarEvent(parsed.eventId);
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(event, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  // --- Write Tools ---

  server.tool(
    "send_email",
    "Send an email from your WorkMail account. Requires confirm: true.",
    SendEmailSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = SendEmailSchema.parse(params);
        const result = await ews.sendEmail(
          parsed.to,
          parsed.subject,
          parsed.body,
          parsed.cc
        );
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(result, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  server.tool(
    "create_calendar_event",
    "Create a new calendar event. Requires confirm: true.",
    CreateCalendarEventSchema.shape,
    async (params) => {
      const rateErr = checkRateLimit();
      if (rateErr) return { content: [{ type: "text", text: rateErr }] };

      try {
        const parsed = CreateCalendarEventSchema.parse(params);
        const result = await ews.createCalendarEvent({
          subject: parsed.subject,
          startDateTime: parsed.startDateTime,
          endDateTime: parsed.endDateTime,
          location: parsed.location,
          body: parsed.body,
          attendees: parsed.attendees,
          isAllDay: parsed.isAllDay,
        });
        return {
          content: [{ type: "text", text: sanitize(JSON.stringify(result, null, 2)) }],
        };
      } catch (err) {
        return errorResponse(err);
      }
    }
  );

  // 8. Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("WorkMail MCP server connected via stdio");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message || err}\n`);
  process.exit(1);
});
