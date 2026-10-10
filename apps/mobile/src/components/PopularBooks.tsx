import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { usePopularBooks } from '@/api/books';
import { formatAuthors } from '@/books/format';
import { BookCover } from '@/components/BookCover';
import { useTheme } from '@/theme';

/**
 * Something to start from when the shelf is empty: books people are reading this week, face out. A tap
 * opens the book's page (Start reading or Want to read; or "Choose" while picking a club's book). Shows
 * nothing when the list can't be had.
 */
export function PopularBooks({ title, pick = 'read' }: { title?: string; pick?: string }) {
  const { t } = useTranslation();
  const popular = usePopularBooks();
  const works = popular.data ?? [];
  if (works.length === 0) return null;
  return (
    <CoverRow
      title={title ?? t('popular.title')}
      items={works.map((w) => ({ key: w.key, title: w.title, authors: w.authors, cover: w.cover, href: { pathname: '/books/work/[key]', params: { key: w.key, pick } } }))}
    />
  );
}

export type CoverItem = { key: string; title: string; authors: string[]; cover: string | null; href: Href };

/** A titled row of books face out, scrolling sideways; a tap opens the book. */
export function CoverRow({ title, items }: { title: string; items: CoverItem[] }) {
  const { colors, fonts, fontSize, space } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.lg }} style={{ marginRight: -space.lg }}>
        {items.map((w) => (
          <Pressable
            key={w.key}
            accessibilityRole="link"
            accessibilityLabel={[w.title, formatAuthors(w.authors)].filter(Boolean).join(', ')}
            onPress={() => router.push(w.href)}
            style={({ pressed }) => ({ width: 96, gap: space.xs, opacity: pressed ? 0.75 : 1 })}
          >
            <View style={{ alignSelf: 'flex-start', borderRadius: 6, boxShadow: colors.coverShadow }}>
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
