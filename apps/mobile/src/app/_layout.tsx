import '@/i18n';
// Per-weight imports: the package root would bundle all 16 Literata files (4 MB) into the app.
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { Literata_700Bold } from '@expo-google-fonts/literata/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
  const [fontsLoaded, fontError] = useFonts({
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_600SemiBold,
    Literata_700Bold,
  });
  const [queryClient] = useState(() => new QueryClient());

  // On a font error the app still renders, with system fonts.
  if (!fontsLoaded && !fontError) return null;

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
