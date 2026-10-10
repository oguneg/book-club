// Design tokens. The app comes in three styles, each in light and dark:
//   classic  a reading journal: warm paper and ink, bookcloth red, Literata for headings and notes;
//   sleek    clean and crisp: cool near-white (or near-black), ink blue, Manrope, tighter corners;
//   playful  soft and friendly: blush cream (or plum night), raspberry, Fredoka and Nunito, round corners,
//            bouncy springs and a bunny (the pace rabbit, drawn) on empty pages and endings.
// Screens use these tokens, never raw values. Every palette passes WCAG contrast: text 7:1, muted text,
// accent text and status colours 4.5:1, control edges 3:1, on both the page and raised surfaces.

export type StyleName = 'classic' | 'sleek' | 'playful';
export const STYLE_NAMES: readonly StyleName[] = ['classic', 'sleek', 'playful'];

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
  /** A book cover lifted off the page. */
  coverShadow: string;
  /** Behind a sheet or dialog. */
  backdrop: string;
  /** Selected text on the web. */
  selection: string;
  /** A steady colour per person (their initials, when they have no photo); white text passes 5.8:1 on each. */
  people: readonly string[];
  /**
   * Days read, by how much: no reading, then four steps towards the accent (even steps in OKLab; darker for
   * more on a light page, lighter for more on a dark one).
   */
  calendar: readonly string[];
}

/** Font family names, as loaded for each style (see fonts.ts). UI text uses the system font. */
export interface Fonts {
  heading: string;
  headingBold: string;
  reading: string;
  readingItalic: string;
}

/** A spring, as Animated.spring takes it. Damping at 2·√(stiffness·mass) settles without overshoot; less bounces. */
export interface Spring {
  stiffness: number;
  damping: number;
  mass: number;
}

/**
 * How a style moves: Classic settles calmly, Sleek is quick and exact, Playful overshoots and bounces. With
 * reduced motion on, movement gives way to fades (or nothing).
 */
export interface Motion {
  /** Things arriving: a sheet, a dialog, a page, a tab, the toast. */
  arrive: Spring;
  /** Small answers: a button let go, a tab icon, the segmented pill, a day's dot filling in. */
  pop: Spring;
  /** Progress bars gliding to their new place. */
  glide: Spring;
  /** How far a pressed control sinks (its scale). */
  press: number;
  /** How far a page or tab slides as it arrives, px. */
  shift: number;
  /** Leaving takes this long (ms): quicker than arriving, and never bouncy. */
  leave: number;
}

/** Playful's drawings: the bunny (line, fur, blush, nose), the blob behind it, a book's pages and the sparkles. */
export interface Art {
  line: string;
  fur: string;
  blush: string;
  nose: string;
  blob: string;
  page: string;
  sun: string;
  mint: string;
  lilac: string;
}

export interface Style {
  palettes: Record<'light' | 'dark', Palette>;
  fonts: Fonts;
  radius: { sm: number; md: number; lg: number };
  motion: Motion;
  /** Only Playful draws. */
  art?: Record<'light' | 'dark', Art>;
}

const PEOPLE = ['#6B4E9B', '#2F6F6A', '#8A5A1F', '#3E5C8A', '#7A3E5D', '#4F6B2E', '#9A4A2C', '#55567A'] as const;

const darkShadows = {
  deskShadow: '0px 1px 2px rgba(0, 0, 0, 0.5), 0px 12px 30px -14px rgba(0, 0, 0, 0.7)',
  coverShadow: '0px 2px 4px rgba(0, 0, 0, 0.4), 0px 14px 28px -12px rgba(0, 0, 0, 0.7)',
  backdrop: 'rgba(0, 0, 0, 0.55)',
};

