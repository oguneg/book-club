import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useReadings } from '@/api/readings';
import { takePendingInvite } from '@/clubs/pendingInvite';
import { BookCover } from '@/components/BookCover';
import { PageTitle } from '@/components/PageTitle';
import { ReadingView } from '@/components/ReadingView';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

/** The Reading tab: the book you touched last, or one question: what are you reading? */
export default function ReadingTab() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const readings = useReadings();
  const current = (readings.data ?? []).filter((r) => r.status === 'reading').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [picked, setPicked] = useState<string | null>(null);
  const selected = current.find((r) => r.id === picked) ?? current[0];

  // Back from signing in (or confirming an email) with an invite still open: continue joining.
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/join/[code]', params: { code } });
  }, []);

  if (readings.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (readings.isError) {
    return (
      <Screen>
        <Notice message={t('auth.errors.network')} />
      </Screen>
    );
  }
  if (!selected) return <WhatAreYouReading />;
  return (
    <ReadingView
      key={selected.id}
      readingId={selected.id}
      top={current.length > 1 ? <Switcher books={current} selected={selected.id} onSelect={setPicked} /> : undefined}
    />
  );
}

/** Several books on the go: their covers, to switch between them. */
function Switcher({ books, selected, onSelect }: { books: { id: string; edition: { title: string; cover: string | null } }[]; selected: string; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" aria-label={t('reading.switcher')} contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
      {books.map((b) => {
        const on = b.id === selected;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="tab"
            accessibilityLabel={b.edition.title}
            aria-selected={on}
            onPress={() => onSelect(b.id)}
            style={{ padding: 3, borderRadius: radius.sm + 3, borderWidth: 2, borderColor: on ? colors.accent : 'transparent' }}
          >
            <BookCover cover={b.edition.cover} title={b.edition.title} size="sm" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Nothing open yet: the one question that gets you going. */
function WhatAreYouReading() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const [q, setQ] = useState('');
  const go = () => router.push({ pathname: '/books', params: { pick: 'read', ...(q.trim() ? { q: q.trim() } : {}) } });
  return (
    <Screen width="narrow">
      <PageTitle title={t('tabs.reading')} />
      <View style={{ gap: space.lg, paddingTop: space.xxl }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.15, color: colors.text }}>
          {t('reading.empty.title')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('reading.empty.body')}</Text>
        <TextField label={t('books.searchLabel')} value={q} onChangeText={setQ} inputMode="search" returnKeyType="search" onSubmitEditing={go} autoCorrect={false} />
        <Button label={t('reading.empty.find')} icon={<Search size={18} color={colors.onAccent} />} onPress={go} />
        <View style={{ alignItems: 'center', marginTop: space.md }}>
          <TextLink href="/clubs/join" label={t('reading.empty.invite')} />
        </View>
      </View>
    </Screen>
  );
}
