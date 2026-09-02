import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.js";
import { emails } from "../db/schema.js";

type Db = NodePgDatabase<typeof schema>;

export type MailMessage = {
  to: string;
  toUserId?: string | null;
  template: string;
  subject: string;
  text: string;
  /** Designed HTML body (templates.ts's wrapHtml). Optional: the wire
   *  carries it when present; the STORED body stays the plain text —
   *  the pretend inbox and the redaction rules are text-body contracts. */
  html?: string;
};

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

/** Dev driver: every message becomes a row — the pretend inbox (spec §9). */
export function createDevMailer(db: Db): Mailer {
  return {
    async send(msg) {
      await db.insert(emails).values({
        toEmail: msg.to,
        toUserId: msg.toUserId ?? null,
        template: msg.template,
        subject: msg.subject,
        bodyText: msg.text,
        status: "dev",
      });
    },
  };
}
