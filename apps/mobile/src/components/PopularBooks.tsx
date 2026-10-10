import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { usePopularBooks } from '@/api/books';
import { formatAuthors } from '@/books/format';
import { BookCover } from '@/components/BookCover';
import { useTheme } from '@/theme';

/**
 * Something to start from when the shelf is empty: books people are reading this week, face out. A tap
 * opens the book's page (Start reading or Want to read). Shows nothing when the list can't be had.
 */
export function PopularBooks({ title }: { title?: string }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const popular = usePopularBooks();
  const works = popular.data ?? [];
  if (works.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
        {title ?? t('popular.title')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.lg }} style={{ marginRight: -space.lg }}>
        {works.map((w) => (
          <Pressable
            key={w.key}
            accessibilityRole="link"
            accessibilityLabel={[w.title, formatAuthors(w.authors)].filter(Boolean).join(', ')}
            onPress={() => router.push({ pathname: '/books/work/[key]', params: { key: w.key, pick: 'read' } })}
            style={({ pressed }) => ({ width: 96, gap: space.xs, opacity: pressed ? 0.75 : 1 })}
          >
            <View style={{ alignSelf: 'flex-start', borderRadius: 6, boxShadow: '0px 1px 2px rgba(42,33,25,0.12), 0px 8px 18px -10px rgba(42,33,25,0.45)' }}>
              <BookCover cover={w.cover} title={w.title} size="md" />
            </View>
            <Text numberOfLines={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.3, color: colors.text }}>
              {w.title}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              {formatAuthors(w.authors)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
