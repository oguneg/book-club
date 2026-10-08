import type { EmailMessage } from './mailer';

// Transactional emails. English only for now, like the app; plain text first, with a simple HTML version.

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function layout({ heading, body, action, url, footer }: { heading: string; body: string; action: string; url: string; footer: string }): string {
  const link = escapeHtml(url);
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F6F0E4;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#2A2119;">
    <p style="font-size:22px;font-weight:bold;margin:0 0 24px;">Bookclub</p>
    <h1 style="font-size:20px;font-weight:normal;margin:0 0 16px;">${escapeHtml(heading)}</h1>
    <p style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;margin:0 0 24px;">${escapeHtml(body)}</p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;background:#8A3B2E;color:#FFFFFF;text-decoration:none;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(action)}</a>
    </p>
    <p style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6B5D4F;margin:0 0 8px;">If the button doesn't work, open this link:<br><a href="${link}" style="color:#8A3B2E;word-break:break-all;">${link}</a></p>
    <p style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6B5D4F;margin:0;">${escapeHtml(footer)}</p>
  </div>
</body>
</html>`;
}

export function verifyEmailMessage({ to, name, url }: { to: string; name: string; url: string }): EmailMessage {
  const heading = `Welcome, ${name}`;
  const body = 'Confirm your email address to finish creating your Bookclub account.';
  const footer = "The link works for 24 hours. If you didn't sign up for Bookclub, you can ignore this email.";
  return {
    to,
    subject: 'Confirm your email for Bookclub',
    text: `${heading}\n\n${body}\n\n${url}\n\n${footer}\n`,
    html: layout({ heading, body, action: 'Confirm email', url, footer }),
  };
}

export function resetPasswordMessage({ to, name, url }: { to: string; name: string; url: string }): EmailMessage {
  const heading = `Hi ${name}`;
  const body = 'Someone asked to reset the password for your Bookclub account. Choose a new password with the link below.';
  const footer = "The link works for 1 hour. If it wasn't you, ignore this email: your password stays the same.";
  return {
    to,
    subject: 'Reset your Bookclub password',
    text: `${heading}\n\n${body}\n\n${url}\n\n${footer}\n`,
    html: layout({ heading, body, action: 'Choose a new password', url, footer }),
  };
}

export function existingAccountMessage({ to, name, url }: { to: string; name: string; url: string }): EmailMessage {
  const heading = `Hi ${name}`;
  const body =
    'Someone just tried to create a Bookclub account with this email address, but you already have one. Sign in, or reset your password if you forgot it.';
  const footer = "If it wasn't you, you can ignore this email: nothing has changed.";
  return {
    to,
    subject: 'You already have a Bookclub account',
    text: `${heading}\n\n${body}\n\n${url}\n\n${footer}\n`,
    html: layout({ heading, body, action: 'Sign in', url, footer }),
  };
}
