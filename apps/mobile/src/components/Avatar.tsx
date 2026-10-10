import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/theme';

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

/** The same colour for the same person, everywhere. */
function hueIndex(id: string, count: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % count;
}

/**
 * A person: their photo (from Google, when they signed in with it), otherwise their initials on their own
 * steady colour, so faces are told apart at a glance. "You" are bookcloth red. Decorative: the name is
 * always written next to it or in the surrounding label.
 */
export function Avatar({ id, name, image, size = 34, me = false }: { id: string; name: string; image?: string | null; size?: number; me?: boolean }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const bg = me ? colors.accent : colors.people[hueIndex(id, colors.people.length)]!;
  return (
    <View aria-hidden style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {image && !failed ? (
        <Image source={{ uri: image }} style={{ width: size, height: size }} contentFit="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={{ color: me ? colors.onAccent : '#FFFFFF', fontSize: Math.max(11, Math.round(size * 0.36)), fontWeight: '700', letterSpacing: 0.3 }}>{initials(name)}</Text>
      )}
    </View>
  );
}
