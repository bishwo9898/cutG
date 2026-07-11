import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarberCard } from '@/components/barber/BarberCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { useBarberSearch } from '@/hooks/useBarbers';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

export default function SearchResultsScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ category?: string; mobileOnly?: string }>();
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

  return (
    <Screen
      refreshing={results.isFetching}
      onRefresh={() => {
        void results.refetch();
      }}
    >
      <ScreenHeader showBack title="Search" subtitle="Filter by name, city, category, or price." />
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
        <BarberCard barber={barber} key={barber.id} />
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
  filterTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
