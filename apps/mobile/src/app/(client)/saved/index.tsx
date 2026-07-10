import { router } from 'expo-router';

import { BarberCard } from '@/components/barber/BarberCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { mobileApi } from '@/lib/apiClient';
import { listFromResponse } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';

export default function SavedBarbersScreen(): React.ReactElement {
  const saved = useQuery({
    queryKey: ['client', 'saved-barbers'],
    queryFn: () => mobileApi.client.savedBarbers(),
  });
  const list = listFromResponse(saved.data ?? {});

  return (
    <Screen
      refreshing={saved.isFetching}
      onRefresh={() => {
        void saved.refetch();
      }}
    >
      <ScreenHeader title="Saved" subtitle="Favorite barbers for faster rebooking." />
      {list.length === 0 && !saved.isLoading ? (
        <EmptyState
          title="No saved barbers"
          message="Save barbers from their profile page."
          actionLabel="Find barbers"
          onAction={() => router.push('/(client)/discover')}
        />
      ) : null}
      {list.map((barber) => (
        <BarberCard barber={barber} key={barber.id} />
      ))}
    </Screen>
  );
}
