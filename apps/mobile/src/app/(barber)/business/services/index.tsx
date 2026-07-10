import { router } from 'expo-router';
import { Switch } from 'react-native';

import { ServiceCard } from '@/components/barber/ServiceCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBarberServicesPrivate, useUpdateService } from '@/hooks/useBarberDashboard';
import { listFromResponse } from '@/lib/types';

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
      {list.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onPress={() => router.push('/(barber)/business/services/' + service.id)}
        />
      ))}
      {list.map((service) => (
        <Switch
          key={service.id + '-toggle'}
          value={service.isActive}
          onValueChange={(isActive) => {
            void update.mutateAsync({ id: service.id, body: { isActive } });
          }}
        />
      ))}
    </Screen>
  );
}
