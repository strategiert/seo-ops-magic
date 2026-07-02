import { Resend } from "resend";
import { inngest } from "../../client.js";
import { api, convex } from "../../lib/convex.js";

type OutreachSendMessageEvent = {
  messageId: string;
};

type OutreachMessageForWorker = {
  _id: string;
  status: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  toEmail: string;
  subject: string;
  bodyText: string;
};

function getWorkerSecret(): string {
  const workerSecret = process.env.OUTREACH_WORKER_SECRET || process.env.INNGEST_EVENT_KEY;
  if (!workerSecret) {
    throw new Error("OUTREACH_WORKER_SECRET is not configured");
  }
  return workerSecret;
}

function fromAddress(fromName: string, fromEmail: string): string {
  return fromName.trim() ? `${fromName.trim()} <${fromEmail}>` : fromEmail;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown Resend error";
}

export const outreachSendMessage = inngest.createFunction(
  {
    id: "outreach-send-message",
    name: "Outreach Send Message",
    concurrency: {
      limit: 2,
      key: "event.data.workspaceId",
    },
    retries: 2,
  },
  { event: "outreach/send-message" },
  async ({ event, step }) => {
    const { messageId } = event.data as OutreachSendMessageEvent;
    const workerSecret = getWorkerSecret();

    const message = (await step.run("fetch-message", async () => {
      return await convex.query(api.tables.outreachMail.getMessageForWorker, {
        messageId: messageId as any,
        workerSecret,
      });
    })) as OutreachMessageForWorker | null;

    if (!message) {
      throw new Error(`Outreach message not found: ${messageId}`);
    }

    if (message.status === "sent") {
      return { skipped: true, reason: "already_sent" };
    }

    if (message.status !== "queued" && message.status !== "sending") {
      return { skipped: true, reason: `status_${message.status}` };
    }

    await step.run("mark-sending", async () => {
      await convex.mutation(api.tables.outreachMail.markMessageSending, {
        messageId: messageId as any,
        workerSecret,
      });
    });

    try {
      const providerMessageId = await step.run("send-with-resend", async () => {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: fromAddress(message.fromName, message.fromEmail),
          to: [message.toEmail],
          replyTo: message.replyTo,
          subject: message.subject,
          text: message.bodyText,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.id) {
          throw new Error("Resend did not return a message id");
        }

        return data.id;
      });

      await step.run("mark-sent", async () => {
        await convex.mutation(api.tables.outreachMail.markMessageSent, {
          messageId: messageId as any,
          providerMessageId,
          workerSecret,
        });
      });

      return { success: true, providerMessageId };
    } catch (error) {
      await step.run("mark-failed", async () => {
        await convex.mutation(api.tables.outreachMail.markMessageFailed, {
          messageId: messageId as any,
          errorMessage: errorMessage(error),
          workerSecret,
        });
      });
      throw error;
    }
  }
);
