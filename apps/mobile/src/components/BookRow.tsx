import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BookCover } from '@/components/BookCover';
import { useTheme } from '@/theme';

/** A tappable line in a list of books or editions: cover, title, then up to two lines of details. */
export function BookRow({
  href,
  cover,
  title,
  lines,
  coverSize = 'sm',
  onPress,
  selected = false,
}: {
  href: Href;
  cover: string | null;
  title: string;
  lines: (string | null)[];
  coverSize?: 'sm' | 'md';
  /** Instead of following the link (e.g. show the book in the pane beside the list). */
  onPress?: () => void;
  selected?: boolean;
}) {
  const { colors, fonts, fontSize, space, radius } = useTheme();
  // Link passes its props to the Pressable as a plain style, so a style function wouldn't apply here.
  const [highlighted, setHighlighted] = useState(false);
  const details = lines.filter((l): l is string => Boolean(l));
  const row = (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'link'}
      onPress={onPress}
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
        backgroundColor: highlighted || selected ? colors.surface : 'transparent',
      }}
    >
      <BookCover cover={cover} title={title} size={coverSize} />
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
  );
  return onPress ? (
    row
  ) : (
    <Link href={href} asChild>
      {row}
    </Link>
  );
}
