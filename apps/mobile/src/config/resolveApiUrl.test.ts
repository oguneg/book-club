import { describe, expect, it } from 'vitest';
import { PRODUCTION_API_URL, resolveApiUrl } from './resolveApiUrl';

const base = { envUrl: undefined, isDev: false, platform: 'ios', hostUri: undefined, webHostname: undefined };

describe('resolveApiUrl', () => {
  it('uses the build profile URL when set', () => {
    expect(resolveApiUrl({ ...base, envUrl: 'https://bookclub-staging.ogun.se/', isDev: true })).toBe(
      'https://bookclub-staging.ogun.se',
    );
  });

  it('reaches the local API next to the dev server', () => {
    expect(resolveApiUrl({ ...base, isDev: true, hostUri: '192.168.1.5:8081' })).toBe('http://192.168.1.5:8787');
    expect(resolveApiUrl({ ...base, isDev: true, platform: 'web', webHostname: 'localhost' })).toBe(
      'http://localhost:8787',
    );
  });

  it('defaults release builds to production, and the web app to its own origin', () => {
    expect(resolveApiUrl(base)).toBe(PRODUCTION_API_URL);
    expect(resolveApiUrl({ ...base, platform: 'android' })).toBe(PRODUCTION_API_URL);
    expect(resolveApiUrl({ ...base, platform: 'web', webHostname: 'bookclub.ogun.se' })).toBe('');
  });
});
