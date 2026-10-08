// A one-time message carried across the sign-in boundary. When an account is deleted the session
// disappears and the router swaps the whole signed-in area for the sign-in page, so the confirmation has
// to be picked up there.

type Flash = 'accountDeleted';
let pending: Flash | undefined;

export function setFlash(flash: Flash): void {
  pending = flash;
}

/** Returns the pending message once, then forgets it. */
export function takeFlash(): Flash | undefined {
  const flash = pending;
  pending = undefined;
  return flash;
}

export function clearFlash(): void {
  pending = undefined;
}
