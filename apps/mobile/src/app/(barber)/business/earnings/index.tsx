import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConnectStripe, useEarnings, useStripeStatus } from '@/hooks/usePayments';
import { colors, spacing, typography } from '@/theme';

const periods = ['week', 'month', 'all'] as const;

export default function EarningsScreen(): React.ReactElement {
  const [period, setPeriod] = useState<(typeof periods)[number]>('month');
  const earnings = useEarnings(period);
  const stripe = useStripeStatus();
  const connect = useConnectStripe();

  return (
    <Screen
      refreshing={earnings.isFetching}
      onRefresh={() => {
        void earnings.refetch();
      }}
    >
      <ScreenHeader showBack title="Earnings" subtitle="Revenue, fees, and pending payouts." />
      <View style={styles.chips}>
        {periods.map((item) => (
          <Button
            key={item}
            title={item}
            onPress={() => setPeriod(item)}
            variant={item === period ? 'primary' : 'secondary'}
          />
        ))}
      </View>
      <Card>
        <Text style={styles.value}>{'$' + (earnings.data?.totalEarnings ?? 0).toFixed(2)}</Text>
        <Text style={styles.meta}>Total earnings</Text>
      </Card>
      <Card>
        <Text style={styles.value}>{'$' + (earnings.data?.platformFees ?? 0).toFixed(2)}</Text>
        <Text style={styles.meta}>Platform fees</Text>
      </Card>
      <Card>
        <Text style={styles.value}>{'$' + (earnings.data?.pendingPayout ?? 0).toFixed(2)}</Text>
        <Text style={styles.meta}>Pending payout</Text>
      </Card>
      {stripe.data?.payoutsEnabled !== true ? (
        <Button
          title="Set up online payouts"
          onPress={() => {
            void connect.mutateAsync();
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.h1,
    color: colors.goldText,
  },
});
