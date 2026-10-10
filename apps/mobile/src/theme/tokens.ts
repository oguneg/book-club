// Design tokens: a reading journal. Warm paper and ink, bookcloth red for the ribbon (where you are), "you" and
// the one primary action per screen, Literata for headings, notes and marginal figures. Screens use these
// tokens, never raw values.

export interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  /** Hairlines that only decorate: cards, dividers, chart grid. */
  border: string;
  /** Edges of things you interact with (fields, buttons, chips): 3:1 against the page, WCAG 1.4.11. */
  control: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
  /** The one raised surface per screen (the "desk"): an offset, softly blurred shadow. */
  deskShadow: string;
  /** Selected text on the web. */
  selection: string;
  /** A steady colour per person (their initials, when they have no photo); white text passes 5.8:1 on each. */
  people: readonly string[];
  /**
   * Days read, by how much: no reading, then four steps of bookcloth (OKLCH, one hue, lightness moving
   * one way; darker for more on paper, lighter for more under lamplight).
   */
  calendar: readonly string[];
}

const PEOPLE = ['#6B4E9B', '#2F6F6A', '#8A5A1F', '#3E5C8A', '#7A3E5D', '#4F6B2E', '#9A4A2C', '#55567A'] as const;

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F6F0E4',
    surface: '#FBF7EE',
    text: '#2A2119',
    textMuted: '#6B5D4F',
    border: '#E2D7C3',
    control: '#958676',
    accent: '#8A3B2E',
    onAccent: '#FFFFFF',
    success: '#3F6B4A',
    danger: '#A2322A',
    deskShadow: '0px 1px 2px rgba(42, 33, 25, 0.06), 0px 10px 28px -14px rgba(42, 33, 25, 0.28)',
    selection: 'rgba(138, 59, 46, 0.22)',
    people: PEOPLE,
    calendar: ['#E2D7C3', '#D9B4AC', '#C58A7F', '#A96053', '#8A3B2E'],
  },
  dark: {
    background: '#1B1814',
    surface: '#24201A',
    text: '#EEE5D5',
    textMuted: '#B3A693',
    border: '#3A332A',
    control: '#766A5C',
    accent: '#D9876F',
    onAccent: '#1B1814',
    success: '#8DBF96',
    danger: '#E8857C',
    deskShadow: '0px 1px 2px rgba(0, 0, 0, 0.5), 0px 12px 30px -14px rgba(0, 0, 0, 0.7)',
    selection: 'rgba(217, 135, 111, 0.32)',
    people: PEOPLE,
    calendar: ['#3A332A', '#674237', '#905848', '#B46E5A', '#D9876F'],
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

/** Column widths: one reading column; on screens 1024px and wider, a main column with a side rail. */
export const layout = { column: 600, narrow: 420, wide: 1060, rail: 320, wideFrom: 1024 } as const;
