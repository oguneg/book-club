import { POSITION_SCALE, type Reading, type WantToRead } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Search, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useReadings, useWantToRead, useWantToReadActions } from '@/api/readings';
import { bookErrorMessage } from '@/books/errors';
import { formatAuthors } from '@/books/format';
import { openReading, useStartReading } from '@/books/start';
import { formatDate } from '@/clubs/format';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { BookRow } from '@/components/BookRow';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FinishedSheet } from '@/components/FinishedSheet';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { UpdatePageSheet } from '@/components/UpdatePageSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

type Show = 'reading' | 'want' | 'read';

/**
 * My books: what you're reading (each with its own "Update page", so several books are one tap each),
 * what you want to read, and what you've read.
 */
export default function MyBooks() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const params = useLocalSearchParams<{ show?: string }>();
  const [show, setShow] = useState<Show>(params.show === 'want' || params.show === 'read' ? params.show : 'reading');
  const readings = useReadings();
  const all = readings.data ?? [];
  // Newest started first, and stable: a card doesn't jump to the top as you update it.
  const current = all.filter((r) => r.status === 'reading').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  // One sheet for whichever book you tap; kept after closing so it can slide away.
  const [updating, setUpdating] = useState<{ reading: Reading; open: boolean } | null>(null);
  const [finished, setFinished] = useState<Reading | null>(null);

  return (
    <Screen>
      <PageTitle title={t('myBooks.title')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.15, color: colors.text }}>
          {t('myBooks.title')}
        </Text>
        <IconButton icon={Plus} label={t('myBooks.add')} onPress={() => router.push({ pathname: '/books', params: { pick: 'read' } })} />
      </View>
      <Segmented
        label={t('myBooks.sections')}
        options={[
          { value: 'reading', label: t('myBooks.reading') },
          { value: 'want', label: t('myBooks.want') },
          { value: 'read', label: t('myBooks.read') },
        ]}
        value={show}
        onChange={setShow}
      />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {show === 'want' ? (
          <WantList onStarted={() => setShow('reading')} />
        ) : readings.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : readings.isError ? (
          <Notice message={readingErrorMessage(t, readings.error)} />
        ) : show === 'reading' ? (
          current.length === 0 ? (
            <WhatAreYouReading />
          ) : (
            <List>
              {current.map((r) => (
                <ReadingCard key={r.id} reading={r} onUpdate={() => setUpdating({ reading: r, open: true })} />
              ))}
            </List>
          )
        ) : (
          <ReadList readings={all} />
        )}
      </View>
      {updating && (
        <UpdatePageSheet
          key={updating.reading.id}
          reading={updating.reading}
          bookTitle={updating.reading.edition.title}
          visible={updating.open}
          onClose={() => setUpdating((u) => u && { ...u, open: false })}
          onFinished={() => setFinished(updating.reading)}
        />
      )}
      {finished && (
        <FinishedSheet
          key={finished.id}
          reading={finished}
          visible
          onClose={() => setFinished(null)}
          onLastThought={() => {
            setFinished(null);
            openReading(finished.id, 'note');
          }}
          onReadNotes={() => {
            setFinished(null);
            openReading(finished.id);
          }}
        />
      )}
    </Screen>
  );
}

function List({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View role="list" style={{ gap: space.md }}>
      {children}
    </View>
  );
}

/** One thing you can open or act on, as a card. */
function Card({ children }: { children: ReactNode }) {
  const { colors, radius, space } = useTheme();
  return (
    <View role="listitem" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md + 4, padding: space.xs, gap: space.sm }}>
      {children}
    </View>
  );
}

/** A book you're reading: where you are, and one button to update it. Tap the book for its notes. */
function ReadingCard({ reading, onUpdate }: { reading: Reading; onUpdate: () => void }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const read = reading.position / POSITION_SCALE;
  return (
    <Card>
      <BookRow
        href={{ pathname: '/readings/[id]', params: { id: reading.id } }}
        cover={reading.edition.cover}
        title={reading.edition.title}
        lines={[formatAuthors(reading.edition.authors), readingLine(t, reading)]}
        coverSize="md"
      />
      <View style={{ paddingHorizontal: space.sm, paddingBottom: space.sm, gap: space.md }}>
        <ProgressBar value={read} />
        <Button variant="secondary" label={t('reading.update.button')} accessibilityLabel={t('myBooks.updateLabel', { title: reading.edition.title })} onPress={onUpdate} />
      </View>
    </Card>
  );
}

