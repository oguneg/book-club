import { bookKeyOf, roleAtLeast, type Edition } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEdition } from '@/api/books';
import { useClub, useClubActions } from '@/api/clubs';
import { useReadings } from '@/api/readings';
import { bookErrorMessage } from '@/books/errors';
import { parsePick } from '@/books/pick';
import { useStartReading } from '@/books/start';
import { formatAuthors, languageName } from '@/books/format';
import { clubErrorMessage } from '@/clubs/errors';
import { BookCover } from '@/components/BookCover';
import { Notes } from '@/components/Notes';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint, Row, Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function EditionDetails() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id, pick } = useLocalSearchParams<{ id: string; pick?: string }>();
  const query = useEdition(id);
  const edition = query.data?.edition;
  const pickParams = pick ? { pick } : {};
  const picking = parsePick(pick);

  return (
    <Screen>
      <PageTitle title={edition?.title} />
      <BackLink
        href={edition?.workKey ? { pathname: '/books/work/[key]', params: { key: edition.workKey, ...pickParams } } : { pathname: '/books', params: pickParams }}
        label={t('books.title')}
      />
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
            {picking?.kind === 'club' ? (
              <ChooseForClub clubId={picking.clubId} edition={edition} />
            ) : (
              <StartOrOpen edition={edition} clubId={picking?.clubId ?? undefined} />
            )}
            <Section title={t('books.edition.details')}>
              <Row label={t('books.edition.pages')} value={edition.pageCount ? String(edition.pageCount) : t('books.pagesUnknown')} />
              {edition.publisher && <Row label={t('books.edition.publisher')} value={edition.publisher} />}
              {edition.published && <Row label={t('books.edition.published')} value={edition.published} />}
              {edition.language && <Row label={t('books.edition.language')} value={languageName(edition.language) ?? ''} />}
              {edition.isbn13 && <Row label={t('books.edition.isbn')} value={edition.isbn13} />}
              <Hint>{t(`books.edition.source_${edition.source}`)}</Hint>
            </Section>
            {edition.workKey && (
              <TextLink href={{ pathname: '/books/work/[key]', params: { key: edition.workKey, ...pickParams } }} label={t('books.edition.otherEditions')} />
            )}
            {!picking && <BookNotes edition={edition} />}
          </View>
        </>
      )}
    </Screen>
  );
}

/** In picking mode (opened from a club's "Choose the book"): make this edition the club's book. */
function ChooseForClub({ clubId, edition }: { clubId: string; edition: Edition }) {
  const { t } = useTranslation();
  const club = useClub(clubId);
  const actions = useClubActions(clubId);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!club.data || !roleAtLeast(club.data.myRole, 'admin')) return null;
  const alreadyChosen = club.data.currentBook?.edition.id === edition.id;

  async function choose() {
    setBusy(true);
    setError(undefined);
    try {
      await actions.setBook({ editionId: edition.id });
      router.dismissTo({ pathname: '/clubs/[id]', params: { id: clubId } });
    } catch (err) {
      setError(clubErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {error && <Notice message={error} />}
      {alreadyChosen ? (
        <Notice tone="info" message={t('clubs.book.chosen')} />
      ) : edition.pageCount ? (
        <Button label={t('clubs.book.chooseFor', { club: club.data.name })} onPress={choose} loading={busy} />
      ) : (
        <Notice message={t('clubs.errors.edition_without_pages')} />
      )}
    </View>
  );
}

/** Everyone's notes on this book; readers of it (in any edition) can add theirs here too. */
function BookNotes({ edition }: { edition: Edition }) {
  const bookKey = bookKeyOf(edition);
  const reading = useReadings().data?.find((r) => r.bookKey === bookKey);
  return <Notes bookKey={bookKey} readingId={reading?.id} publicOnly />;
}

/** Start reading this edition, or, if you're already reading this book, go to your reading. */
function StartOrOpen({ edition, clubId }: { edition: Edition; clubId?: string }) {
  const { t } = useTranslation();
  const bookKey = bookKeyOf(edition);
  const mine = useReadings().data?.find((r) => r.bookKey === bookKey && r.status === 'reading');
  if (mine && !clubId) {
    return (
      <View style={{ alignSelf: 'flex-start' }}>
        <TextLink href={{ pathname: '/readings/[id]', params: { id: mine.id } }} label={t('reading.openYours')} />
      </View>
    );
  }
  return <StartThis edition={edition} clubId={clubId} />;
}

/** One tap: start reading this edition (we ask for pages only if the edition doesn't say). */
function StartThis({ edition, clubId }: { edition: Edition; clubId?: string }) {
  const { t } = useTranslation();
  const start = useStartReading();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <View style={{ gap: 8 }}>
      {error && <Notice message={error} />}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          label={t('reading.startThis')}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await start(edition, clubId);
            } catch (err) {
              setError(bookErrorMessage(t, err));
              setBusy(false);
            }
          }}
        />
      </View>
    </View>
  );
}
