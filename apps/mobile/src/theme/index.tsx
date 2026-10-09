import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { fontSize, fonts, layout, minTouch, palettes, radius, space, type Palette } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
  fonts: typeof fonts;
  fontSize: typeof fontSize;
  space: typeof space;
  radius: typeof radius;
  minTouch: number;
  layout: typeof layout;
}

function themeFor(scheme: 'light' | 'dark'): Theme {
  return { scheme, colors: palettes[scheme], fonts, fontSize, space, radius, minTouch, layout };
}

const themes = { light: themeFor('light'), dark: themeFor('dark') };
const ThemeContext = createContext<Theme>(themes.light);

/** Follows the system light/dark setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
