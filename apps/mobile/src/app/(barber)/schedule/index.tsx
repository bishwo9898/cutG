import { Ionicons } from '@expo/vector-icons';
import { addDays, format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useBarberSlotsPrivate } from '@/hooks/useBarberDashboard';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

export default function ScheduleScreen(): React.ReactElement {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editing, setEditing] = useState(false);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => format(addDays(new Date(), index), 'yyyy-MM-dd')),
    [],
  );
  const slots = useBarberSlotsPrivate({ startDate: date, endDate: date });
  const list = listFromResponse(slots.data ?? {});

  return (
    <Screen
      refreshing={slots.isFetching}
      onRefresh={() => {
        void slots.refetch();
      }}
    >
      <ScreenHeader title="Calendar" subtitle="Weekly slots and blocked time." />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {days.map((item) => (
          <Button
            key={item}
            title={format(new Date(item + 'T00:00:00'), 'EEE d')}
            onPress={() => setDate(item)}
            variant={item === date ? 'primary' : 'secondary'}
          />
        ))}
      </ScrollView>
      {list.map((slot) => {
        const state = slot.status ?? (slot.isAvailable === true ? 'AVAILABLE' : 'BLOCKED');
        return (
        <Card
          key={slot.id}
          style={
            state === 'BOOKED'
              ? styles.bookedCard
              : state === 'BLOCKED'
                ? styles.blockedCard
                : styles.availableCard
          }
        >
          <View style={styles.slotRow}>
            <View style={styles.timeRow}>
              <Ionicons color={colors.textSecondary} name="time-outline" size={18} />
              <Text style={styles.time}>{slot.startTime} – {slot.endTime}</Text>
            </View>
            <View style={[styles.stateBadge, state === 'AVAILABLE' ? styles.availableBadge : state === 'BOOKED' ? styles.bookedBadge : styles.blockedBadge]}>
              <Ionicons
                color={state === 'AVAILABLE' ? colors.success : state === 'BOOKED' ? colors.warning : colors.error}
                name={state === 'AVAILABLE' ? 'checkmark-circle' : state === 'BOOKED' ? 'person' : 'ban'}
                size={14}
              />
              <Text style={[styles.status, state === 'AVAILABLE' ? styles.available : styles.unavailable]}>{state === 'AVAILABLE' ? 'Available' : state === 'BOOKED' ? 'Booked' : 'Blocked'}</Text>
            </View>
          </View>
          {state === 'BOOKED' ? (
            <View style={styles.bookingSummary}>
              <Text style={styles.customer}>{slot.appointmentSummary?.customerName ?? 'Customer booking'}</Text>
              <Text style={styles.meta}>{slot.appointmentSummary?.serviceName ?? 'Service'}</Text>
              <Text style={styles.meta}>{(slot.appointmentSummary?.status ?? 'BOOKED').replaceAll('_', ' ')}</Text>
              {slot.appointmentSummary !== undefined ? (
                <Button
                  title="Review booking"
                  variant="secondary"
                  onPress={() => router.push(`/(barber)/appointments/${slot.appointmentSummary?.appointmentId}`)}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      );})}
      <Button title="Edit schedule" onPress={() => setEditing(true)} />
      <Button title="Block date" variant="secondary" onPress={() => setEditing(true)} />
      <BottomSheet visible={editing} onClose={() => setEditing(false)}>
        <Text style={styles.title}>Schedule editor</Text>
        <Text style={styles.meta}>
          Weekly hour replacement and date blocking are backed by the API. The native controls are
          scaffolded here for the next UX polish pass.
        </Text>
        <Button title="Done" onPress={() => setEditing(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  availableBadge: { backgroundColor: colors.statusConfirmedSurface, borderColor: colors.statusConfirmed },
  availableCard: { backgroundColor: colors.statusConfirmedSurface, borderColor: colors.statusConfirmed },
  available: {
    color: colors.success,
  },
  blockedBadge: { backgroundColor: colors.statusCancelledSurface, borderColor: colors.statusCancelled },
  blockedCard: { backgroundColor: colors.statusCancelledSurface, borderColor: colors.statusCancelled, borderStyle: 'dashed' },
  bookedBadge: { backgroundColor: colors.statusPendingSurface, borderColor: colors.statusPending },
  bookedCard: { backgroundColor: colors.statusPendingSurface, borderColor: colors.statusPending },
  bookingSummary: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md },
  customer: { ...typography.label, color: colors.textPrimary },
  days: {
    gap: spacing.sm,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  slotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stateBadge: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  status: {
    ...typography.label,
  },
  time: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  unavailable: {
    color: colors.warning,
  },
});
