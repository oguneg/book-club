import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useWork } from '@/api/books';
import { bookErrorMessage } from '@/books/errors';
import { editionSearchText, formatAuthors, languageName, preferredLanguages, publishedYear, sortByLanguage } from '@/books/format';
import { BookCover } from '@/components/BookCover';
import { BookRow } from '@/components/BookRow';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function WorkEditions() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { key } = useLocalSearchParams<{ key: string }>();
  const work = useWork(key);
  const [filter, setFilter] = useState('');

  const editions = useMemo(() => {
    const all = sortByLanguage(work.data?.editions ?? [], preferredLanguages(getLocales().map((l) => l.languageCode)));
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length === 0 ? all : all.filter((e) => words.every((w) => editionSearchText(e).includes(w)));
  }, [work.data, filter]);

  const summary = work.data?.work;

  return (
    <Screen>
      <PageTitle title={summary?.title ?? t('books.workTitle')} />
      <BackLink href="/books" label={t('books.title')} />
      {work.isPending && <ActivityIndicator color={colors.accent} />}
      {work.isError && <Notice message={bookErrorMessage(t, work.error)} />}
      {summary && (
        <>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-end' }}>
            <BookCover cover={summary.cover} title={summary.title} size="md" />
            <View style={{ flex: 1, gap: space.xs }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
                {summary.title}
              </Text>
              <Text style={{ fontSize: fontSize.md, color: colors.textMuted }}>{formatAuthors(summary.authors)}</Text>
            </View>
          </View>
          <View style={{ marginTop: space.xl, gap: space.md }}>
            <Hint>{t('books.chooseEdition')}</Hint>
            <TextField label={t('books.filterLabel')} value={filter} onChangeText={setFilter} autoCorrect={false} inputMode="search" />
          </View>
          <View style={{ marginTop: space.md, gap: space.xs }}>
            {editions.length === 0 && <Hint>{t('books.noEditions')}</Hint>}
            {editions.map((e) => (
              <BookRow
                key={e.id}
                href={{ pathname: '/books/edition/[id]', params: { id: e.id } }}
                cover={e.cover}
                title={e.title}
                lines={[
                  [e.publisher, publishedYear(e.published)].filter(Boolean).join(', ') || null,
                  [e.pageCount ? t('books.pages', { count: e.pageCount }) : t('books.pagesUnknown'), languageName(e.language), e.isbn13]
                    .filter(Boolean)
                    .join(' · '),
                ]}
              />
            ))}
          </View>
          <View style={{ marginTop: space.xl, gap: space.xs }}>
            <Hint>{t('books.notListed')}</Hint>
            <TextLink href="/books" label={t('books.searchIsbn')} />
            <TextLink
              href={{ pathname: '/books/new', params: { title: summary.title, authors: summary.authors.join(', '), workKey: summary.key } }}
              label={t('books.addManually')}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
