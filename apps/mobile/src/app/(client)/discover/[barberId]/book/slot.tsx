import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SlotGrid } from '@/components/barber/SlotGrid';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBarberServices, useBarberSlots } from '@/hooks/useBarbers';
import { bookableDays, slotsForDay } from '@/lib/booking';
import type { AvailabilitySlot } from '@/lib/types';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const BOOKING_WINDOW_DAYS = 14;

export default function SelectSlotScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    barberId?: string;
    serviceId?: string;
    appointmentType?: string;
    addressId?: string;
    address?: string;
    travelMinutes?: string;
    travelFee?: string;
    estimateUnavailable?: string;
    designId?: string;
  }>();
  const barberId = params.barberId ?? '';
  const serviceId = params.serviceId ?? '';
  const isMobile = params.appointmentType === 'mobile';
  const hasTravelEstimate =
    isMobile && params.estimateUnavailable !== 'true' && Number(params.travelMinutes) > 0;
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const services = useBarberServices(barberId);
  // One request for the whole window rather than one per day, so the date strip can be built from
  // what the barber has actually published instead of guessing.
  const slots = useBarberSlots(barberId, format(new Date(), 'yyyy-MM-dd'), {
    days: BOOKING_WINDOW_DAYS,
    ...(hasTravelEstimate
      ? { mobileService: true, travelMinutes: Number(params.travelMinutes ?? 0) }
      : {}),
  });
  const service = listFromResponse(services.data ?? {}).find((item) => item.id === serviceId);
  const allSlots = listFromResponse(slots.data ?? {});

  // Only days with something still bookable are offered. The strip used to be a flat 14 days from
  // today, which advertised the barber's closed days and any day whose times had all passed, and
  // only revealed it after a tap. See lib/booking.ts.
  const days = useMemo(
    () => bookableDays(allSlots, hasTravelEstimate),
    [allSlots, hasTravelEstimate],
  );
  const selectedDate = date ?? days[0] ?? null;
  const slotList = slotsForDay(allSlots, selectedDate, hasTravelEstimate);

  return (
    <Screen
      refreshing={slots.isFetching}
      onRefresh={() => {
        void slots.refetch();
      }}
    >
      <ScreenHeader showBack title="Choose a time" subtitle={service?.name ?? 'Select a time.'} />
      {hasTravelEstimate ? (
        <Text style={styles.info}>
          Showing slots with enough lead time for your barber to travel to you.
        </Text>
      ) : isMobile ? (
        <Text style={styles.warning}>Travel timing will be confirmed by your barber.</Text>
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
            variant={item === selectedDate ? 'primary' : 'secondary'}
          />
        ))}
      </ScrollView>
      {selectedDate === null ? (
        slots.isLoading ? null : (
          <EmptyState
            title="No times available"
            message="This barber has nothing open in the next two weeks."
          />
        )
      ) : (
        <Text style={styles.date}>
          {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}
        </Text>
      )}
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
              date: selectedDate ?? '',
              appointmentType: isMobile ? 'mobile' : 'shop',
            });
            if (params.addressId !== undefined) next.set('addressId', params.addressId);
            if (params.address !== undefined) next.set('address', params.address);
            if (params.travelMinutes !== undefined) next.set('travelMinutes', params.travelMinutes);
            if (params.travelFee !== undefined) next.set('travelFee', params.travelFee);
            if (params.estimateUnavailable !== undefined)
              next.set('estimateUnavailable', params.estimateUnavailable);
            if (params.designId !== undefined) next.set('designId', params.designId);
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
  warning: { ...typography.bodySmall, color: colors.warning },
});
