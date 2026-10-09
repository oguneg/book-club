import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEdition } from '@/api/books';
import { bookErrorMessage } from '@/books/errors';
import { formatAuthors, languageName } from '@/books/format';
import { BookCover } from '@/components/BookCover';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Notice } from '@/components/ui/Notice';
import { Hint, Row, Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function EditionDetails() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useEdition(id);
  const edition = query.data?.edition;

  return (
    <Screen>
      <PageTitle title={edition?.title} />
      <BackLink href={edition?.workKey ? { pathname: '/books/work/[key]', params: { key: edition.workKey } } : '/books'} label={t('books.title')} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={bookErrorMessage(t, query.error)} />}
      {edition && (
        <>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <BookCover cover={edition.cover} title={edition.title} size="lg" />
            <View style={{ flex: 1, minWidth: 180, gap: space.xs }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
                {edition.title}
              </Text>
              {edition.subtitle && <Text style={{ fontFamily: fonts.readingItalic, fontSize: fontSize.md, color: colors.text }}>{edition.subtitle}</Text>}
              {edition.authors.length > 0 && (
                <Text style={{ fontSize: fontSize.md, color: colors.textMuted }}>{t('books.edition.by', { authors: formatAuthors(edition.authors) })}</Text>
              )}
            </View>
          </View>

          <View style={{ marginTop: space.xl, gap: space.lg }}>
            <Section title={t('books.edition.details')}>
              <Row label={t('books.edition.pages')} value={edition.pageCount ? String(edition.pageCount) : t('books.pagesUnknown')} />
              {edition.publisher && <Row label={t('books.edition.publisher')} value={edition.publisher} />}
              {edition.published && <Row label={t('books.edition.published')} value={edition.published} />}
              {edition.language && <Row label={t('books.edition.language')} value={languageName(edition.language) ?? ''} />}
              {edition.isbn13 && <Row label={t('books.edition.isbn')} value={edition.isbn13} />}
              <Hint>{t(`books.edition.source_${edition.source}`)}</Hint>
            </Section>
            <Hint>{t('books.edition.clubsNote')}</Hint>
            {edition.workKey && (
              <TextLink href={{ pathname: '/books/work/[key]', params: { key: edition.workKey } }} label={t('books.edition.otherEditions')} />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
