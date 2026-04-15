import {
  ExchangeService,
  ExchangeVersion,
  WebCredentials,
  Uri,
  WellKnownFolderName,
  ItemView,
  CalendarView,
  EmailMessage,
  Appointment,
  PropertySet,
  BasePropertySet,
  ItemSchema,
  EmailMessageSchema,
  AppointmentSchema,
  ItemId,
  DateTime,
  MessageBody,
  SendInvitationsMode,
  Folder,
} from "ews-javascript-api";

import { Logger } from "./logger";

export interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  dateReceived: string;
  isRead: boolean;
}

export interface EmailDetail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  dateReceived: string;
  dateSent: string;
  body: string;
  hasAttachments: boolean;
}

export interface CalendarEventSummary {
  id: string;
  subject: string;
  start: string;
  end: string;
  location: string;
  isAllDay: boolean;
  organizer: string;
}

export interface CalendarEventDetail extends CalendarEventSummary {
  body: string;
  requiredAttendees: string[];
  optionalAttendees: string[];
  isRecurring: boolean;
  isCancelled: boolean;
}

const FOLDER_MAP: Record<string, WellKnownFolderName> = {
  inbox: WellKnownFolderName.Inbox,
  sent: WellKnownFolderName.SentItems,
  drafts: WellKnownFolderName.Drafts,
  deleted: WellKnownFolderName.DeletedItems,
  junk: WellKnownFolderName.JunkEmail,
};

export class EwsClient {
  private service: ExchangeService;
  private logger: Logger;

  constructor(ewsEndpoint: string, email: string, password: string, logger: Logger) {
    this.logger = logger;
    this.service = new ExchangeService(ExchangeVersion.Exchange2010_SP2);
    this.service.Credentials = new WebCredentials(email, password);
    this.service.Url = new Uri(ewsEndpoint);
  }

  async validateConnection(): Promise<void> {
    this.logger.info("Validating EWS connection...");
    await Folder.Bind(this.service, WellKnownFolderName.Inbox);
    this.logger.info("EWS connection validated successfully");
  }

  async listEmails(
    folder: string,
    count: number,
    offset: number
  ): Promise<EmailSummary[]> {
    const folderName = FOLDER_MAP[folder] ?? WellKnownFolderName.Inbox;
    const view = new ItemView(count, offset);
    view.PropertySet = new PropertySet(
      BasePropertySet.IdOnly,
      ItemSchema.Subject,
      ItemSchema.DateTimeReceived,
      EmailMessageSchema.From,
      EmailMessageSchema.IsRead
    );

    const results = await this.service.FindItems(folderName, view);
    return results.Items.map((item) => ({
      id: item.Id.UniqueId,
      subject: item.Subject || "(no subject)",
      from: (item as any).From?.Address || "",
      dateReceived: this.formatDateTime(item.DateTimeReceived),
      isRead: (item as any).IsRead ?? true,
    }));
  }

  async readEmail(emailId: string): Promise<EmailDetail> {
    const propSet = new PropertySet(BasePropertySet.FirstClassProperties);
    const msg = await EmailMessage.Bind(
      this.service,
      new ItemId(emailId),
      propSet
    );

    return {
      id: msg.Id.UniqueId,
      subject: msg.Subject || "(no subject)",
      from: msg.From?.Address || "",
      to: this.emailAddressCollectionToArray(msg.ToRecipients),
      cc: this.emailAddressCollectionToArray(msg.CcRecipients),
      dateReceived: this.formatDateTime(msg.DateTimeReceived),
      dateSent: this.formatDateTime(msg.DateTimeSent),
      body: msg.Body?.Text || "",
      hasAttachments: msg.HasAttachments,
    };
  }

  async searchEmails(
    query: string,
    folder: string,
    count: number
  ): Promise<EmailSummary[]> {
    const folderName = FOLDER_MAP[folder] ?? WellKnownFolderName.Inbox;
    const view = new ItemView(count);
    view.PropertySet = new PropertySet(
      BasePropertySet.IdOnly,
      ItemSchema.Subject,
      ItemSchema.DateTimeReceived,
      EmailMessageSchema.From,
      EmailMessageSchema.IsRead
    );

    // Use AQS (Advanced Query Syntax) supported by WorkMail
    const results = await this.service.FindItems(folderName, query, view);
    return results.Items.map((item) => ({
      id: item.Id.UniqueId,
      subject: item.Subject || "(no subject)",
      from: (item as any).From?.Address || "",
      dateReceived: this.formatDateTime(item.DateTimeReceived),
      isRead: (item as any).IsRead ?? true,
    }));
  }