export const styles: Record<StyleName, Style> = {
  classic: {
    palettes: {
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
        coverShadow: '0px 2px 4px rgba(42, 33, 25, 0.14), 0px 14px 28px -12px rgba(42, 33, 25, 0.5)',
        backdrop: 'rgba(20, 15, 10, 0.4)',
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
        ...darkShadows,
        selection: 'rgba(217, 135, 111, 0.32)',
        people: PEOPLE,
        calendar: ['#3A332A', '#674237', '#905848', '#B46E5A', '#D9876F'],
      },
    },
    fonts: { heading: 'Literata_600SemiBold', headingBold: 'Literata_700Bold', reading: 'Literata_400Regular', readingItalic: 'Literata_400Regular_Italic' },
    radius: { sm: 6, md: 10, lg: 16 },
    motion: {
      arrive: { stiffness: 230, damping: 30, mass: 1 },
      pop: { stiffness: 420, damping: 40, mass: 1 },
      glide: { stiffness: 90, damping: 19, mass: 1 },
      press: 0.98,
      shift: 16,
      leave: 200,
    },
  },
  sleek: {
    palettes: {
      light: {
        background: '#F4F5F7',
        surface: '#FFFFFF',
        text: '#14161B',
        textMuted: '#555B69',
        border: '#E1E4E9',
        control: '#838A98',
        accent: '#2E4BD1',
        onAccent: '#FFFFFF',
        success: '#1D7348',
        danger: '#C02D2D',
        deskShadow: '0px 1px 2px rgba(20, 22, 27, 0.05), 0px 10px 28px -16px rgba(20, 22, 27, 0.22)',
        coverShadow: '0px 1px 3px rgba(20, 22, 27, 0.12), 0px 12px 24px -12px rgba(20, 22, 27, 0.35)',
        backdrop: 'rgba(14, 16, 20, 0.4)',
        selection: 'rgba(46, 75, 209, 0.2)',
        people: PEOPLE,
        calendar: ['#E1E4E9', '#A6B9E6', '#7894E1', '#5071DA', '#2E4BD1'],
      },
      dark: {
        background: '#0E1014',
        surface: '#171A20',
        text: '#ECEEF2',
        textMuted: '#A0A6B3',
        border: '#262A32',
        control: '#666E7D',
        accent: '#93A6FF',
        onAccent: '#0E1014',
        success: '#6CCB94',
        danger: '#F28B82',
        ...darkShadows,
        selection: 'rgba(147, 166, 255, 0.3)',
        people: PEOPLE,
        calendar: ['#262A32', '#444C6A', '#5F6B9C', '#7989CE', '#93A6FF'],
      },
    },
    fonts: { heading: 'Manrope_600SemiBold', headingBold: 'Manrope_700Bold', reading: 'Manrope_400Regular', readingItalic: 'Manrope_400Regular' },
    radius: { sm: 4, md: 8, lg: 12 },
    motion: {
      arrive: { stiffness: 440, damping: 42, mass: 1 },
      pop: { stiffness: 700, damping: 52, mass: 1 },
      glide: { stiffness: 170, damping: 26, mass: 1 },
      press: 0.97,
      shift: 12,
      leave: 150,
    },
  },
  playful: {
    palettes: {
      light: {
        background: '#FFF4EE',
        surface: '#FFFFFF',
        text: '#2E2140',
        textMuted: '#685B7C',
        border: '#F3DCE4',
        control: '#937C9D',
        accent: '#C2356B',
        onAccent: '#FFFFFF',
        success: '#23795F',
        danger: '#C9302C',
        deskShadow: '0px 2px 3px rgba(46, 33, 64, 0.06), 0px 14px 30px -14px rgba(46, 33, 64, 0.25)',
        coverShadow: '0px 2px 4px rgba(46, 33, 64, 0.14), 0px 14px 28px -12px rgba(46, 33, 64, 0.42)',
        backdrop: 'rgba(46, 33, 64, 0.38)',
        selection: 'rgba(194, 53, 107, 0.2)',
        people: PEOPLE,
        calendar: ['#F3DCE4', '#E9ADBE', '#DD859F', '#D05F84', '#C2356B'],
      },
      dark: {
        background: '#1B1428',
        surface: '#261D37',
        text: '#F8F0FF',
        textMuted: '#C4B6D8',
        border: '#3A2E51',
        control: '#7F6D9B',
        accent: '#FF8CB7',
        onAccent: '#1B1428',
        success: '#7DD5B2',
        danger: '#FF8E8E',
        ...darkShadows,
        selection: 'rgba(255, 140, 183, 0.3)',
        people: PEOPLE,
        calendar: ['#3A2E51', '#70496F', '#A16188', '#D077A0', '#FF8CB7'],
      },
    },
    fonts: { heading: 'Fredoka_600SemiBold', headingBold: 'Fredoka_700Bold', reading: 'Nunito_400Regular', readingItalic: 'Nunito_400Regular_Italic' },
    radius: { sm: 10, md: 16, lg: 24 },
    motion: {
      arrive: { stiffness: 260, damping: 22, mass: 1 },
      pop: { stiffness: 520, damping: 14, mass: 1 },
      glide: { stiffness: 120, damping: 12, mass: 1 },
      press: 0.92,
      shift: 28,
      leave: 170,
    },
    // The bunny stays a white sticker with a plum line in both modes; only the blob behind it changes.
    art: {
      light: { line: '#2E2140', fur: '#FFFFFF', blush: '#FFB3C9', nose: '#E8648F', blob: '#FFE2EB', page: '#FFFFFF', sun: '#FFC94D', mint: '#6CCFB5', lilac: '#A98BFF' },
      dark: { line: '#2E2140', fur: '#FFF6F9', blush: '#FFB3C9', nose: '#E8648F', blob: '#2E2343', page: '#FFFFFF', sun: '#FFC94D', mint: '#6CCFB5', lilac: '#B9A0FF' },
    },
  },
};

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 40 } as const;

/** Minimum touch target (iOS 44pt, Android 48dp). */
export const minTouch = 48;

/** Column widths: one reading column; on screens 1024px and wider, a main column with a side rail. */
export const layout = { column: 600, narrow: 420, wide: 1060, rail: 320, wideFrom: 1024 } as const;
