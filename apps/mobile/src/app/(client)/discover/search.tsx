import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarberCard } from '@/components/barber/BarberCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { useBarberSearch } from '@/hooks/useBarbers';
import { mobileApi } from '@/lib/apiClient';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

export default function SearchResultsScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    category?: string;
    mobileOnly?: string;
    designId?: string;
  }>();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 400);
    return (): void => clearTimeout(id);
  }, [text]);

  const results = useBarberSearch({
    category: params.category,
    mobileOnly: params.mobileOnly === 'true' ? true : undefined,
    limit: 24,
    q: debounced,
  });
  const barbers = listFromResponse(results.data ?? {});
  const design = useQuery({
    queryKey: ['hair-design', params.designId],
    queryFn: () => mobileApi.client.design(params.designId ?? ''),
    enabled: params.designId !== undefined,
  });

  return (
    <Screen
      refreshing={results.isFetching}
      onRefresh={() => {
        void results.refetch();
      }}
    >
      <ScreenHeader showBack title="Search" subtitle="Filter by name, city, category, or price." />
      {design.data !== undefined ? (
        <View style={styles.designBanner}>
          <Text style={styles.filterTitle}>Booking for: {design.data.styleName}</Text>
          <Text style={styles.muted}>Your barber will receive the private preview.</Text>
        </View>
      ) : null}
      <Input
        autoCapitalize="none"
        label="Search barbers"
        onChangeText={setText}
        value={text}
        placeholder="Marcus, fade, beard..."
      />
      <View style={styles.filterBox}>
        <Text style={styles.filterTitle}>Filters</Text>
        <Text style={styles.muted}>
          {params.mobileOnly === 'true'
            ? 'Showing mobile barbers'
            : (params.category ?? 'All services')}
        </Text>
      </View>
      {barbers.length === 0 && !results.isLoading ? (
        <EmptyState
          title="No matches"
          message="Try a broader search or clear the category filter."
        />
      ) : null}
      {barbers.map((barber) => (
        <BarberCard
          barber={barber}
          href={`/(client)/discover/${barber.id}${params.designId ? `?designId=${params.designId}` : ''}`}
          key={barber.id}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: spacing.xs,
    padding: spacing.md,
  },
  designBanner: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  filterTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
