import { formatInviteCode, type ClubDetail } from '@bookclub/shared';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { appUrl } from '@/auth/client';
import { Button } from '@/components/ui/Button';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

/** The way in for friends: the link to send, and the code to read out. */
export function InviteBody({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const [copied, setCopied] = useState(false);
  const link = appUrl(`/join/${formatInviteCode(club.inviteCode)}`);
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('clubs.invite.sheetBody')}</Text>
      <Button
        label={copied ? t('clubs.club.copied') : t('clubs.club.copyLink')}
        onPress={async () => {
          await Clipboard.setStringAsync(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      />
      <Text selectable style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
        {link}
      </Text>
      <View style={{ alignItems: 'center', gap: 2, marginTop: space.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('clubs.invite.orCode')}</Text>
        <Text selectable style={{ color: colors.text, fontFamily: fonts.headingBold, fontSize: fontSize.xl, letterSpacing: 2 }}>
          {formatInviteCode(club.inviteCode)}
        </Text>
      </View>
      <Hint>{t('clubs.club.inviteBody', { count: club.members.length, cap: club.memberCap })}</Hint>
    </View>
  );
}
