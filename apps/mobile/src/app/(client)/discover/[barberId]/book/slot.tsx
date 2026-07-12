import { addDays, format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SlotGrid } from '@/components/barber/SlotGrid';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBarberServices, useBarberSlots } from '@/hooks/useBarbers';
import type { AvailabilitySlot } from '@/lib/types';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

export default function SelectSlotScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    barberId?: string;
    serviceId?: string;
    appointmentType?: string;
    addressId?: string;
    address?: string;
    travelMinutes?: string;
    travelFee?: string;
  }>();
  const barberId = params.barberId ?? '';
  const serviceId = params.serviceId ?? '';
  const isMobile = params.appointmentType === 'mobile';
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const services = useBarberServices(barberId);
  const slots = useBarberSlots(
    barberId,
    date,
    isMobile
      ? {
          mobileService: true,
          travelMinutes: Number(params.travelMinutes ?? 0),
        }
      : {},
  );
  const service = listFromResponse(services.data ?? {}).find((item) => item.id === serviceId);
  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => format(addDays(new Date(), index), 'yyyy-MM-dd')),
    [],
  );
  const slotList = listFromResponse(slots.data ?? {}).filter(
    (item) => !isMobile || item.availableForMobile === true,
  );

  return (
    <Screen
      refreshing={slots.isFetching}
      onRefresh={() => {
        void slots.refetch();
      }}
    >
      <ScreenHeader showBack title="Choose a time" subtitle={service?.name ?? 'Select a time.'} />
      {isMobile ? (
        <Text style={styles.info}>
          Showing slots with enough lead time for your barber to travel to you.
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {days.map((item) => (
          <Button
            key={item}
            title={format(new Date(item + 'T00:00:00'), 'MMM d')}
            onPress={() => {
              setDate(item);
              setSlot(null);
            }}
            variant={item === date ? 'primary' : 'secondary'}
          />
        ))}
      </ScrollView>
      <Text style={styles.date}>{format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d')}</Text>
      {slotList.length === 0 && !slots.isLoading ? (
        <EmptyState title="No slots" message="Try another date." />
      ) : null}
      <SlotGrid
        slots={slotList}
        selectedSlotId={slot?.id}
        minDuration={service?.durationMinutes ?? 0}
        onSelect={setSlot}
      />
      <Button
        disabled={slot === null || service === undefined}
        title="Continue"
        onPress={() => {
          if (slot !== null) {
            const next = new URLSearchParams({
              serviceId,
              slotId: slot.id,
              date,
              appointmentType: isMobile ? 'mobile' : 'shop',
            });
            if (params.addressId !== undefined) next.set('addressId', params.addressId);
            if (params.address !== undefined) next.set('address', params.address);
            if (params.travelMinutes !== undefined) next.set('travelMinutes', params.travelMinutes);
            if (params.travelFee !== undefined) next.set('travelFee', params.travelFee);
            router.push(`/(client)/discover/${barberId}/book/confirm?${next.toString()}`);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  days: {
    gap: spacing.sm,
  },
  info: {
    ...typography.bodySmall,
    color: colors.info,
  },
});
