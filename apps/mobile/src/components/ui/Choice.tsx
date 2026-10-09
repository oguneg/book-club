import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** One-of-a-few picker as a wrapping row of chips: tabs that filter a list, or radios in a form. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
  kind = 'radio',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  label: string;
  kind?: 'radio' | 'tab';
}) {
  const { colors, fontSize, radius, space, minTouch } = useTheme();
  return (
    <View
      accessibilityRole={kind === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole={kind}
            accessibilityState={{ selected, checked: kind === 'radio' ? selected : undefined }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              minHeight: minTouch - 8,
              paddingHorizontal: space.md,
              justifyContent: 'center',
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.background : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: selected ? colors.text : colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
