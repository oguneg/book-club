// Where the app finds its API. Kept free of React Native imports so it can be unit tested.

export const PRODUCTION_API_URL = 'https://bookclub.ogun.se';
const DEV_API_PORT = 8787;

export interface ApiUrlInputs {
  /** EXPO_PUBLIC_API_URL, set per EAS build profile. Always wins. */
  envUrl: string | undefined;
  isDev: boolean;
  platform: string;
  /** The dev server's address as the device sees it ("192.168.1.5:8081"), from Expo constants. */
  hostUri: string | undefined;
  /** window.location.hostname on web. */
  webHostname: string | undefined;
}

/** Base URL without trailing slash; '' means same origin (the web app served by the API server). */
export function resolveApiUrl({ envUrl, isDev, platform, hostUri, webHostname }: ApiUrlInputs): string {
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (isDev) {
    // The local API runs on the same machine as the Expo dev server, so phones on the LAN,
    // simulators and the browser all reach it at the dev server's host.
    const host = hostUri?.split(':')[0] || (platform === 'web' ? webHostname : undefined);
    if (host) return `http://${host}:${DEV_API_PORT}`;
  }
  return platform === 'web' ? '' : PRODUCTION_API_URL;
}
