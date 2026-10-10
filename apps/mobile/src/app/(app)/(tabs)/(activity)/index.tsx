import { POSITION_SCALE, type ActivityItem, type ClubSummary, type Reading } from '@bookclub/shared';
import { Link, router } from 'expo-router';
import { BookCheck, EyeOff, MessageCircle, Search, UserPlus } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useActivity } from '@/api/activity';
import { useClubs } from '@/api/clubs';
import { useReadings, useReadingStats } from '@/api/readings';
import { authClient } from '@/auth/client';
import { openReading } from '@/books/start';
import { formatMeetingTime } from '@/clubs/format';
import { takePendingInvite } from '@/clubs/pendingInvite';
import { noteTime, placeLabel } from '@/notes/format';
import { calendarOf } from '@/readings/calendar';
import { readingLine } from '@/readings/format';
import { Avatar } from '@/components/Avatar';
import { BookCover } from '@/components/BookCover';
import { FinishedSheet } from '@/components/FinishedSheet';
import { PopularBooks } from '@/components/PopularBooks';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { TodayCard } from '@/components/TodayCard';
import { UpdatePageSheet } from '@/components/UpdatePageSheet';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTheme } from '@/theme';

/**
 * Home: the books you're in, one tap from an update, and what's been happening in your clubs (who read how
 * far, who left a note, who finished, what's coming up). Nothing from past your place is shown.
 */
