import { MIN_PASSWORD_LENGTH } from '@bookclub/shared';
import type { TFunction } from 'i18next';

export interface AuthError {
  status?: number;
  code?: string;
  message?: string;
}

/** Turns a Better Auth error into a sentence for the user. */
export function authErrorMessage(t: TFunction, error: AuthError | null | undefined): string {
  if (!error) return t('auth.errors.generic');
  if (error.status === 429) return t('auth.errors.tooManyAttempts');
  if (!error.status) return t('auth.errors.network');
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return t('auth.errors.invalidCredentials');
    case 'PASSWORD_TOO_SHORT':
      return t('auth.errors.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
    case 'PASSWORD_TOO_LONG':
      return t('auth.errors.passwordTooLong');
    case 'PASSWORD_COMPROMISED':
      return t('auth.errors.passwordCompromised');
    case 'INVALID_EMAIL':
      return t('auth.errors.invalidEmail');
    case 'INVALID_PASSWORD':
      return t('auth.errors.invalidPassword');
    default:
      return t('auth.errors.generic');
  }
}

/** Errors Google sign-in reports by redirecting back with `?error=`. */
export function googleErrorMessage(t: TFunction, code: string): string {
  switch (code) {
    case 'access_denied':
      return t('auth.errors.googleCancelled');
    case 'account_not_linked':
    case 'unable_to_link_account':
      return t('auth.errors.googleNotLinked');
    case 'email_does_not_match':
      return t('auth.errors.googleEmailMismatch');
    case 'account_already_linked_to_different_user':
      return t('auth.errors.googleTaken');
    default:
      return t('auth.errors.googleFailed');
  }
}
