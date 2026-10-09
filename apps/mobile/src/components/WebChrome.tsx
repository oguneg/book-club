import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/theme';

/**
 * The parts of a web page no component draws: selected text, the text caret, scrollbars and the keyboard
 * focus ring. Themed from the palette so they belong to the journal, not to the browser.
 */
export function WebChrome() {
  const { scheme, colors } = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'bookclub-web-chrome';
    const style = (document.getElementById(id) as HTMLStyleElement | null) ?? document.head.appendChild(Object.assign(document.createElement('style'), { id }));
    style.textContent = `
      :root { color-scheme: ${scheme}; caret-color: ${colors.accent}; scrollbar-color: ${colors.control} ${colors.background}; }
      ::selection { background: ${colors.selection}; color: ${colors.text}; }
      :focus-visible { outline: 2px solid ${colors.accent}; outline-offset: 2px; border-radius: 4px; }
      a { text-underline-offset: 0.2em; }
    `;
  }, [scheme, colors]);
  return null;
}