export default function Home() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const { data: session } = authClient.useSession();
  const readings = useReadings();
  const clubs = useClubs().data ?? [];
  const current = (readings.data ?? []).filter((r) => r.status === 'reading').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [updating, setUpdating] = useState<{ reading: Reading; open: boolean } | null>(null);
  const [finished, setFinished] = useState<Reading | null>(null);
  const [now] = useState(() => Date.now());
  const stats = useReadingStats().data;
  const weekPages = stats ? calendarOf(stats, new Date(now)).weekPages : 0;
  const firstName = session?.user.name.trim().split(/\s+/)[0] ?? '';
  const hour = new Date(now).getHours();
  const greeting = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  // Back from signing in (or confirming an email) with an invite still open: continue joining.
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/join/[code]', params: { code } });
  }, []);

  return (
    <Screen>
      <PageTitle title={t('tabs.home')} />
      <View style={{ gap: space.xl }}>
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.15, color: colors.text }}>
            {t(`homeFeed.greeting.${greeting}`, { name: firstName })}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>
            {[new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(now), weekPages > 0 ? t('homeFeed.weekLine', { count: weekPages, pages: new Intl.NumberFormat().format(weekPages) }) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {/* Today: the streak, your daily goal, and what each book with a date asks of you. */}
        {current.length > 0 && <TodayCard readings={current} />}

        {readings.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : current.length > 0 ? (
          <Section title={t('homeFeed.readingNow')} action={<Link href="/library" style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '600' }}>{t('homeFeed.seeAll')}</Link>}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.lg, paddingRight: space.lg }} style={{ marginRight: -space.lg }}>
              {current.map((r) => (
                <NowReading key={r.id} reading={r} onUpdate={() => setUpdating({ reading: r, open: true })} />
              ))}
            </ScrollView>
          </Section>
        ) : (
          <>
            <StartReading />
            <PopularBooks title={t('popular.orStart')} />
          </>
        )}

        <ComingUp clubs={clubs} now={now} />
        <Feed clubs={clubs} readings={readings.data ?? []} now={now} />
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

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const { colors, fonts, fontSize, space } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A book you're in, face out: the cover opens it, the pill updates your page. */
function NowReading({ reading, onUpdate }: { reading: Reading; onUpdate: () => void }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  return (
    <View style={{ width: 128, gap: space.sm }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${reading.edition.title}, ${readingLine(t, reading)}`} onPress={() => openReading(reading.id)} style={({ pressed }) => ({ gap: space.sm, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ borderRadius: 8, boxShadow: colors.coverShadow }}>
          <BookCover cover={reading.edition.cover} title={reading.edition.title} size="lg" />
        </View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.md, lineHeight: fontSize.md * 1.25, color: colors.text }}>
          {reading.edition.title}
        </Text>
      </Pressable>
      <ProgressBar value={reading.position / POSITION_SCALE} />
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>{readingLine(t, reading)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('myBooks.updateLabel', { title: reading.edition.title })}
        onPress={onUpdate}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          minHeight: 36,
          paddingHorizontal: space.md,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.control,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '700' }}>{t('homeFeed.update')}</Text>
      </Pressable>
    </View>
  );
}

/** No book on the go: the one question that gets you going. */
function StartReading() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  return (
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
        {t('reading.empty.title')}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('reading.empty.body')}</Text>
      <Button label={t('reading.empty.find')} icon={<Search size={18} color={colors.onAccent} />} onPress={() => router.push({ pathname: '/books', params: { pick: 'read' } })} />
    </View>
  );
}

/** Club meetings in the next two weeks. */
function ComingUp({ clubs, now }: { clubs: ClubSummary[]; now: number }) {
  const { t } = useTranslation();
  const { colors, fontSize, radius, space } = useTheme();
  const soon = clubs
    .filter((c) => c.nextMeeting && new Date(c.nextMeeting).getTime() - now < 14 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.nextMeeting!.localeCompare(b.nextMeeting!));
  if (soon.length === 0) return null;
  return (
    <Section title={t('homeFeed.comingUp')}>
      {soon.map((c) => (
        <Link key={c.id} href={{ pathname: '/clubs/[id]', params: { id: c.id } }} asChild>
          {/* Link hands the Pressable a plain style, so no style function here. */}
          <Pressable
            accessibilityRole="link"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md + 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            {c.currentBook && <BookCover cover={c.currentBook.cover} title={c.currentBook.title} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '700' }}>{formatMeetingTime(c.nextMeeting!)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{[c.name, c.currentBook?.title].filter(Boolean).join(' · ')}</Text>
            </View>
          </Pressable>
        </Link>
      ))}
    </Section>
  );
}

/** What your clubs have been up to, newest first. */
function Feed({ clubs, readings, now }: { clubs: ClubSummary[]; readings: Reading[]; now: number }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const activity = useActivity();
  if (clubs.length === 0) {
    return (
      <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
          {t('homeFeed.together')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('homeFeed.togetherBody')}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label={t('home.createClub')} onPress={() => router.push('/clubs/new')} />
          <Button variant="secondary" label={t('home.joinClub')} onPress={() => router.push('/clubs/join')} />
        </View>
      </View>
    );
  }
  return (
    <Section title={t('homeFeed.inYourClubs')}>
      {activity.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : (activity.data ?? []).length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{t('homeFeed.quiet')}</Text>
      ) : (
        <View role="list" style={{ gap: space.xs }}>
          {activity.data!.map((item) => (
            <FeedRow key={item.id} item={item} readings={readings} now={now} />
          ))}
        </View>
      )}
    </Section>
  );
}

function FeedRow({ item, readings, now }: { item: ActivityItem; readings: Reading[]; now: number }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const name = item.person.name.trim().split(/\s+/)[0] ?? item.person.name;
  const mine = 'book' in item ? readings.find((r) => r.bookKey === item.book.bookKey && r.status === 'reading') : undefined;
  const viewer = mine ? { position: mine.position, editionId: mine.edition.id, startPage: mine.startPage, endPage: mine.endPage } : null;
  const open = () => (item.kind === 'note' && mine ? openReading(mine.id) : router.push({ pathname: '/clubs/[id]', params: { id: item.club.id } }));

  let headline: string;
  let detail: ReactNode = null;
  let badge: ReactNode = null;
  if (item.kind === 'progress') {
    headline = t('homeFeed.progress', { name, count: item.pages });
    detail = t('homeFeed.progressDetail', { percent: Math.round((item.position / POSITION_SCALE) * 100), title: item.book.title });
  } else if (item.kind === 'note') {
    headline = item.replyToYou ? t('homeFeed.reply', { name }) : t('homeFeed.note', { name, place: placeLabel(t, { position: item.position, page: null, editionId: '' }, viewer) });
    detail = item.ahead ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <EyeOff size={14} color={colors.textMuted} strokeWidth={2} />
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('homeFeed.noteAhead')}</Text>
      </View>
    ) : (
      <Text numberOfLines={3} style={{ fontFamily: fonts.reading, color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.45 }}>
        {item.body}
      </Text>
    );
    badge = <MessageCircle size={12} color="#FFFFFF" strokeWidth={2.5} />;
  } else if (item.kind === 'finished') {
    headline = t('homeFeed.finished', { name, title: item.book.title });
    badge = <BookCheck size={12} color="#FFFFFF" strokeWidth={2.5} />;
  } else {
    headline = t('homeFeed.joined', { name, club: item.club.name });
    badge = <UserPlus size={12} color="#FFFFFF" strokeWidth={2.5} />;
  }
  const meta = [item.club.name, noteTime(t, item.at, now)].join(' · ');

  return (
    <View role="listitem">
      <Pressable
        accessibilityRole="link"
        onPress={open}
        style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: pressed ? colors.surface : 'transparent' })}
      >
        <View>
          <Avatar id={item.person.id} name={item.person.name} image={item.person.image} size={40} />
          {badge && (
            <View aria-hidden style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
              {badge}
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.35, fontWeight: '600' }}>{headline}</Text>
          {typeof detail === 'string' ? <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{detail}</Text> : detail}
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{meta}</Text>
        </View>
        {'book' in item && <BookCover cover={item.book.cover} title={item.book.title} />}
      </Pressable>
    </View>
  );
}
