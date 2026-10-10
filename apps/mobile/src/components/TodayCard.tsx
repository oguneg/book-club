import { STREAK_DAYS_PER_WEEK, weeklyStreak, type Reading } from '@bookclub/shared';
import { Flame } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useClubBooks } from '@/api/clubs';
import { useReadingGoals } from '@/api/goals';
import { useReadingStats } from '@/api/readings';
import { openReading } from '@/books/start';
import { calendarOf, localDay } from '@/readings/calendar';
import { pagesFromRabbit, rabbitAt, readingTarget } from '@/readings/targets';
import { BookCover } from '@/components/BookCover';
import { GoalsSheet } from '@/components/GoalsSheet';
import { PaceLines } from '@/components/Pace';
import { usePopIn } from '@/components/ui/motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/**
 * Today, at a glance: this week's reading days towards the streak, today's pages against your daily goal,
 * and for each book with a date to meet, the pages a day it takes and where you are against the rabbit.
 */
export function TodayCard({ readings }: { readings: readonly Reading[] }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const stats = useReadingStats().data;
  const goals = useReadingGoals().data;
  const clubBooks = useClubBooks(readings);
  const today = localDay(now);

  const streak = stats ? weeklyStreak(stats.readingDays, today) : null;
  const todayPages = stats ? calendarOf(stats, now).todayPages : 0;
  const read = new Set(stats?.readingDays ?? []);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const narrow = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

  const targets = readings
    .map((r) => {
      const club = clubBooks.get(r.bookKey) ?? null;
      const target = readingTarget(r, club, now);
      const rabbit = rabbitAt(r, club, now);
      return { reading: r, target, rabbitPages: rabbit === null ? null : pagesFromRabbit(r.position, rabbit, r) };
    })
    .filter((x) => x.target || x.rabbitPages !== null)
    .sort((a, b) => (a.target?.by ?? '9999').localeCompare(b.target?.by ?? '9999'))
    .slice(0, 3);

  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: space.md };

  return (
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      {streak && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <StreakFlame lit={streak.weeks > 0} />
            <Text style={{ flex: 1, fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>
              {streak.weeks > 0 ? t('today.streak', { count: streak.weeks }) : t('today.streakStart', { days: STREAK_DAYS_PER_WEEK })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>
              {streak.thisWeekCounts
                ? t('today.weekDone', { count: streak.daysThisWeek })
                : t('today.weekDays', { done: streak.daysThisWeek, need: STREAK_DAYS_PER_WEEK })}
            </Text>
            {/* This week, Monday to Sunday: a filled dot for each day you read. */}
            <View
              role="img"
              aria-label={t('today.weekLabel', { days: week.filter((d) => read.has(localDay(d))).map((d) => long.format(d)).join(', ') || t('today.noDays') })}
              style={{ flexDirection: 'row', gap: 6 }}
            >
              {week.map((d, i) => {
                const day = localDay(d);
                const isToday = day === today;
                return (
                  <View key={day} style={{ alignItems: 'center', gap: 3 }}>
                    <DayDot read={read.has(day)} today={isToday} order={i} />
                    <Text style={{ color: isToday ? colors.text : colors.textMuted, fontSize: 10, fontWeight: isToday ? '700' : '400' }}>{narrow.format(d)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      <View style={[divider, { gap: space.xs }]}>
        {goals?.dailyPages ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {todayPages >= goals.dailyPages ? t('today.goalDone', { done: todayPages, goal: goals.dailyPages }) : t('today.goalProgress', { done: todayPages, goal: goals.dailyPages })}
              </Text>
              <TextButton tone="muted" label={t('goals.edit')} onPress={() => setEditing(true)} />
            </View>
            <ProgressBar value={todayPages / goals.dailyPages} height={6} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Text style={{ flex: 1, color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>{t('today.pagesToday', { count: todayPages })}</Text>
            <TextButton label={t('today.setDailyGoal')} onPress={() => setEditing(true)} />
          </View>
        )}
      </View>

      {targets.map(({ reading, target, rabbitPages }) => (
        <Pressable
          key={reading.id}
          accessibilityRole="link"
          accessibilityLabel={reading.edition.title}
          onPress={() => openReading(reading.id)}
          style={({ pressed }) => [divider, { flexDirection: 'row', gap: space.md, opacity: pressed ? 0.7 : 1 }]}
        >
          <BookCover cover={reading.edition.cover} title={reading.edition.title} size="sm" />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>
              {reading.edition.title}
            </Text>
            <PaceLines target={target} rabbitPages={rabbitPages} />
          </View>
        </Pressable>
      ))}

      <GoalsSheet visible={editing} onClose={() => setEditing(false)} />
    </View>
  );
}

/** The streak's flame: lit in the accent once a week counts. Playful's wobbles into place. */
function StreakFlame({ lit }: { lit: boolean }) {
  const { colors, style } = useTheme();
  const pop = usePopIn(lit && style === 'playful', 150);
  return (
    <Animated.View
      style={{
        transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-24deg', '12deg', '0deg'] }) }],
      }}
    >
      <Flame size={20} color={lit ? colors.accent : colors.textMuted} strokeWidth={style === 'playful' && lit ? 2.25 : 1.75} aria-hidden />
    </Animated.View>
  );
}

/** A day this week: filled if you read, ringed if it's today. Playful's filled days pop in, one after another. */
function DayDot({ read, today, order }: { read: boolean; today: boolean; order: number }) {
  const { colors, style } = useTheme();
  const pop = usePopIn(read && style === 'playful', 250 + order * 70);
  return (
    <Animated.View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: read ? colors.accent : 'transparent',
        borderWidth: read ? 0 : today ? 1.5 : 1,
        borderColor: today ? colors.accent : colors.control,
        transform: [{ scale: pop }],
      }}
    />
  );
}
