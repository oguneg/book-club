import { STREAK_DAYS_PER_WEEK, weeklyStreak } from '@bookclub/shared';
import { Flame } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useReadingGoals } from '@/api/goals';
import { useReadingStats } from '@/api/readings';
import { calendarOf, localDay } from '@/readings/calendar';
import { GoalsSheet } from '@/components/GoalsSheet';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/**
 * Your goals and streak on the You tab: the weekly streak, books this year against your yearly goal, and
 * today's pages against your daily one. Goals are optional; without one, the plain count shows.
 */
export function GoalsSummary() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const goals = useReadingGoals().data;
  const stats = useReadingStats().data;
  const year = now.getFullYear();
  const streak = stats ? weeklyStreak(stats.readingDays, localDay(now)) : null;
  const books = stats?.finishedThisYear.length ?? 0;
  const todayPages = stats ? calendarOf(stats, now).todayPages : 0;
  const hasGoals = Boolean(goals?.yearlyBooks || goals?.dailyPages);
  const line = { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' as const, fontVariant: ['tabular-nums' as const] };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {t('goals.title')}
        </Text>
        <TextButton label={hasGoals ? t('goals.edit') : t('goals.set')} onPress={() => setEditing(true)} />
      </View>

      {streak && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Flame size={18} color={streak.weeks > 0 ? colors.accent : colors.textMuted} strokeWidth={1.75} aria-hidden />
          <Text style={[line, { flex: 1 }]}>
            {streak.weeks > 0 ? t('today.streak', { count: streak.weeks }) : t('today.streakStart', { days: STREAK_DAYS_PER_WEEK })}
            <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
              {` · ${streak.thisWeekCounts ? t('today.weekDone', { count: streak.daysThisWeek }) : t('today.weekDays', { done: streak.daysThisWeek, need: STREAK_DAYS_PER_WEEK })}`}
            </Text>
          </Text>
        </View>
      )}

      <View style={{ gap: space.xs }}>
        <Text style={line}>{goals?.yearlyBooks ? t('goals.yearProgress', { done: books, goal: goals.yearlyBooks, year }) : t('goals.yearCount', { count: books, year })}</Text>
        {goals?.yearlyBooks ? <ProgressBar value={books / goals.yearlyBooks} height={6} /> : null}
      </View>
      <View style={{ gap: space.xs }}>
        <Text style={line}>
          {goals?.dailyPages
            ? todayPages >= goals.dailyPages
              ? t('today.goalDone', { done: todayPages, goal: goals.dailyPages })
              : t('today.goalProgress', { done: todayPages, goal: goals.dailyPages })
            : t('today.pagesToday', { count: todayPages })}
        </Text>
        {goals?.dailyPages ? <ProgressBar value={todayPages / goals.dailyPages} height={6} /> : null}
      </View>

      <GoalsSheet visible={editing} onClose={() => setEditing(false)} />
    </View>
  );
}
