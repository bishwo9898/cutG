import { Ionicons } from '@expo/vector-icons';
import type { ScheduleEntry } from '@barber-saas/shared-types';
import { addDays, format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import {
  useBarberSchedule,
  useBarberSlotsPrivate,
  useBlockBarberDate,
  useUpdateBarberSchedule,
} from '@/hooks/useBarberDashboard';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { humanLabel } from '@/lib/formatters';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaultSchedule = (): ScheduleEntry[] =>
  weekDays.map((_, index) => ({
    dayOfWeek: index + 1,
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
    isActive: index < 5,
  })) as ScheduleEntry[];

export default function ScheduleScreen(): React.ReactElement {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sheet, setSheet] = useState<'schedule' | 'block' | null>(null);
  const [draft, setDraft] = useState<ScheduleEntry[]>(defaultSchedule);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => format(addDays(new Date(), index), 'yyyy-MM-dd')),
    [],
  );
  const slots = useBarberSlotsPrivate({ startDate: date, endDate: date });
  const schedule = useBarberSchedule();
  const updateSchedule = useUpdateBarberSchedule();
  const blockDate = useBlockBarberDate();
  const list = listFromResponse(slots.data ?? {});

  const openSchedule = (): void => {
    const saved = schedule.data?.schedule ?? [];
    const byDay = new Map(saved.map((entry) => [entry.dayOfWeek, entry]));
    setDraft(defaultSchedule().map((entry) => byDay.get(entry.dayOfWeek) ?? entry));
    setMessage(null);
    setSheet('schedule');
  };
  const updateDay = (dayOfWeek: number, patch: Partial<ScheduleEntry>): void => {
    setDraft((current) =>
      current.map((entry) => (entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry)),
    );
  };
  const saveSchedule = async (): Promise<void> => {
    try {
      await updateSchedule.mutateAsync(draft);
      await mobileApi.barber.generateSlots(
        format(new Date(), 'yyyy-MM-dd'),
        format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      );
      setSheet(null);
      setMessage('Working hours saved and future availability refreshed.');
      await slots.refetch();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };
  const saveBlockedDate = async (): Promise<void> => {
    try {
      await blockDate.mutateAsync({ date, reason: reason.trim() || undefined });
      setReason('');
      setSheet(null);
      setMessage(`${format(new Date(`${date}T00:00:00`), 'MMMM d')} is blocked.`);
      await slots.refetch();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <Screen refreshing={slots.isFetching} onRefresh={() => void slots.refetch()}>
      <ScreenHeader title="Calendar" subtitle="Availability, bookings, and time away." />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {days.map((item) => (
          <Button
            key={item}
            title={format(new Date(`${item}T00:00:00`), 'EEE d')}
            onPress={() => setDate(item)}
            variant={item === date ? 'primary' : 'secondary'}
          />
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="Working hours" onPress={openSchedule} />
        </View>
        <View style={styles.flex}>
          <Button
            title="Block this day"
            variant="secondary"
            onPress={() => {
              setMessage(null);
              setSheet('block');
            }}
          />
        </View>
      </View>
      {message !== null ? <Text style={styles.notice}>{message}</Text> : null}
      {list.length === 0 && !slots.isLoading ? (
        <EmptyState
          title="No slots for this day"
          message="Update working hours to make this day bookable."
        />
      ) : null}
      {list.map((slot) => {
        const state = slot.status ?? (slot.isAvailable === true ? 'AVAILABLE' : 'BLOCKED');
        // A free slot whose time has gone by is history, not capacity — showing it as "Available"
        // with a green tick told the barber they had openings nobody could book. A booked slot
        // keeps its identity once passed, because the barber still needs to see who it was.
        const passed = slot.isPast === true;
        const spent = passed && state !== 'BOOKED';
        return (
          <Card
            key={slot.id}
            style={[
              spent
                ? styles.passedCard
                : state === 'BOOKED'
                  ? styles.bookedCard
                  : state === 'BLOCKED'
                    ? styles.blockedCard
                    : styles.availableCard,
              passed && state === 'BOOKED' ? styles.passedBooked : null,
            ]}
          >
            <View style={styles.slotRow}>
              <View style={styles.timeRow}>
                <Ionicons color={colors.textSecondary} name="time-outline" size={18} />
                <Text style={[styles.time, spent && styles.timeSpent]}>
                  {slot.startTime} – {slot.endTime}
                </Text>
              </View>
              <View
                style={[
                  styles.stateBadge,
                  spent
                    ? styles.passedBadge
                    : state === 'AVAILABLE'
                      ? styles.availableBadge
                      : state === 'BOOKED'
                        ? styles.bookedBadge
                        : styles.blockedBadge,
                ]}
              >
                <Ionicons
                  color={
                    spent
                      ? colors.textSecondary
                      : state === 'AVAILABLE'
                        ? colors.success
                        : state === 'BOOKED'
                          ? colors.warning
                          : colors.error
                  }
                  name={
                    spent
                      ? 'time-outline'
                      : state === 'AVAILABLE'
                        ? 'checkmark-circle'
                        : state === 'BOOKED'
                          ? 'person'
                          : 'ban'
                  }
                  size={14}
                />
                <Text
                  style={[
                    styles.status,
                    spent
                      ? styles.spentText
                      : state === 'AVAILABLE'
                        ? styles.available
                        : styles.unavailable,
                  ]}
                >
                  {spent ? 'Passed' : humanLabel(state)}
                </Text>
              </View>
            </View>
            {state === 'BOOKED' ? (
              <View style={styles.bookingSummary}>
                <Text style={styles.customer}>
                  {slot.appointmentSummary?.customerName ?? 'Customer booking'}
                </Text>
                <Text style={styles.meta}>
                  {slot.appointmentSummary?.serviceName ?? 'Service'} ·{' '}
                  {humanLabel(slot.appointmentSummary?.status ?? 'BOOKED')}
                </Text>
                {slot.appointmentSummary !== undefined ? (
                  <Button
                    title="Review booking"
                    variant="secondary"
                    onPress={() =>
                      router.push(
                        `/(barber)/appointments/${slot.appointmentSummary?.appointmentId}`,
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
      <BottomSheet visible={sheet === 'schedule'} onClose={() => setSheet(null)}>
        <Text style={styles.title}>Weekly working hours</Text>
        <Text style={styles.meta}>
          Turn days on or off and use 24-hour times, such as 09:00 and 17:30.
        </Text>
        {draft.map((entry, index) => (
          <Card key={entry.dayOfWeek}>
            <View style={styles.slotRow}>
              <Text style={styles.customer}>{weekDays[index]}</Text>
              <Switch
                accessibilityLabel={`${weekDays[index]} availability`}
                value={entry.isActive}
                onValueChange={(isActive) => updateDay(entry.dayOfWeek, { isActive })}
                trackColor={{ false: colors.border, true: colors.success }}
              />
            </View>
            {entry.isActive ? (
              <View style={styles.timeInputs}>
                <View style={styles.flex}>
                  <Input
                    label="Starts"
                    value={entry.startTime}
                    onChangeText={(startTime) => updateDay(entry.dayOfWeek, { startTime })}
                  />
                </View>
                <View style={styles.flex}>
                  <Input
                    label="Ends"
                    value={entry.endTime}
                    onChangeText={(endTime) => updateDay(entry.dayOfWeek, { endTime })}
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.meta}>Not accepting appointments</Text>
            )}
          </Card>
        ))}
        {message !== null ? <Text style={styles.error}>{message}</Text> : null}
        <Button
          title="Save working hours"
          loading={updateSchedule.isPending}
          onPress={() => void saveSchedule()}
        />
      </BottomSheet>
      <BottomSheet visible={sheet === 'block'} onClose={() => setSheet(null)}>
        <Text style={styles.title}>Block {format(new Date(`${date}T00:00:00`), 'MMMM d')}?</Text>
        <Text style={styles.meta}>
          Available times will be closed. Existing customer bookings are preserved.
        </Text>
        <Input
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          placeholder="Personal day"
        />
        {message !== null ? <Text style={styles.error}>{message}</Text> : null}
        <Button
          title="Block this day"
          variant="danger"
          loading={blockDate.isPending}
          onPress={() => void saveBlockedDate()}
        />
        <Button title="Keep day open" variant="secondary" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
  available: { color: colors.success },
  availableBadge: {
    backgroundColor: colors.statusConfirmedSurface,
    borderColor: colors.statusConfirmed,
  },
  availableCard: {
    backgroundColor: colors.statusConfirmedSurface,
    borderColor: colors.statusConfirmed,
  },
  blockedBadge: {
    backgroundColor: colors.statusCancelledSurface,
    borderColor: colors.statusCancelled,
  },
  blockedCard: {
    backgroundColor: colors.statusCancelledSurface,
    borderColor: colors.statusCancelled,
    borderStyle: 'dashed',
  },
  bookedBadge: { backgroundColor: colors.statusPendingSurface, borderColor: colors.statusPending },
  bookedCard: { backgroundColor: colors.statusPendingSurface, borderColor: colors.statusPending },
  bookingSummary: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  customer: { ...typography.label, color: colors.textPrimary },
  days: { gap: spacing.sm },
  error: { ...typography.bodySmall, color: colors.error },
  flex: { flex: 1 },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  notice: {
    ...typography.bodySmall,
    backgroundColor: colors.statusConfirmedSurface,
    borderRadius: 10,
    color: colors.success,
    padding: spacing.md,
  },
  slotRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  stateBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  status: { ...typography.label },
  time: { ...typography.h3, color: colors.textPrimary },
  timeInputs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  unavailable: { color: colors.warning },
  passedCard: { backgroundColor: colors.background, borderColor: colors.border },
  passedBooked: { opacity: 0.72 },
  passedBadge: { backgroundColor: colors.background, borderColor: colors.border },
  spentText: { color: colors.textSecondary },
  timeSpent: { color: colors.textSecondary, textDecorationLine: 'line-through' },
});
