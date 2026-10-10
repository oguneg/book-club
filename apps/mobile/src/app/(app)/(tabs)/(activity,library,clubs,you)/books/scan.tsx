import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Flashlight, FlashlightOff, ScanBarcode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { lookupIsbn } from '@/api/books';
import { ApiError } from '@/api/client';
import { isbnFromBarcode } from '@/books/barcode';
import { bookErrorMessage } from '@/books/errors';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

type Phase = { kind: 'scanning' } | { kind: 'looking'; isbn: string } | { kind: 'notFound'; isbn: string } | { kind: 'failed'; message: string };

/**
 * Scan the barcode on the back of a book (phones). The camera runs only while this screen is open; a book's
 * barcode opens that edition, ready to start. The torch helps in bed; anything else on the shelf is ignored.
 */
export default function ScanBook() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [torch, setTorch] = useState(false);
  const [notABook, setNotABook] = useState(false);
  // The camera reports the same code many times a second; only the first one counts.
  const handling = useRef(false);

  useEffect(() => {
    if (!notABook) return;
    const timer = setTimeout(() => setNotABook(false), 2500);
    return () => clearTimeout(timer);
  }, [notABook]);

  if (Platform.OS === 'web') return <Redirect href={{ pathname: '/books', params: pick ? { pick } : {} }} />;

  async function scanned({ data }: BarcodeScanningResult) {
    if (handling.current) return;
    const isbn = isbnFromBarcode(data);
    if (!isbn) {
      setNotABook(true);
      return;
    }
    handling.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase({ kind: 'looking', isbn });
    try {
      const edition = await lookupIsbn(isbn);
      router.replace({ pathname: '/books/edition/[id]', params: { id: edition.id, ...(pick ? { pick } : {}) } });
    } catch (err) {
      setPhase(err instanceof ApiError && err.status === 404 ? { kind: 'notFound', isbn } : { kind: 'failed', message: bookErrorMessage(t, err) });
    }
  }

  function scanAgain() {
    handling.current = false;
    setPhase({ kind: 'scanning' });
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (!permission.granted) {
    return (
      <Screen>
        <PageTitle title={t('scan.title')} />
        <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxl }}>
          <ScanBarcode size={48} color={colors.accent} strokeWidth={1.5} />
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text, textAlign: 'center' }}>
            {t('scan.title')}
          </Text>
          <Text style={{ fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.textMuted, textAlign: 'center', maxWidth: 360 }}>
            {permission.canAskAgain ? t('scan.ask') : t('scan.denied')}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            {permission.canAskAgain ? (
              <Button label={t('scan.allow')} onPress={() => void requestPermission()} />
            ) : (
              <Button label={t('scan.openSettings')} onPress={() => void Linking.openSettings()} />
            )}
            <View style={{ alignItems: 'center' }}>
              <TextButton label={t('scan.typeInstead')} onPress={() => router.back()} />
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  const card = { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <PageTitle title={t('scan.title')} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={phase.kind === 'scanning' ? (result) => void scanned(result) : undefined}
      />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg }]} pointerEvents="box-none">
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: '#fff', fontSize: fontSize.md, fontWeight: '600', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, overflow: 'hidden' }}
        >
          {notABook ? t('scan.notABook') : t('scan.point')}
        </Text>
        {/* Where the barcode goes: a wide frame, about the shape of one. */}
        <View aria-hidden style={{ width: '82%', maxWidth: 360, aspectRatio: 2.1, borderWidth: 3, borderColor: notABook ? colors.danger : '#fff', borderRadius: radius.lg }} />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, gap: space.md }} pointerEvents="box-none">
        {phase.kind === 'scanning' ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={t('scan.torch')}
              accessibilityState={{ checked: torch }}
              aria-checked={torch}
              onPress={() => setTorch((on) => !on)}
              style={({ pressed }) => ({
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: torch ? '#fff' : 'rgba(0,0,0,0.55)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {torch ? <Flashlight size={24} color="#000" strokeWidth={1.75} /> : <FlashlightOff size={24} color="#fff" strokeWidth={1.75} />}
            </Pressable>
          </View>
        ) : phase.kind === 'looking' ? (
          <View style={[card, { flexDirection: 'row', alignItems: 'center' }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.md }}>{t('scan.looking', { isbn: phase.isbn })}</Text>
          </View>
        ) : (
          <View style={card} role="alert">
            <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>
              {phase.kind === 'notFound' ? t('scan.notFound', { isbn: phase.isbn }) : phase.message}
            </Text>
            {phase.kind === 'notFound' && (
              <Button label={t('books.addManually')} onPress={() => router.replace({ pathname: '/books/new', params: { isbn: phase.isbn, ...(pick ? { pick } : {}) } })} />
            )}
            <Button variant="secondary" label={t('scan.again')} onPress={scanAgain} />
          </View>
        )}
      </View>
    </View>
  );
}
