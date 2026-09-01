import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { ServiceCard } from '@/components/barber/ServiceCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBarberServicesPrivate, useUpdateService } from '@/hooks/useBarberDashboard';
import { listFromResponse } from '@/lib/types';
import type { ServiceCategory } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const categories: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'haircut', label: 'Haircuts' },
  { value: 'beard', label: 'Beard' },
  { value: 'shave', label: 'Shave' },
  { value: 'color', label: 'Color' },
  { value: 'combo', label: 'Combos' },
  { value: 'kids', label: 'Kids' },
  { value: 'other', label: 'Other' },
];

export default function ServicesScreen(): React.ReactElement {
  const services = useBarberServicesPrivate();
  const update = useUpdateService();
  const list = listFromResponse(services.data ?? {});

  return (
    <Screen
      refreshing={services.isFetching}
      onRefresh={() => {
        void services.refetch();
      }}
    >
      <ScreenHeader showBack title="Services" subtitle="Your public offerings." />
      <Button title="Add service" onPress={() => router.push('/(barber)/business/services/new')} />
      {list.length === 0 && !services.isLoading ? (
        <EmptyState title="No services" message="Add a service to start taking bookings." />
      ) : null}
      {categories.map((category) => {
        const items = list.filter((service) => service.category === category.value);
        if (items.length === 0) return null;
        return (
          <View key={category.value} style={styles.section}>
            <View style={styles.heading}>
              <Text style={styles.title}>{category.label.toUpperCase()}</Text>
              <Text style={styles.count}>{items.length}</Text>
            </View>
            {items.map((service) => (
              <View key={service.id} style={styles.serviceRow}>
                <View style={styles.flex}>
                  <ServiceCard
                    service={service}
                    onPress={() => router.push('/(barber)/business/services/' + service.id)}
                  />
                </View>
                <Switch
                  ios_backgroundColor={colors.surfaceRaised}
                  thumbColor={service.isActive ? colors.textPrimary : colors.textMuted}
                  trackColor={{ false: colors.surfaceRaised, true: colors.borderLight }}
                  value={service.isActive}
                  onValueChange={(isActive) => {
                    void update.mutateAsync({ id: service.id, body: { isActive } });
                  }}
                />
              </View>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { ...typography.caption, color: colors.textSecondary },
  flex: { flex: 1 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  section: { gap: spacing.sm },
  serviceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.label, color: colors.textSecondary },
});
