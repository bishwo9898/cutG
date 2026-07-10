import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mobileApi } from '@/lib/apiClient';
import { useSubscription } from '@/hooks/usePayments';
import { colors, spacing, typography } from '@/theme';

export default function SubscriptionScreen(): React.ReactElement {
  const subscription = useSubscription();

  const openCheckout = async (tier: 'BASIC' | 'PREMIUM'): Promise<void> => {
    const checkout = await mobileApi.barber.checkout(tier, 'month');
    await Linking.openURL(checkout.url);
  };

  return (
    <Screen
      refreshing={subscription.isFetching}
      onRefresh={() => {
        void subscription.refetch();
      }}
    >
      <ScreenHeader showBack title="Subscription" subtitle="Manage cutG tier features." />
      <Card>
        <Text style={styles.title}>Current plan</Text>
        <Badge label={subscription.data?.tier ?? 'FREE'} tone="gold" />
        <Text style={styles.meta}>{subscription.data?.status ?? 'active'}</Text>
      </Card>
      <View style={styles.plans}>
        <Card>
          <Text style={styles.title}>FREE</Text>
          <Text style={styles.meta}>5 services, booking basics.</Text>
        </Card>
        <Card>
          <Text style={styles.title}>BASIC</Text>
          <Text style={styles.meta}>20 services and analytics.</Text>
          <Button
            title="Upgrade Basic"
            onPress={() => {
              void openCheckout('BASIC');
            }}
          />
        </Card>
        <Card>
          <Text style={styles.title}>PREMIUM</Text>
          <Text style={styles.meta}>Unlimited services and premium growth tools.</Text>
          <Button
            title="Upgrade Premium"
            onPress={() => {
              void openCheckout('PREMIUM');
            }}
          />
        </Card>
      </View>
      {subscription.data?.cancelAtPeriodEnd === true ? (
        <Text style={styles.warning}>Cancels at period end.</Text>
      ) : null}
      <Button
        title="Cancel renewal"
        variant="danger"
        onPress={() => {
          void mobileApi.barber.cancelSubscription();
        }}
      />
      <Button
        title="Resume renewal"
        variant="secondary"
        onPress={() => {
          void mobileApi.barber.resumeSubscription();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  plans: {
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  warning: {
    ...typography.body,
    color: colors.warning,
  },
});
