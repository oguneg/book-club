// Per-weight imports: a package root would bundle every weight. Each style's fonts load when it's chosen
// (on the web, that's when they download); the names match tokens.ts.
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { Literata_700Bold } from '@expo-google-fonts/literata/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_400Regular_Italic } from '@expo-google-fonts/nunito/400Regular_Italic';
import type { FontSource } from 'expo-font';
import type { StyleName } from './tokens';

export const styleFonts: Record<StyleName, Record<string, FontSource>> = {
  classic: { Literata_400Regular, Literata_400Regular_Italic, Literata_600SemiBold, Literata_700Bold },
  sleek: { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold },
  playful: { Fredoka_600SemiBold, Fredoka_700Bold, Nunito_400Regular, Nunito_400Regular_Italic },
};
