import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarberCard } from '@/components/barber/BarberCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBarberSearch } from '@/hooks/useBarbers';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const categories = ['haircut', 'beard', 'shave', 'combo', 'kids'];

export default function DiscoverScreen(): React.ReactElement {
  const featured = useBarberSearch({ limit: 8, verified: true });
  const barbers = listFromResponse(featured.data ?? {});

  return (
    <Screen
      refreshing={featured.isFetching}
      onRefresh={() => {
        void featured.refetch();
      }}
    >
      <ScreenHeader title="Discover" subtitle="Find the next clean cut near you." />
      <Button title="Search barbers" onPress={() => router.push('/(client)/discover/search')} />
      <Button
        title="Design your look"
        variant="secondary"
        onPress={() => router.push('/(client)/design')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Button
          title="Near me"
          onPress={() => router.push('/(client)/discover/search?nearMe=true')}
          variant="secondary"
        />
        <Button
          title="Mobile barbers"
          onPress={() => router.push('/(client)/discover/search?mobileOnly=true')}
          variant="secondary"
        />
        {categories.map((category) => (
          <Button
            key={category}
            title={category}
            onPress={() => router.push('/(client)/discover/search?category=' + category)}
            variant="ghost"
          />
        ))}
      </ScrollView>
      <Text style={styles.section}>Featured barbers</Text>
      {featured.isLoading ? <Skeleton height={120} /> : null}
      {!featured.isLoading && barbers.length === 0 ? (
        <EmptyState title="No barbers yet" message="Seed the database or broaden your filters." />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontal}
      >
        {barbers.map((barber) => (
          <BarberCard compact barber={barber} key={barber.id} />
        ))}
      </ScrollView>
      <Text style={styles.section}>Recent barbers</Text>
      <View style={styles.recentBox}>
        <Text style={styles.muted}>Recent visits will appear here after bookings.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: spacing.sm,
  },
  horizontal: {
    gap: spacing.md,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  recentBox: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  section: {
    ...typography.h2,
    color: colors.textPrimary,
  },
});
