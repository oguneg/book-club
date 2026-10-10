import { POSITION_SCALE } from '@bookclub/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { RabbitMark } from '@/components/Pace';
import { useTheme } from '@/theme';

const FACE = 30;
const LIFT = 14;
/** Faces closer than this (in pixels) stack into one with a count. */
const MIN_GAP = 26;

export interface TrackMember {
  userId: string;
  name: string;
  image: string | null;
  /** 0..10000, or null when they haven't started. */
  position: number | null;
  me: boolean;
}

/**
 * The club on one line, first page to last: everyone's face where they are, you ringed in bookcloth, the
 * rabbit where the club should be today, and a tick at each meeting's "read up to". A picture of what the
 * list under it says in words, so it's hidden from screen readers.
 */
export function ClubTrack({ members, rabbit, checkpoints }: { members: TrackMember[]; rabbit: number | null; checkpoints: number[] }) {
  const { colors, space } = useTheme();
  const [width, setWidth] = useState(0);
  const lineWidth = width || 320;
  const lineY = FACE + LIFT + 6;
  const x = (position: number) => (Math.max(0, Math.min(POSITION_SCALE, position)) / POSITION_SCALE) * lineWidth;

  // Group faces that would overlap; you're drawn last so your face is on top.
  const placed = members.filter((m) => m.position !== null).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const groups: { x: number; people: TrackMember[] }[] = [];
  for (const m of placed) {
    const at = x(m.position ?? 0);
    const last = groups[groups.length - 1];
    if (last && at - last.x < MIN_GAP) last.people.push(m);
    else groups.push({ x: at, people: [m] });
  }

  return (
    <View aria-hidden onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: lineY + 22, marginTop: space.sm }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: lineY, height: 2, borderRadius: 1, backgroundColor: colors.control, opacity: 0.5 }} />
      {checkpoints.map((c, i) => (
        <View key={i} style={{ position: 'absolute', left: x(c) - 1, top: lineY - 4, width: 2, height: 10, borderRadius: 1, backgroundColor: colors.control }} />
      ))}
      {groups.map((g) => {
        const me = g.people.find((p) => p.me);
        const face = me ?? g.people[g.people.length - 1]!;
        return (
          <View key={face.userId} style={{ position: 'absolute', left: g.x - FACE / 2, top: 0, width: FACE, alignItems: 'center' }}>
            <View style={{ width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: 2, borderColor: me ? colors.accent : colors.background, backgroundColor: colors.background }}>
              <Avatar id={face.userId} name={face.name} image={face.image} me={face.me} size={FACE - 4} />
            </View>
            {g.people.length > 1 && (
              <View style={{ position: 'absolute', right: -6, top: -4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{g.people.length}</Text>
              </View>
            )}
            <View style={{ width: 1, height: LIFT + 6, backgroundColor: me ? colors.accent : colors.control }} />
          </View>
        );
      })}
      {rabbit !== null && (
        <View style={{ position: 'absolute', left: x(rabbit) - 11, top: lineY - 10 }}>
          <RabbitMark />
        </View>
      )}
    </View>
  );
}