/** Books saved for later: start one in a tap, or take it off the list. */
function WantList({ onStarted }: { onStarted: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const want = useWantToRead();
  const actions = useWantToReadActions();
  const start = useStartReading();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(bookErrorMessage(t, err));
    }
    setBusy(null);
  }

  if (want.isPending) return <ActivityIndicator color={colors.accent} />;
  if (want.isError) return <Notice message={bookErrorMessage(t, want.error)} />;
  if (want.data.length === 0) {
    return (
      <View style={{ gap: space.md }}>
        <Hint>{t('myBooks.wantEmpty')}</Hint>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" label={t('myBooks.find')} icon={<Search size={18} color={colors.text} />} onPress={() => router.push('/books')} />
        </View>
      </View>
    );
  }
  return (
    <>
      {error && <Notice message={error} />}
      <List>
        {want.data.map((b: WantToRead) => (
          <Card key={b.id}>
            <BookRow
              href={
                b.edition.workKey ? { pathname: '/books/work/[key]', params: { key: b.edition.workKey } } : { pathname: '/books/edition/[id]', params: { id: b.edition.id } }
              }
              cover={b.edition.cover}
              title={b.edition.title}
              lines={[formatAuthors(b.edition.authors), b.edition.pageCount ? t('books.pages', { count: b.edition.pageCount }) : null]}
              coverSize="md"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  label={t('myBooks.start')}
                  accessibilityLabel={t('myBooks.startLabel', { title: b.edition.title })}
                  loading={busy === b.id}
                  onPress={() =>
                    void run(b.id, async () => {
                      await start(b.edition);
                      onStarted();
                    })
                  }
                />
              </View>
              <IconButton icon={X} label={t('myBooks.remove', { title: b.edition.title })} onPress={() => void run(b.id, () => actions.remove(b.id))} />
            </View>
          </Card>
        ))}
      </List>
    </>
  );
}

/** Finished books, newest first; then the ones you stopped. */
function ReadList({ readings }: { readings: Reading[] }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const finished = readings.filter((r) => r.status === 'finished');
  const stopped = readings.filter((r) => r.status === 'stopped');
  if (finished.length === 0 && stopped.length === 0) return <Hint>{t('myBooks.readEmpty')}</Hint>;
  const row = (r: Reading, line: string) => (
    <View key={r.id} role="listitem">
      <BookRow href={{ pathname: '/readings/[id]', params: { id: r.id } }} cover={r.edition.cover} title={r.edition.title} lines={[formatAuthors(r.edition.authors), line]} />
    </View>
  );
  return (
    <View style={{ gap: space.xl }}>
      {finished.length > 0 && (
        <View role="list" style={{ gap: space.xs }}>
          {finished.map((r) => row(r, r.finishedAt ? t('myBooks.finished', { date: formatDate(r.finishedAt.slice(0, 10)) }) : t('reading.finished')))}
        </View>
      )}
      {stopped.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
            {t('myBooks.didntFinish')}
          </Text>
          <View role="list" style={{ gap: space.xs }}>
            {stopped.map((r) => row(r, r.currentPage ? t('myBooks.stoppedAt', { page: r.currentPage }) : t('myBooks.stoppedEarly')))}
          </View>
        </View>
      )}
    </View>
  );
}

/** Nothing on the go: the one question that gets you going. */
function WhatAreYouReading() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const [q, setQ] = useState('');
  const go = () => router.push({ pathname: '/books', params: { pick: 'read', ...(q.trim() ? { q: q.trim() } : {}) } });
  return (
    <View style={{ gap: space.lg, paddingTop: space.md }}>
      <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2, color: colors.text }}>
        {t('reading.empty.title')}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('reading.empty.body')}</Text>
      <TextField label={t('books.searchLabel')} value={q} onChangeText={setQ} inputMode="search" returnKeyType="search" onSubmitEditing={go} autoCorrect={false} />
      <Button label={t('reading.empty.find')} icon={<Search size={18} color={colors.onAccent} />} onPress={go} />
      <View style={{ alignItems: 'center', marginTop: space.sm }}>
        <TextLink href="/clubs/join" label={t('reading.empty.invite')} />
      </View>
    </View>
  );
}
