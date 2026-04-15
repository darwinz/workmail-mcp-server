import { z } from "zod";

export const ListEmailsSchema = z.object({
  folder: z
    .enum(["inbox", "sent", "drafts", "deleted", "junk"])
    .default("inbox")
    .describe("Email folder to list"),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of emails to return"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of emails to skip (for pagination)"),
});

export const ReadEmailSchema = z.object({
  emailId: z.string().min(1).describe("The unique ID of the email to read"),
});

export const SearchEmailsSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(256)
    .describe("Search query string (searches subject and body)"),
  folder: z
    .enum(["inbox", "sent", "drafts", "deleted", "junk"])
    .default("inbox")
    .describe("Folder to search in"),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of results to return"),
});

export const SendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1).describe("Recipient email addresses"),
  cc: z
    .array(z.string().email())
    .optional()
    .describe("CC email addresses"),
  subject: z.string().min(1).max(998).describe("Email subject line"),
  body: z.string().min(1).describe("Email body (plain text)"),
  confirm: z
    .literal(true)
    .describe("Must be true to confirm sending the email"),
});

export const ListCalendarEventsSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
    .describe("Start date (YYYY-MM-DD)"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
    .describe("End date (YYYY-MM-DD)"),
});

export const GetCalendarEventSchema = z.object({
  eventId: z.string().min(1).describe("The unique ID of the calendar event"),
});

export const CreateCalendarEventSchema = z.object({
  subject: z.string().min(1).max(255).describe("Event subject/title"),
  startDateTime: z
    .string()
    .describe("Start date and time (ISO 8601, e.g. 2024-03-15T09:00:00)"),
  endDateTime: z
    .string()
    .describe("End date and time (ISO 8601, e.g. 2024-03-15T10:00:00)"),
  location: z.string().optional().describe("Event location"),
  body: z.string().optional().describe("Event description/notes"),
  attendees: z
    .array(z.string().email())
    .optional()
    .describe("Attendee email addresses"),
  isAllDay: z.boolean().default(false).describe("Whether this is an all-day event"),
  confirm: z
    .literal(true)
    .describe("Must be true to confirm creating the event"),
});
