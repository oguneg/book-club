import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { coverUri } from '@/api/client';
import { useTheme } from '@/theme';

const SIZES = { sm: 48, md: 72, lg: 128 } as const;

/** A book cover, or a cloth-coloured stand-in with the title's first letter when there is none. */
export function BookCover({ cover, title, size = 'sm' }: { cover: string | null; title: string; size?: keyof typeof SIZES }) {
  const { colors, fonts, radius } = useTheme();
  // Remembers a failed load for this key only; another cover (or the next visit) tries again.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = failedKey !== null && failedKey === cover;
  const width = SIZES[size];
  const height = Math.round(width * 1.5);

  if (!cover || failed) {
    return (
      <View
        aria-hidden
        style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.onAccent, fontFamily: fonts.headingBold, fontSize: width / 2.4 }}>{title.trim().charAt(0).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: coverUri(cover) }}
      accessibilityIgnoresInvertColors
      alt=""
      onError={() => setFailedKey(cover)}
      contentFit="cover"
      transition={150}
      style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.border }}
    />
  );
}
