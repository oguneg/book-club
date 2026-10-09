import { useQueryClient } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEdition } from '@/api/books';
import { ApiError } from '@/api/client';
import { startReading } from '@/api/readings';
import { formatAuthors, publishedYear } from '@/books/format';
import { readingErrorMessage } from '@/readings/errors';
import { BookCover } from '@/components/BookCover';
import { FormLayout } from '@/components/FormLayout';
import { PageRangeFields, parsePageRange } from '@/components/PageRangeFields';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

// Start reading an edition: confirm the pages the story runs over in this copy.
export default function StartReading() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { editionId, club } = useLocalSearchParams<{ editionId: string; club?: string }>();
  const query = useEdition(editionId);
  const edition = query.data?.edition;
  if (!edition) {
    return (
      <FormLayout title={t('reading.startTitle')}>
        {query.isError ? <Notice message={readingErrorMessage(t, query.error)} /> : <ActivityIndicator color={colors.accent} />}
      </FormLayout>
    );
  }
  return <Form key={edition.id} edition={edition} clubId={club} />;
}

function Form({ edition, clubId }: { edition: NonNullable<ReturnType<typeof useEdition>['data']>['edition']; clubId?: string }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const queryClient = useQueryClient();
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState(edition.pageCount ? String(edition.pageCount) : '');
  const [error, setError] = useState<string>();
  const [rangeError, setRangeError] = useState<string>();
  const [existing, setExisting] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const range = parsePageRange(start, end);
    if (!range) {
      setRangeError(t('reading.rangeInvalid'));
      return;
    }
    setRangeError(undefined);
    setBusy(true);
    setError(undefined);
    try {
      const reading = await startReading({ editionId: edition.id, ...range });
      await queryClient.invalidateQueries({ queryKey: ['readings'] });
      if (clubId) {
        await queryClient.invalidateQueries({ queryKey: ['club-progress', clubId] });
        router.dismissTo({ pathname: '/clubs/[id]', params: { id: clubId } });
      } else {
        router.replace({ pathname: '/readings/[id]', params: { id: reading.id } });
      }
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === 'already_reading') {
        setExisting(typeof err.details.readingId === 'string' ? err.details.readingId : '');
      }
      setError(readingErrorMessage(t, err));
    }
  }

  return (
    <FormLayout title={t('reading.startTitle')} subtitle={t('reading.startSubtitle')}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <BookCover cover={edition.cover} title={edition.title} size="md" />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>{edition.title}</Text>
          <Hint>{formatAuthors(edition.authors)}</Hint>
          <Hint>{[edition.publisher, publishedYear(edition.published), edition.pageCount ? t('books.pages', { count: edition.pageCount }) : null].filter(Boolean).join(' · ')}</Hint>
        </View>
      </View>
      {error && <Notice message={error} />}
      {existing !== undefined && existing !== '' && (
        <Link href={{ pathname: '/readings/[id]', params: { id: existing } }} style={{ color: colors.accent, fontWeight: '600' }}>
          {t('reading.openIt')}
        </Link>
      )}
      <PageRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} error={rangeError} />
      <Button label={t('reading.start')} onPress={submit} loading={busy} disabled={!start || !end} />
    </FormLayout>
  );
}
