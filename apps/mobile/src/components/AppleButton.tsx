import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/theme';

/**
 * Sign in with Apple, on iPhones only: Apple's own button (its wording, logo and sizes are what App Review
 * expects). Renders nothing where Apple sign-in isn't available. Hands back Apple's ID token and, on the first
 * sign-in only, the name the person chose to share.
 */
export function AppleButton({
  onSignIn,
  onError,
  type = 'signIn',
}: {
  onSignIn: (token: string, name: { firstName?: string; lastName?: string } | null) => void;
  onError: (error: unknown) => void;
  type?: 'signIn' | 'signUp';
}) {
  const { scheme, radius, minTouch } = useTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);
  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={type === 'signUp' ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.md}
      style={{ width: '100%', height: minTouch }}
      onPress={async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          });
          if (!credential.identityToken) throw new Error('Apple returned no identity token');
          const given = credential.fullName?.givenName ?? undefined;
          const family = credential.fullName?.familyName ?? undefined;
          onSignIn(credential.identityToken, given || family ? { firstName: given, lastName: family } : null);
        } catch (err) {
          // Closing Apple's sheet is a choice, not an error.
          if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
          onError(err);
        }
      }}
    />
  );
}
