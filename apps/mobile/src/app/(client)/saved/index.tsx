import { router } from 'expo-router';

import { BarberCard } from '@/components/barber/BarberCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSavedBarbers } from '@/hooks/useBarbers';
import { listFromResponse } from '@/lib/types';

export default function SavedBarbersScreen(): React.ReactElement {
  // The same hook the heart uses, so saving from a profile shows up here without a refetch.
  const saved = useSavedBarbers();
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
