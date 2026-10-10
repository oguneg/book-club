import * as Font from 'expo-font';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { loadAppearance, saveAppearance, type Appearance } from './appearance';
import { styleFonts } from './fonts';
import { fontSize, layout, minTouch, space, styles, type Art, type Fonts, type Motion, type Palette, type Style, type StyleName } from './tokens';

export type { Appearance, Mode } from './appearance';
export { nativeDriver, spring, useReducedMotion } from './motion';
export { STYLE_NAMES, type Spring, type StyleName } from './tokens';

export interface Theme {
  style: StyleName;
  scheme: 'light' | 'dark';
  colors: Palette;
  fonts: Fonts;
  fontSize: typeof fontSize;
  space: typeof space;
  radius: Style['radius'];
  motion: Motion;
  /** Playful's drawing colours; other styles don't draw. */
  art: Art | null;
  minTouch: number;
  layout: typeof layout;
}

/** A style in light or dark, with the fonts of `fontStyle` (a style's own once they've loaded). */
export function themeFor(style: StyleName, scheme: 'light' | 'dark', fontStyle: StyleName = style): Theme {
  const s = styles[style];
  return {
    style,
    scheme,
    colors: s.palettes[scheme],
    fonts: styles[fontStyle].fonts,
    fontSize,
    space,
    radius: s.radius,
    motion: s.motion,
    art: s.art?.[scheme] ?? null,
    minTouch,
    layout,
  };
}

const loaded = new Set<StyleName>();
/** Loads a style's fonts once (on the web, that's when they download). A failure leaves system fonts. */
export async function loadStyleFonts(style: StyleName): Promise<void> {
  if (loaded.has(style)) return;
  await Font.loadAsync(styleFonts[style]).catch(() => {});
  loaded.add(style);
}

const ThemeContext = createContext<Theme>(themeFor('classic', 'light'));
const AppearanceContext = createContext<{ appearance: Appearance; setAppearance: (change: Partial<Appearance>) => void }>({
  appearance: { style: 'classic', mode: 'system' },
  setAppearance: () => {},
});

/**
 * The chosen style, in light or dark (the system's, unless chosen). The first paint waits for the style's
 * fonts (the splash screen stays up); after a switch, the last fonts stay until the new ones are in.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState(loadAppearance);
  const system = useColorScheme();
  const scheme = appearance.mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance.mode;
  const [fontStyle, setFontStyle] = useState<StyleName | null>(null);

  useEffect(() => {
    let live = true;
    void loadStyleFonts(appearance.style).then(() => {
      if (live) setFontStyle(appearance.style);
    });
    return () => {
      live = false;
    };
  }, [appearance.style]);

  const theme = useMemo(() => themeFor(appearance.style, scheme, fontStyle ?? appearance.style), [appearance.style, scheme, fontStyle]);
  const control = useMemo(
    () => ({
      appearance,
      setAppearance: (change: Partial<Appearance>) =>
        setState((current) => {
          const next = { ...current, ...change };
          saveAppearance(next);
          return next;
        }),
    }),
    [appearance],
  );

  if (fontStyle === null) return null;
  return (
    <AppearanceContext.Provider value={control}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** This device's style and light/dark choice, and a way to change them. */
export function useAppearance() {
  return useContext(AppearanceContext);
}
