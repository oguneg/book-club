import { router } from 'expo-router';
import { KeyRound, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClubs } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { formatMeetingTime } from '@/clubs/format';
import { BookCover } from '@/components/BookCover';
import { Mascot } from '@/components/Mascot';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { NavRow } from '@/components/ui/NavRow';
import { Notice } from '@/components/ui/Notice';
import { useTheme } from '@/theme';

/** Your clubs, and the two ways into a new one. */
export default function ClubsTab() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const clubs = useClubs();
  const none = clubs.data?.length === 0;

  return (
    <Screen>
      <PageTitle title={t('tabs.clubs')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text, marginBottom: space.lg }}>
        {t('tabs.clubs')}
      </Text>
      {clubs.isPending && <ActivityIndicator color={colors.accent} />}
      {clubs.isError && <Notice message={clubErrorMessage(t, clubs.error)} />}
      {none && <Mascot pose="waving" style={{ marginBottom: space.lg }} />}
      {none && <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, marginBottom: space.lg }}>{t('clubs.tab.empty')}</Text>}
      <View style={{ gap: space.sm }}>
        {clubs.data?.map((club) => (
          <NavRow
            key={club.id}
            href={{ pathname: '/clubs/[id]', params: { id: club.id } }}
            leading={<BookCover cover={club.currentBook?.cover ?? null} title={club.currentBook?.title ?? club.name} size="sm" />}
            title={club.name}
            detail={[
              club.currentBook ? club.currentBook.title : t('home.noBookYet'),
              club.nextMeeting ? t('home.nextMeeting', { when: formatMeetingTime(club.nextMeeting) }) : t('home.members', { count: club.memberCount }),
            ].join(' · ')}
          />
        ))}
      </View>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Button variant={none ? 'primary' : 'secondary'} label={t('home.createClub')} icon={<Plus size={18} color={none ? colors.onAccent : colors.text} />} onPress={() => router.push('/clubs/new')} />
        <Button variant="secondary" label={t('home.joinClub')} icon={<KeyRound size={18} color={colors.text} />} onPress={() => router.push('/clubs/join')} />
      </View>
    </Screen>
  );
}
