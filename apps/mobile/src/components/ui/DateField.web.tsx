import { createElement, useId, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/theme';

interface Props {
  label: string;
  /** YYYY-MM-DD (or HH:MM for kind="time"); empty string for none. */
  value: string;
  onChange: (value: string) => void;
  kind?: 'date' | 'time';
  hint?: string;
  error?: string;
}

/** The browser's own date/time input: native pickers, keyboard entry and locale formats for free. */
export function DateField({ label, value, onChange, kind = 'date', hint, error }: Props) {
  const { colors, fontSize, radius, space, minTouch, scheme } = useTheme();
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {createElement('label', { htmlFor: id, style: { color: colors.text, fontSize: fontSize.sm, fontWeight: 600, fontFamily: 'inherit' } }, label)}
      {createElement('input', {
        id,
        type: kind,
        value,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        'aria-invalid': Boolean(error),
        style: {
          minHeight: minTouch,
          boxSizing: 'border-box',
          padding: `0 ${space.md}px`,
          fontSize: fontSize.md,
          fontFamily: 'inherit',
          color: colors.text,
          backgroundColor: colors.surface,
          border: `1px solid ${error ? colors.danger : focused ? colors.accent : colors.control}`,
          boxShadow: focused ? `0 0 0 1px ${error ? colors.danger : colors.accent}` : 'none',
          borderRadius: radius.md,
          outline: 'none',
          colorScheme: scheme,
        },
      })}
      {(error || hint) && (
        <Text accessibilityLiveRegion={error ? 'polite' : 'none'} style={{ color: error ? colors.danger : colors.textMuted, fontSize: fontSize.sm }}>
          {error || hint}
        </Text>
      )}
    </View>
  );
}
