import type { Logger } from 'pino';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

/** Development and tests: no email leaves the machine; the message (with its link) goes to the log. */
export function logMailer(log: Logger): Mailer {
  return {
    async send({ to, subject, text }) {
      log.info({ to, subject }, `email (not sent, EMAIL_TRANSPORT=log)\n${text}`);
    },
  };
}

/** Sends through Resend's HTTP API. Uses a sending-only key restricted to the sending domain. */
export function resendMailer({ apiKey, from, log }: { apiKey: string; from: string; log: Logger }): Mailer {
  return {
    async send({ to, subject, text, html }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend answered ${res.status}: ${detail.slice(0, 300)}`);
      }
      const { id } = (await res.json()) as { id?: string };
      log.info({ subject, resendId: id }, 'email sent');
    },
  };
}

/**
 * Sends without making the caller wait or fail. Auth flows must answer the same way whether or not an
 * email goes out (otherwise response times reveal which addresses have accounts), and a failed send
 * is logged rather than shown to the user.
 */
export function sendInBackground(mailer: Mailer, log: Logger, message: EmailMessage): void {
  mailer.send(message).catch((err: unknown) => {
    log.error({ err, subject: message.subject }, 'email failed');
  });
}
