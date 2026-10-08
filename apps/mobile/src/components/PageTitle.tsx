import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

/**
 * The browser tab title ("Sign in · Bookclub"); on phones it does nothing. Set when the page gains
 * focus: earlier pages stay mounted in the stack, so a declarative <title> from them could win.
 */
export function PageTitle({ title }: { title?: string }) {
  const { t } = useTranslation();
  const full = title ? `${title} · ${t('appName')}` : t('appName');
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') document.title = full;
    }, [full]),
  );
  return null;
}
