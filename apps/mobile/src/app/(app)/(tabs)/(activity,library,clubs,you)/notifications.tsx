import type { NotificationItem } from '@bookclub/shared';
import type { TFunction } from 'i18next';
import { router, Stack, type Href } from 'expo-router';
import { BookCheck, BookOpen, CalendarClock, MessageCircle, Reply, Settings, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useMarkRead, useNotifications } from '@/api/notifications';
import { formatMeetingTime } from '@/clubs/format';
import { noteTime } from '@/notes/format';
import { Avatar } from '@/components/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { PushPrompt } from '@/components/PushPrompt';
import { Screen } from '@/components/Screen';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

const ICON: Record<NotificationItem['kind'], LucideIcon> = {
  reply: Reply,
  notes: MessageCircle,
  'meeting-soon': CalendarClock,
  'meeting-set': CalendarClock,
  finished: BookCheck,
  'book-chosen': BookOpen,
  joined: UserPlus,
};

/** What a notification says: one line on what happened, one on where (never a word of anyone's note). */
function describe(t: TFunction, n: NotificationItem): { title: string; detail: string } {
  const name = n.person?.name ?? '';
  const book = n.book?.title ?? '';
  const club = n.club?.name ?? null;
  const when = n.meeting ? formatMeetingTime(n.meeting.startsAt) : '';
  const readTo = n.meeting?.readToPage ? t('notifications.readTo', { page: n.meeting.readToPage }) : null;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ');
  switch (n.kind) {
    case 'reply':
      return { title: n.page ? t('notifications.kinds.replyPage', { name, page: n.page }) : t('notifications.kinds.reply', { name }), detail: join(book, club) };
    case 'notes':
      return { title: t('notifications.kinds.notes', { count: n.count, name }), detail: join(book, club) };
    case 'meeting-soon':
      return { title: t('notifications.kinds.meetingSoon', { club: club ?? '', when }), detail: join(n.meeting?.title ?? null, readTo) };
    case 'meeting-set':
      return { title: n.meeting?.moved ? t('notifications.kinds.meetingMoved', { when }) : t('notifications.kinds.meetingSet', { when }), detail: join(n.meeting?.title ?? null, readTo, club) };
    case 'finished':
      return { title: t('notifications.kinds.finished', { name, book }), detail: join(club) };
    case 'book-chosen':
      return { title: t('notifications.kinds.bookChosen', { name, book }), detail: join(club) };
    case 'joined':
      return { title: t('notifications.kinds.joined', { name }), detail: join(club) };
  }
}

/**
 * Your notifications, newest first. Opening the page reads them all (the bell and the app icon clear), but
 * the ones that were new keep their dot until you leave. A tap opens what it's about.
 */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const query = useNotifications();
  const markRead = useMarkRead();
  const [now] = useState(() => Date.now());
  // What was new when you came in.
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  if (fresh === null && query.data) setFresh(new Set(query.data.items.filter((n) => !n.read).map((n) => n.id)));
  useEffect(() => {
    if (fresh && fresh.size > 0) void markRead().catch(() => {});
  }, [fresh, markRead]);

  const items = query.data?.items ?? [];
  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <IconButton icon={Settings} label={t('notifications.settings')} tone="accent" onPress={() => router.push('/notification-settings')} /> }} />
      <PageTitle title={t('notifications.title')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text, marginBottom: space.lg }}>
        {t('notifications.title')}
      </Text>
      <View style={{ gap: space.lg }}>
        <PushPrompt />
        {query.isPending && <ActivityIndicator color={colors.accent} />}
        {query.isError && <Notice message={t('notifications.loadFailed')} />}
        {query.isSuccess && items.length === 0 && <Hint>{t('notifications.empty')}</Hint>}
        {items.length > 0 && (
          <View role="list" style={{ gap: space.xs }}>
            {items.map((n) => (
              <Row key={n.id} item={n} isNew={fresh?.has(n.id) ?? !n.read} now={now} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function Row({ item, isNew, now }: { item: NotificationItem; isNew: boolean; now: number }) {
  const { t } = useTranslation();
  const { colors, fontSize, radius, space } = useTheme();
  const { title, detail } = describe(t, item);
  const Icon = ICON[item.kind];
  const when = noteTime(t, item.at, now);
  return (
    <View role="listitem">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={[isNew ? t('notifications.new') : null, title, detail, when].filter(Boolean).join('. ')}
        disabled={!item.url}
        onPress={() => item.url && router.push(item.url as Href)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingVertical: space.sm,
          paddingHorizontal: space.sm,
          marginHorizontal: -space.sm,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.surface : 'transparent',
        })}
      >
        <View>
          {item.person ? (
            <Avatar id={item.person.id} name={item.person.name} image={item.person.image} size={40} />
          ) : (
            <View aria-hidden style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={colors.accent} strokeWidth={1.75} />
            </View>
          )}
          {item.person && (
            <View
              aria-hidden
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: colors.background,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={11} color={colors.onAccent} strokeWidth={2.25} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.35, fontWeight: isNew ? '700' : '400' }}>{title}</Text>
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {[detail, when].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {isNew && <View aria-hidden style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />}
      </Pressable>
    </View>
  );
}
