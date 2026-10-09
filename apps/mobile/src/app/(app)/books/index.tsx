import { looksLikeIsbn, normalizeIsbn } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { lookupIsbn, useBookSearch } from '@/api/books';
import { useClub } from '@/api/clubs';
import { ApiError } from '@/api/client';
import { bookErrorMessage } from '@/books/errors';
import { formatAuthors } from '@/books/format';
import { BookRow } from '@/components/BookRow';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

const DEBOUNCE_MS = 450;

export default function FindBook() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string; pick?: string }>();
  // Picking the book for a club: every link carries the club id along.
  const pick = params.pick ? { pick: params.pick } : {};
  const pickingFor = useClub(params.pick ?? '', { enabled: Boolean(params.pick) });
  const [text, setText] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const [isbnState, setIsbnState] = useState<{ busy: boolean; error?: string; notFound?: string }>({ busy: false });

  // Titles search as you type (after a pause); ISBNs are looked up on Enter.
  useEffect(() => {
    if (looksLikeIsbn(text)) return;
    const timer = setTimeout(() => setQuery(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const search = useBookSearch(query);

  async function submit() {
    if (!looksLikeIsbn(text)) {
      setQuery(text);
      return;
    }
    const isbn = normalizeIsbn(text);
    if (!isbn) {
      setIsbnState({ busy: false, error: t('books.isbnInvalid') });
      return;
    }
    setIsbnState({ busy: true });
    try {
      const edition = await lookupIsbn(isbn);
      setIsbnState({ busy: false });
      router.push({ pathname: '/books/edition/[id]', params: { id: edition.id, ...pick } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setIsbnState({ busy: false, notFound: isbn });
      else setIsbnState({ busy: false, error: bookErrorMessage(t, err) });
    }
  }

  const works = search.data?.works ?? [];
  const showEmpty = search.isSuccess && works.length === 0 && query.trim().length >= 2;

  return (
    <Screen>
      <PageTitle title={t('books.title')} />
      <BackLink href={params.pick ? { pathname: '/clubs/[id]', params: { id: params.pick } } : '/'} label={pickingFor.data?.name ?? t('appName')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
        {t('books.title')}
      </Text>
      {pickingFor.data && <Hint>{t('books.pickingFor', { club: pickingFor.data.name })}</Hint>}
      <View style={{ marginTop: space.xl, gap: space.md }}>
        <TextField
          label={t('books.searchLabel')}
          hint={t('books.searchHint')}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setIsbnState({ busy: false });
          }}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          inputMode="search"
          onSubmitEditing={submit}
        />
        {isbnState.error && <Notice message={isbnState.error} />}
        {isbnState.notFound && (
          <View style={{ gap: space.xs }}>
            <Notice message={t('books.isbnNotFound', { isbn: isbnState.notFound })} />
            <TextLink href={{ pathname: '/books/new', params: { isbn: isbnState.notFound, ...pick } }} label={t('books.addManually')} />
          </View>
        )}
        {search.isError && <Notice message={bookErrorMessage(t, search.error)} />}
      </View>

      <View style={{ marginTop: space.lg, gap: space.xs }} accessibilityLiveRegion="polite">
        {(search.isFetching || isbnState.busy) && (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', paddingVertical: space.sm }}>
            <ActivityIndicator color={colors.accent} />
            <Hint>{t('books.searching')}</Hint>
          </View>
        )}
        {showEmpty && <Hint>{t('books.noResults', { query: query.trim() })}</Hint>}
        {works.map((work) => (
          <BookRow
            key={work.key}
            href={{ pathname: '/books/work/[key]', params: { key: work.key, ...pick } }}
            cover={work.cover}
            title={work.title}
            lines={[
              formatAuthors(work.authors),
              [work.firstPublished ? t('books.firstPublished', { year: work.firstPublished }) : null, t('books.editions', { count: work.editionCount })]
                .filter(Boolean)
                .join(' · '),
            ]}
          />
        ))}
      </View>

      <View style={{ marginTop: space.xl, gap: space.xs }}>
        <Hint>{t('books.cantFind')}</Hint>
        <TextLink href={{ pathname: '/books/new', params: pick }} label={t('books.addManually')} />
      </View>
    </Screen>
  );
}
