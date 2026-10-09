import { router, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** Back to wherever you came from; to `fallback` when this page was opened directly (a shared link). */
export function BackButton({ label, fallback }: { label: string; fallback: Href }) {
  const { colors, fontSize, minTouch } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={8}
      style={({ pressed }) => ({ minHeight: minTouch, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -4 }}>
        <ChevronLeft size={22} color={colors.accent} strokeWidth={2} />
        <Text style={{ color: colors.accent, fontSize: fontSize.md, fontWeight: '600' }}>{label}</Text>
      </View>
    </Pressable>
  );
}
