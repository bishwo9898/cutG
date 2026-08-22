import { Linking, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  useConnectStripe,
  usePaymentPreferences,
  useStripeStatus,
  useUpdatePaymentPreferences,
} from '@/hooks/usePayments';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';
import { useState } from 'react';

export default function OnlinePaymentsScreen(): React.ReactElement {
  const preferences = usePaymentPreferences();
  const account = useStripeStatus();
  const update = useUpdatePaymentPreferences();
  const connect = useConnectStripe();
  const [message, setMessage] = useState<string | null>(null);
  const enabled = preferences.data?.onlinePaymentsEnabled ?? true;
  const ready = preferences.data?.onlinePaymentsReady === true;

  const beginSetup = async (): Promise<void> => {
    try {
      const result = await connect.mutateAsync();
      if (result.onboardingUrl !== undefined) await Linking.openURL(result.onboardingUrl);
      else await account.refetch();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <Screen refreshing={preferences.isFetching} onRefresh={() => void preferences.refetch()}>
      <ScreenHeader
        showBack
        title="Online payments"
        subtitle="Offer a secure card option while keeping pay in person available."
      />
      <Badge
        label={ready ? 'Online payments ready' : 'Payout setup needed'}
        tone={ready ? 'success' : 'warning'}
      />
      <Card style={styles.preference}>
        <View style={styles.copy}>
          <Text style={styles.title}>Let customers pay online</Text>
          <Text style={styles.body}>
            This preference is on by default. You can turn it off without changing existing paid
            bookings.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Let customers pay online"
          disabled={update.isPending}
          onValueChange={(value) => void update.mutateAsync(value)}
          trackColor={{ false: colors.border, true: colors.statusConfirmedSurface }}
          thumbColor={enabled ? colors.success : colors.textMuted}
          value={enabled}
        />
      </Card>
      <Card style={styles.card}>
        <Text style={styles.title}>Secure payout setup</Text>
        <Text style={styles.body}>
          Complete identity and bank details with our payment partner. Sensitive financial details
          are never stored by cutG.
        </Text>
        <View style={styles.checks}>
          <Badge
            label={
              account.data?.onboardingComplete === true ? 'Identity complete' : 'Identity needed'
            }
            tone={account.data?.onboardingComplete === true ? 'success' : 'warning'}
          />
          <Badge
            label={account.data?.payoutsEnabled === true ? 'Payouts enabled' : 'Payouts pending'}
            tone={account.data?.payoutsEnabled === true ? 'success' : 'warning'}
          />
        </View>
        {!ready ? (
          <Button
            loading={connect.isPending}
            title="Complete payout setup"
            onPress={() => void beginSetup()}
          />
        ) : null}
      </Card>
      {message !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 21 },
  card: { gap: spacing.md },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  copy: { flex: 1, gap: spacing.xs },
  error: { ...typography.bodySmall, color: colors.error },
  preference: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
});
