import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { STYLE_NAMES, type StyleName } from './tokens';

// How the app looks on this device: a style, and light or dark (or whatever the system says). Kept on the
// device and read before the first paint, so the app never flashes another style while starting.

export type Mode = 'system' | 'light' | 'dark';
export interface Appearance {
  style: StyleName;
  mode: Mode;
}

const DEFAULT: Appearance = { style: 'classic', mode: 'system' };
const NAME = 'bookclub-appearance';
const file = () => new File(Paths.document, `${NAME}.json`);

function parse(raw: string | null | undefined): Appearance {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<Appearance> | null;
    return {
      style: STYLE_NAMES.includes(value?.style as StyleName) ? (value!.style as StyleName) : DEFAULT.style,
      mode: value?.mode === 'light' || value?.mode === 'dark' ? value.mode : 'system',
    };
  } catch {
    return DEFAULT;
  }
}

export function loadAppearance(): Appearance {
  try {
    if (Platform.OS === 'web') return parse(globalThis.localStorage?.getItem(NAME));
    const f = file();
    return f.exists ? parse(f.textSync()) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function saveAppearance(appearance: Appearance): void {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(NAME, JSON.stringify(appearance));
      return;
    }
    const f = file();
    f.create({ overwrite: true });
    f.write(JSON.stringify(appearance));
  } catch {
    // Storage unavailable: the choice holds until the app closes.
  }
}
