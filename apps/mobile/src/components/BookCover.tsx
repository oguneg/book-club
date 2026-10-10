import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { coverUri } from '@/api/client';
import { useTheme } from '@/theme';

const SIZES = { sm: 48, md: 72, lg: 128 } as const;

/** A steady cloth colour per title, so books without a cover still look like different books. */
function clothOf(title: string, cloths: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return cloths[h % cloths.length]!;
}

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
        style={{ width, height, borderRadius: radius.sm, backgroundColor: clothOf(title, colors.people), alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontFamily: fonts.headingBold, fontSize: width / 2.4 }}>{title.trim().charAt(0).toUpperCase()}</Text>
      </View>
    );
  }
  // Decorative: the title is always next to it. expo-image drops an empty alt on the web, so the wrapper
  // hides it from screen readers instead.
  return (
    <View aria-hidden style={{ width, height }}>
      <Image
        source={{ uri: coverUri(cover) }}
        accessibilityIgnoresInvertColors
        alt=""
        onError={() => setFailedKey(cover)}
        contentFit="cover"
        transition={150}
        style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.border }}
      />
    </View>
  );
}
