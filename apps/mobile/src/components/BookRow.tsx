import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BookCover } from '@/components/BookCover';
import { useTheme } from '@/theme';

/** A tappable line in a list of books or editions: cover, title, then up to two lines of details. */
export function BookRow({ href, cover, title, lines }: { href: Href; cover: string | null; title: string; lines: (string | null)[] }) {
  const { colors, fonts, fontSize, space, radius } = useTheme();
  // Link passes its props to the Pressable as a plain style, so a style function wouldn't apply here.
  const [highlighted, setHighlighted] = useState(false);
  const details = lines.filter((l): l is string => Boolean(l));
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={[title, ...details].join(', ')}
        onHoverIn={() => setHighlighted(true)}
        onHoverOut={() => setHighlighted(false)}
        onPressIn={() => setHighlighted(true)}
        onPressOut={() => setHighlighted(false)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.sm,
          borderRadius: radius.md,
          backgroundColor: highlighted ? colors.surface : 'transparent',
        }}
      >
        <BookCover cover={cover} title={title} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }} numberOfLines={2}>
            {title}
          </Text>
          {details.map((line) => (
            <Text key={line} style={{ fontSize: fontSize.sm, color: colors.textMuted }} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
      </Pressable>
    </Link>
  );
}
