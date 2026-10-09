import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** Two to four choices side by side, one selected: the club page's tabs, or who a note is for. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  kind = 'tab',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  kind?: 'tab' | 'radio';
}) {
  const { colors, fontSize, radius, minTouch } = useTheme();
  return (
    <View
      accessibilityRole={kind === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.md + 2, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole={kind}
            aria-selected={kind === 'tab' ? selected : undefined}
            aria-checked={kind === 'radio' ? selected : undefined}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: minTouch - 8,
              paddingHorizontal: 8,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.surface : 'transparent',
              borderWidth: 1,
              borderColor: selected ? colors.control : 'transparent',
              boxShadow: selected ? '0px 1px 2px rgba(0,0,0,0.12)' : undefined,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text numberOfLines={1} style={{ color: selected ? colors.text : colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
