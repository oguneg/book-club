import { z } from 'zod';

// Settings that follow you to every device you sign in on. For now: how the app looks.

export const appearancePreference = z.object({
  style: z.enum(['classic', 'sleek', 'playful']),
  mode: z.enum(['system', 'light', 'dark']),
});
export type AppearancePreference = z.infer<typeof appearancePreference>;

/** `appearance` is null until one is chosen (the device's own choice then becomes the account's). */
export const preferencesResponse = z.object({ appearance: appearancePreference.nullable() });
export const updatePreferencesInput = z.object({ appearance: appearancePreference });
