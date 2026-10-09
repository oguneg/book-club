import { roleAtLeast } from '@bookclub/shared';
import { getLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { BookmarkCheck, BookmarkPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useWork } from '@/api/books';
import { useClub } from '@/api/clubs';
import { useReadings, useWantToRead, useWantToReadActions } from '@/api/readings';
import { bookErrorMessage } from '@/books/errors';
import { editionSearchText, formatAuthors, languageName, preferredLanguages, publishedYear, sortByLanguage } from '@/books/format';
import { parsePick } from '@/books/pick';
import { pickEdition, useChooseForClub, useStartReading } from '@/books/start';
import { clubErrorMessage } from '@/clubs/errors';
import { BookCover } from '@/components/BookCover';
import { BookRow } from '@/components/BookRow';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

/**
 * A book (all its editions). One decision: start reading it (or save it for later), or choose it for a
 * club. We pick a sensible edition; "Different edition?" lists them all for readers who care which one.
 */
export default function BookPage() {
  const { colors, fonts, fontSize, space, minTouch } = useTheme();
  const { t } = useTranslation();
  const { key, pick: pickId } = useLocalSearchParams<{ key: string; pick?: string }>();
  const pick = pickId ? { pick: pickId } : {};
  const picking = parsePick(pickId);
  const work = useWork(key);
  const readings = useReadings();
  const club = useClub(picking?.clubId ?? '', { enabled: Boolean(picking?.clubId) });
  const chooseForClub = useChooseForClub(picking?.clubId ?? '');
  const start = useStartReading();
  const want = useWantToRead();
  const wantActions = useWantToReadActions();
  const [saving, setSaving] = useState(false);
  const [showEditions, setShowEditions] = useState(false);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const all = useMemo(() => sortByLanguage(work.data?.editions ?? [], preferredLanguages(getLocales().map((l) => l.languageCode))), [work.data]);
  const editions = useMemo(() => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length === 0 ? all : all.filter((e) => words.every((w) => editionSearchText(e).includes(w)));
  }, [all, filter]);
  const chosen = pickEdition(all);
  const summary = work.data?.work;
  const mine = readings.data?.find((r) => r.bookKey === `w:${key}` && r.status === 'reading');
  const forClub = picking?.kind === 'club';
  const saved = want.data?.find((b) => b.bookKey === `w:${key}`);

  async function toggleWant() {
    if (!chosen) return;
    setSaving(true);
    setError(undefined);
    try {
      await (saved ? wantActions.remove(saved.id) : wantActions.add(chosen.id));
    } catch (err) {
      setError(bookErrorMessage(t, err));
    }
    setSaving(false);
  }

  async function primary() {
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    try {
      if (picking?.kind === 'club') {
        await chooseForClub(chosen, { setup: picking.setup });
      } else {
        await start(chosen, picking?.clubId);
      }
    } catch (err) {
      setError(forClub ? clubErrorMessage(t, err) : bookErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageTitle title={summary?.title ?? t('books.workTitle')} />
      <BackLink href={{ pathname: '/books', params: pick }} label={t('books.title')} />
      {work.isPending && <ActivityIndicator color={colors.accent} />}
      {work.isError && <Notice message={bookErrorMessage(t, work.error)} />}
      {summary && (
        <View style={{ gap: space.xl }}>
          <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.sm }}>
            <BookCover cover={chosen?.cover ?? summary.cover} title={summary.title} size="lg" />
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2, color: colors.text, textAlign: 'center' }}>
                {summary.title}
              </Text>
              <Text style={{ fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' }}>{formatAuthors(summary.authors)}</Text>
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            {error && <Notice message={error} />}
            {mine && !forClub ? (
              <Button label={t('books.book.openYours')} onPress={() => router.dismissTo({ pathname: '/readings/[id]', params: { id: mine.id } })} />
            ) : chosen ? (
              forClub && club.data && !roleAtLeast(club.data.myRole, 'admin') ? null : (
                <Button
                  label={forClub ? t('books.book.chooseFor', { club: club.data?.name ?? '' }) : t('books.book.start')}
                  onPress={() => void primary()}
                  loading={busy}
                />
              )
            ) : (
              <Notice message={t('books.noEditions')} />
            )}
            {chosen && !mine && !forClub && want.isSuccess &&
              (saved ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: minTouch }}>
                  <BookmarkCheck size={20} color={colors.accent} strokeWidth={1.75} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>{t('books.book.wanted')}</Text>
                  <TextButton tone="muted" label={t('books.book.unwant')} onPress={() => void toggleWant()} disabled={saving} />
                </View>
              ) : (
                <Button variant="secondary" label={t('books.book.want')} icon={<BookmarkPlus size={18} color={colors.text} strokeWidth={1.75} />} loading={saving} onPress={() => void toggleWant()} />
              ))}
            {chosen && !mine && (
              <Hint>
                {chosen.pageCount
                  ? t('books.book.usingEdition', { edition: [chosen.publisher, publishedYear(chosen.published)].filter(Boolean).join(', ') || chosen.title, pages: chosen.pageCount })
                  : t('books.book.pagesAsked')}
              </Hint>
            )}
            {!mine && (
              <View style={{ alignSelf: 'flex-start' }}>
                <TextButton label={showEditions ? t('books.book.hideEditions') : t('books.book.differentEdition')} onPress={() => setShowEditions((s) => !s)} />
              </View>
            )}
          </View>

          {showEditions && (
            <View style={{ gap: space.md }}>
              <TextField label={t('books.filterLabel')} value={filter} onChangeText={setFilter} autoCorrect={false} inputMode="search" />
              <View style={{ gap: space.xs }}>
                {editions.length === 0 && <Hint>{t('books.noEditions')}</Hint>}
                {editions.map((e) => (
                  <BookRow
                    key={e.id}
                    href={{ pathname: '/books/edition/[id]', params: { id: e.id, ...pick } }}
                    cover={e.cover}
                    title={e.title}
                    lines={[
                      [e.publisher, publishedYear(e.published)].filter(Boolean).join(', ') || null,
                      [e.pageCount ? t('books.pages', { count: e.pageCount }) : t('books.pagesUnknown'), languageName(e.language), e.isbn13].filter(Boolean).join(' · '),
                    ]}
                  />
                ))}
              </View>
              <View style={{ gap: space.xs }}>
                <Hint>{t('books.notListed')}</Hint>
                <TextLink
                  href={{ pathname: '/books/new', params: { title: summary.title, authors: summary.authors.join(', '), workKey: summary.key, ...pick } }}
                  label={t('books.addManually')}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
