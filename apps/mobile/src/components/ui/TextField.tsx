import { useId, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  error?: string;
  hint?: string;
  /** A password field with a show/hide toggle. */
  password?: boolean;
  ref?: Ref<TextInput>;
}

export function TextField({ label, error, hint, password = false, ref, ...input }: TextFieldProps) {
  const { colors, fontSize, radius, space, minTouch } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const describedBy = useId();

  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
      <View
        style={[
          styles.box,
          { borderColor, borderRadius: radius.md, backgroundColor: colors.surface, minHeight: minTouch },
          // A ring instead of a thicker border, so focusing doesn't shift the layout.
          focused && { boxShadow: `0 0 0 1px ${error ? colors.danger : colors.accent}` },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? describedBy : undefined}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={password && !revealed}
          autoCapitalize={password ? 'none' : input.autoCapitalize}
          autoCorrect={password ? false : input.autoCorrect}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text, fontSize: fontSize.md, paddingHorizontal: space.md }]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            onPress={() => setRevealed((r) => !r)}
            hitSlop={8}
            style={[styles.toggle, { paddingHorizontal: space.md, minHeight: minTouch }]}
          >
            <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '600' }}>
              {revealed ? t('common.hide') : t('common.show')}
            </Text>
          </Pressable>
        )}
      </View>
      {(error || hint) && (
        <Text
          nativeID={describedBy}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={{ color: error ? colors.danger : colors.textMuted, fontSize: fontSize.sm }}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  // The box draws the focus state; the browser's own outline would double it.
  input: { flex: 1, alignSelf: 'stretch', outlineStyle: 'none' } as object,
  toggle: { justifyContent: 'center' },
});