  async sendEmail(
    to: string[],
    subject: string,
    body: string,
    cc?: string[]
  ): Promise<{ success: boolean; message: string }> {
    const msg = new EmailMessage(this.service);
    msg.Subject = subject;
    msg.Body = new MessageBody(body);

    for (const addr of to) {
      msg.ToRecipients.Add(addr);
    }
    if (cc) {
      for (const addr of cc) {
        msg.CcRecipients.Add(addr);
      }
    }

    await msg.SendAndSaveCopy();
    this.logger.info("Email sent successfully", { to, subject });
    return { success: true, message: `Email sent to ${to.join(", ")}` };
  }

  async listCalendarEvents(
    startDate: string,
    endDate: string
  ): Promise<CalendarEventSummary[]> {
    const start = new DateTime(startDate);
    const end = new DateTime(endDate);
    const calView = new CalendarView(start, end);

    const results = await this.service.FindAppointments(
      WellKnownFolderName.Calendar,
      calView
    );

    return results.Items.map((appt: Appointment) => ({
      id: appt.Id.UniqueId,
      subject: appt.Subject || "(no subject)",
      start: this.formatDateTime(appt.Start),
      end: this.formatDateTime(appt.End),
      location: appt.Location || "",
      isAllDay: appt.IsAllDayEvent,
      organizer: appt.Organizer?.Address || "",
    }));
  }

  async getCalendarEvent(eventId: string): Promise<CalendarEventDetail> {
    const propSet = new PropertySet(BasePropertySet.FirstClassProperties);
    const appt = await Appointment.Bind(
      this.service,
      new ItemId(eventId),
      propSet
    );

    return {
      id: appt.Id.UniqueId,
      subject: appt.Subject || "(no subject)",
      start: this.formatDateTime(appt.Start),
      end: this.formatDateTime(appt.End),
      location: appt.Location || "",
      isAllDay: appt.IsAllDayEvent,
      organizer: appt.Organizer?.Address || "",
      body: appt.Body?.Text || "",
      requiredAttendees: this.attendeesToArray(appt.RequiredAttendees),
      optionalAttendees: this.attendeesToArray(appt.OptionalAttendees),
      isRecurring: appt.IsRecurring,
      isCancelled: appt.IsCancelled,
    };
  }

  async createCalendarEvent(params: {
    subject: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
    body?: string;
    attendees?: string[];
    isAllDay: boolean;
  }): Promise<{ success: boolean; message: string; eventId?: string }> {
    const appt = new Appointment(this.service);
    appt.Subject = params.subject;
    appt.Start = new DateTime(params.startDateTime);
    appt.End = new DateTime(params.endDateTime);
    appt.IsAllDayEvent = params.isAllDay;

    if (params.location) {
      appt.Location = params.location;
    }
    if (params.body) {
      appt.Body = new MessageBody(params.body);
    }
    if (params.attendees && params.attendees.length > 0) {
      for (const addr of params.attendees) {
        appt.RequiredAttendees.Add(addr);
      }
    }

    // Send invitations if there are attendees, otherwise just save
    const sendMode =
      params.attendees && params.attendees.length > 0
        ? SendInvitationsMode.SendToAllAndSaveCopy
        : SendInvitationsMode.SendToNone;

    await appt.Save(sendMode);
    this.logger.info("Calendar event created", { subject: params.subject });

    return {
      success: true,
      message: `Event "${params.subject}" created`,
      eventId: appt.Id?.UniqueId,
    };
  }

  private formatDateTime(dt: DateTime | undefined): string {
    if (!dt) return "";
    try {
      return dt.MomentDate.toISOString();
    } catch {
      return "";
    }
  }

  private emailAddressCollectionToArray(collection: any): string[] {
    const result: string[] = [];
    if (!collection) return result;
    try {
      const count = collection.Count ?? collection.length ?? 0;
      for (let i = 0; i < count; i++) {
        const item = collection._getItem(i) ?? collection[i];
        if (item?.Address) {
          result.push(item.Address);
        }
      }
    } catch {
      // collection iteration not supported — return empty
    }
    return result;
  }

  private attendeesToArray(collection: any): string[] {
    const result: string[] = [];
    if (!collection) return result;
    try {
      const count = collection.Count ?? collection.length ?? 0;
      for (let i = 0; i < count; i++) {
        const item = collection._getItem(i) ?? collection[i];
        if (item?.Address) {
          result.push(item.Address);
        }
      }
    } catch {
      // collection iteration not supported
    }
    return result;
  }
}
