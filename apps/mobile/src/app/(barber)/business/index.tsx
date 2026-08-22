import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useBarberProfilePrivate, useBarberServicesPrivate } from '@/hooks/useBarberDashboard';
import { useEarnings, useStripeStatus, useSubscription } from '@/hooks/usePayments';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';
import { mobileFeatures } from '@/lib/features';

type HubCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

const HubCard = ({ title, subtitle, onPress }: HubCardProps): React.ReactElement => (
  <Card>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.meta}>{subtitle}</Text>
    <Button title="Open" onPress={onPress} variant="secondary" />
  </Card>
);

export default function BusinessHubScreen(): React.ReactElement {
  const profile = useBarberProfilePrivate();
  const services = useBarberServicesPrivate();
  const earnings = useEarnings('month', mobileFeatures.earnings);
  const subscription = useSubscription(mobileFeatures.subscriptions);
  const stripe = useStripeStatus();

  return (
    <Screen>
      <ScreenHeader title="Business" subtitle="Services, locations, and online payments." />
      <View style={styles.quickStats}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{listFromResponse(services.data ?? {}).length}</Text>
          <Text style={styles.meta}>Services</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{profile.data?.averageRating.toFixed(1) ?? '-'}</Text>
          <Text style={styles.meta}>Rating</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>
            {mobileFeatures.earnings
              ? '$' + (earnings.data?.totalEarnings ?? 0).toFixed(0)
              : stripe.data?.chargesEnabled === true
                ? 'Ready'
                : 'Setup'}
          </Text>
          <Text style={styles.meta}>{mobileFeatures.earnings ? 'Month' : 'Payments'}</Text>
        </Card>
      </View>
      <Badge
        label={
          stripe.data?.chargesEnabled === true ? 'Online payments ready' : 'Payment setup needed'
        }
        tone={stripe.data?.chargesEnabled === true ? 'success' : 'warning'}
      />
      <HubCard
        title="Services"
        subtitle="Add, edit, and toggle your offerings."
        onPress={() => router.push('/(barber)/business/services')}
      />
      <HubCard
        title="Service locations"
        subtitle="Update your precise shop address, mobile origin, travel area, and fees."
        onPress={() => router.push('/(barber)/business/mobile-service')}
      />
      <HubCard
        title="Online payments"
        subtitle="Choose whether customers can pay securely before their visit."
        onPress={() => router.push('/(barber)/business/payments')}
      />
      {mobileFeatures.earnings ? (
        <HubCard
          title="Earnings"
          subtitle="Revenue, fees, and payout history."
          onPress={() => router.push('/(barber)/business/earnings')}
        />
      ) : null}
      {mobileFeatures.subscriptions ? (
        <HubCard
          title="Subscription"
          subtitle={'Current tier: ' + (subscription.data?.tier ?? 'FREE')}
          onPress={() => router.push('/(barber)/business/subscription')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  quickStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
});
