import { Platform, Switch, Text, View, type SwitchProps } from 'react-native';
import { useTheme } from '@/theme';

/** A setting you switch on or off: its name, a line on what it does, and the switch (the whole row's name). */
export function Toggle({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors, fontSize, space, minTouch } = useTheme();
  // react-native-web paints the "on" thumb separately (teal unless told).
  const webThumb = Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as unknown as Partial<SwitchProps>) : {};
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: minTouch, paddingVertical: space.xs }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>{label}</Text>
        {detail && <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 }}>{detail}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={detail}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.control }}
        thumbColor={colors.surface}
        {...webThumb}
      />
    </View>
  );
}
