import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const featured = useBarberSearch({ limit: 8 });
  const barbers = listFromResponse(featured.data ?? {});

  return (
    <Screen
      refreshing={featured.isFetching}
      onRefresh={() => {
        void featured.refetch();
      }}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CUTG · FOR CUSTOMERS</Text>
        <ScreenHeader
          title="Find your next great barber."
          subtitle="Trusted professionals, real availability, one simple booking."
        />
        <View style={styles.heroActions}>
          <View style={styles.heroAction}>
            <Button
              icon={<Ionicons color={colors.textOnAccent} name="search" size={17} />}
              title="Search barbers"
              onPress={() => router.push('/(client)/discover/search')}
            />
          </View>
          <View style={styles.heroAction}>
            <Button
              icon={<Ionicons color={colors.textSecondary} name="sparkles-outline" size={17} />}
              title="Design a look"
              variant="secondary"
              onPress={() => router.push('/(client)/design')}
            />
          </View>
        </View>
      </View>
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
        {categories.map((category) => (
          <Button
            key={category}
            title={category}
            onPress={() => router.push('/(client)/discover/search?category=' + category)}
            variant="ghost"
          />
        ))}
      </ScrollView>
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.eyebrow}>CURATED FOR YOU</Text>
          <Text style={styles.section}>Featured barbers</Text>
        </View>
        <Text style={styles.sectionMeta}>Available now</Text>
      </View>
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
  eyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  hero: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroAction: {
    flex: 1,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
    marginTop: spacing.xs,
  },
  sectionHeading: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
