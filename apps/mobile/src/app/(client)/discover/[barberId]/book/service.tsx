import { router, useLocalSearchParams } from 'expo-router';

import { ServiceCard } from '@/components/barber/ServiceCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBarberServices } from '@/hooks/useBarbers';
import { listFromResponse } from '@/lib/types';

export default function SelectServiceScreen(): React.ReactElement {
  const { barberId = '', designId } = useLocalSearchParams<{
    barberId?: string;
    designId?: string;
  }>();
  const services = useBarberServices(barberId);
  // The public endpoint already returns only active services and omits isActive entirely, so
  // filtering on it truthily discarded every service and left the first booking step claiming the
  // barber had published none. Drop only what is explicitly deactivated.
  const list = listFromResponse(services.data ?? {}).filter(
    (service) => service.isActive !== false,
  );

  return (
    <Screen
      refreshing={services.isFetching}
      onRefresh={() => {
        void services.refetch();
      }}
    >
      <ScreenHeader showBack title="Choose a service" subtitle="Step 1" />
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
            router.push(
              '/(client)/discover/' +
                barberId +
                '/book/type?serviceId=' +
                service.id +
                (designId ? '&designId=' + designId : ''),
            )
          }
        />
      ))}
    </Screen>
  );
}
