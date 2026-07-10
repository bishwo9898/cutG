import { router, useLocalSearchParams } from 'expo-router';

import { ServiceCard } from '@/components/barber/ServiceCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBarberServices } from '@/hooks/useBarbers';
import { listFromResponse } from '@/lib/types';

export default function SelectServiceScreen(): React.ReactElement {
  const { barberId = '' } = useLocalSearchParams<{ barberId?: string }>();
  const services = useBarberServices(barberId);
  const list = listFromResponse(services.data ?? {}).filter((service) => service.isActive);

  return (
    <Screen
      refreshing={services.isFetching}
      onRefresh={() => {
        void services.refetch();
      }}
    >
      <ScreenHeader showBack title="Step 1 of 3" subtitle="Choose a service." />
      {list.length === 0 && !services.isLoading ? (
        <EmptyState
          title="No active services"
          message="This barber has not published services yet."
        />
      ) : null}
      {list.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onPress={() =>
            router.push('/(client)/discover/' + barberId + '/book/slot?serviceId=' + service.id)
          }
        />
      ))}
    </Screen>
  );
}
