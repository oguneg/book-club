import '@/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setUpNativeQueryManagers } from '@/api/nativeManagers';
import { authClient } from '@/auth/client';
import { CrashScreen } from '@/components/CrashScreen';
import { WebChrome } from '@/components/WebChrome';
import { installCrashReporting } from '@/monitoring/crashes';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
installCrashReporting();
setUpNativeQueryManagers();

/** A crash anywhere below: report it and offer a way out (expo-router renders this instead of the layout). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={() => void retry()} />;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  // The theme holds the first paint until the chosen style's fonts are in (see ThemeProvider).
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <Navigator />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const theme = useTheme();
  const session = authClient.useSession();
  const signedIn = Boolean(session.data);
  // Someone else signing in (or nobody) never sees the last account's books, clubs or settings, even briefly.
  const queryClient = useQueryClient();
  const userId = session.data?.user.id ?? null;
  const lastUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastUser.current !== undefined && lastUser.current !== userId) queryClient.clear();
    lastUser.current = userId;
  }, [userId, queryClient]);
  // Better Auth reports `isPending` again on every background refresh while signed out (e.g. when the
  // tab regains focus). Only the first check may hold the app back, or a half-filled form would vanish.
  const [ready, setReady] = useState(false);
  if (!ready && !session.isPending) setReady(true);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Wait for the first session check so signed-in users never see the sign-in page flash by.
  if (!ready) return null;

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <WebChrome />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Reached from emailed or shared links, signed in or not. */}
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="email-confirmed" />
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="help" />
      </Stack>
    </>
  );
}
