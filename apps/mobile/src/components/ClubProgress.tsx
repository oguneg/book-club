import { pacePoints, paceAt, pageToPosition, POSITION_SCALE, positionToPage, type ClubDetail, type MemberProgress } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { readingLine, percentLabel } from '@/readings/format';
import { ProgressBar } from '@/components/ProgressBar';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

// Identity comes from the row labels (names), never from color: clubs can have 50 members, far more than
// any palette separates. "You" is the accent; everyone else is muted ink; a tapped row highlights that
// member's line in the over-time chart.

type Book = NonNullable<ClubDetail['currentBook']>;

function pacePlan(book: Book) {
  const range = { startPage: 1, endPage: book.edition.pageCount ?? 1 };
  return {
    startDate: book.startDate,
    finishDate: book.finishDate,
    checkpoints: book.meetings
      .filter((m) => m.readToPage !== null)
      .map((m) => ({ at: m.startsAt, position: pageToPosition(m.readToPage!, range) })),
  };
}

export function ClubProgress({ book, members, myUserId }: { book: Book; members: MemberProgress[]; myUserId: string | undefined }) {
  const { t } = useTranslation();
  const { colors, fontSize, space, radius } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  // Captured once per visit; the pace moves by the day.
  const [now] = useState(() => Date.now());
  const plan = pacePlan(book);
  const pace = paceAt(now, plan);
  const pages = book.edition.pageCount ?? 0;

  // You first, then everyone by how far along they are.
  const sorted = [...members].sort(
    (a, b) => Number(b.userId === myUserId) - Number(a.userId === myUserId) || (b.reading?.position ?? -1) - (a.reading?.position ?? -1),
  );

  return (
    <View style={{ gap: space.md }}>
      <Hint>
        {pace === 0
          ? t('clubs.progress.paceStart')
          : pace !== null
          ? t('clubs.progress.pace', { page: positionToPage(pace, { startPage: 1, endPage: Math.max(pages, 2) }), percent: percentLabel(pace) })
          : t('clubs.progress.noPace')}
      </Hint>
      <View style={{ gap: space.xs }}>
        {sorted.map((m) => {
          const me = m.userId === myUserId;
          const line = m.reading ? readingLine(t, m.reading) : t('reading.notStarted');
          const name = me ? `${m.name} (${t('clubs.progress.you')})` : m.name;
          const isSelected = selected === m.userId;
          return (
            <Pressable
              key={m.userId}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${name}: ${line}`}
              onPress={() => setSelected(isSelected ? null : m.userId)}
              style={{ gap: 6, padding: space.sm, borderRadius: radius.md, backgroundColor: isSelected ? colors.background : 'transparent' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
                <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: me ? '700' : '500' }}>{name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{line}</Text>
              </View>
              <ProgressBar position={m.reading?.position ?? 0} marker={pace} emphasis={me || isSelected} />
            </Pressable>
          );
        })}
      </View>
      <OverTime book={book} members={members} myUserId={myUserId} selected={selected} now={now} />
    </View>
  );
}

const HEIGHT = 180;
const PAD = { left: 36, right: 8, top: 8, bottom: 22 };
const DAY = 86_400_000;

function OverTime({
  book,
  members,
  myUserId,
  selected,
  now,
}: {
  book: Book;
  members: MemberProgress[];
  myUserId: string | undefined;
  selected: string | null;
  now: number;
}) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const [width, setWidth] = useState(0);
  const started = members.filter((m) => m.reading && m.reading.history.length > 0);
  if (started.length === 0) return null;

  const t0 = Date.parse(`${book.startDate}T00:00:00Z`);
  const finish = book.finishDate ? Date.parse(`${book.finishDate}T00:00:00Z`) : 0;
  const pace = pacePoints(pacePlan(book));
  // Wide enough for today, the finish date and every meeting target, and at least a week.
  const t1 = Math.max(now, finish, t0 + 7 * DAY, ...pace.map((p) => p.t));
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (time: number) => PAD.left + ((time - t0) / (t1 - t0)) * plotW;
  const y = (position: number) => PAD.top + plotH - (position / POSITION_SCALE) * plotH;

  // Each member's line steps up at every log and runs flat to today (or to when they finished).
  const pathFor = (m: MemberProgress) => {
    const history = m.reading!.history;
    let d = `M ${x(t0)} ${y(0)}`;
    let last = 0;
    for (const h of history) {
      const hx = x(Math.max(Date.parse(h.at), t0));
      d += ` L ${hx} ${y(last)} L ${hx} ${y(h.position)}`;
      last = h.position;
    }
    const endT = m.reading!.status === 'finished' ? Date.parse(history[history.length - 1]!.at) : now;
    return `${d} L ${x(Math.max(endT, t0))} ${y(last)}`;
  };
  const pacePath = pace.length > 1 ? pace.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t)} ${y(p.position)}`).join(' ') : null;

  // Muted members first, then the highlighted ones on top.
  const order = [...started].sort((a, b) => rank(a) - rank(b));
  function rank(m: MemberProgress) {
    return m.userId === selected ? 2 : m.userId === myUserId ? 1 : 0;
  }

  return (
    <View style={{ gap: space.xs, marginTop: space.sm }}>
      <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>{t('clubs.progress.overTime')}</Text>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={t('clubs.progress.overTimeLabel', { count: started.length })}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {[0, 5000, 10000].map((p) => (
              <Line key={p} x1={PAD.left} x2={width - PAD.right} y1={y(p)} y2={y(p)} stroke={colors.border} strokeWidth={1} />
            ))}
            {[0, 50, 100].map((p) => (
              <SvgText key={p} x={PAD.left - 6} y={y(p * 100) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
                {`${p}%`}
              </SvgText>
            ))}
            <Line x1={x(now)} x2={x(now)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.border} strokeWidth={1} />
            {pacePath && <Path d={pacePath} stroke={colors.text} strokeWidth={1.5} strokeDasharray="5 4" fill="none" opacity={0.7} />}
            {order.map((m) => {
              const highlighted = m.userId === selected || (selected === null && m.userId === myUserId);
              return (
                <Path
                  key={m.userId}
                  d={pathFor(m)}
                  stroke={highlighted ? (m.userId === myUserId ? colors.accent : colors.text) : colors.textMuted}
                  strokeWidth={highlighted ? 2.5 : 1.5}
                  opacity={highlighted ? 1 : 0.45}
                  fill="none"
                  strokeLinejoin="round"
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }} aria-hidden>
        <Legend color={colors.accent} label={t('clubs.progress.youLegend')} />
        <Legend color={colors.textMuted} label={t('clubs.progress.othersLegend')} />
        <Legend color={colors.text} dashed label={t('clubs.progress.paceLegend')} />
      </View>
    </View>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 16, height: 0, borderTopWidth: 2, borderStyle: dashed ? 'dashed' : 'solid', borderColor: color }} />
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{label}</Text>
    </View>
  );
}
