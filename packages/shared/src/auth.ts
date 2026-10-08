// Account rules shared by the server (enforced) and the app (checked early for quick feedback).

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 60;

/** A light check for typos; the server and the confirmation email are the real test. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
