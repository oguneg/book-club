import type { Logger } from 'pino';
import type { Mailer } from './email/mailer';
import { noteHiddenMessage } from './email/messages';
import type { Env } from './env';

/** Emails every moderator when a note is hidden by reports. Fire-and-forget: a failed email is logged, not thrown. */
export function moderatorAlerts({ env, mailer, log }: { env: Pick<Env, 'ADMIN_EMAILS' | 'APP_URL'>; mailer: Mailer; log: Logger }) {
  return (noteId: string) => {
    if (env.ADMIN_EMAILS.length === 0) log.warn({ noteId }, 'note hidden by reports, but no ADMIN_EMAILS to tell');
    for (const to of env.ADMIN_EMAILS) {
      mailer.send(noteHiddenMessage({ to, url: `${env.APP_URL}/admin/reports` })).catch((err: unknown) => log.error({ err, noteId }, 'moderator email failed'));
    }
  };
}
