// Design tokens: warm paper and ink, bookcloth red accent, Literata for reading text.
// The full design pass comes later (docs/PLAN.md); screens use these tokens, never raw values.

export interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F6F0E4',
    surface: '#FBF7EE',
    text: '#2A2119',
    textMuted: '#6B5D4F',
    border: '#E2D7C3',
    accent: '#8A3B2E',
    onAccent: '#FFFFFF',
    success: '#3F6B4A',
    danger: '#A2322A',
  },
  dark: {
    background: '#1B1814',
    surface: '#24201A',
    text: '#EEE5D5',
    textMuted: '#B3A693',
    border: '#3A332A',
    accent: '#D9876F',
    onAccent: '#1B1814',
    success: '#8DBF96',
    danger: '#E8857C',
  },
};

/** Font family names as registered by useFonts in the root layout. UI text uses the system font. */
export const fonts = {
  heading: 'Literata_600SemiBold',
  headingBold: 'Literata_700Bold',
  reading: 'Literata_400Regular',
  readingItalic: 'Literata_400Regular_Italic',
} as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 40 } as const;

export const radius = { sm: 6, md: 10, lg: 16 } as const;

/** Minimum touch target (iOS 44pt, Android 48dp). */
export const minTouch = 48;
