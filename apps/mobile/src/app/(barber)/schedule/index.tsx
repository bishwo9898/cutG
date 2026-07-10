import { addDays, format } from 'date-fns';
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
      {list.map((slot) => (
        <Card key={slot.id}>
          <View style={styles.slotRow}>
            <Text style={styles.time}>
              {slot.startTime} - {slot.endTime}
            </Text>
            <Text
              style={[
                styles.status,
                slot.status === 'AVAILABLE' ? styles.available : styles.unavailable,
              ]}
            >
              {slot.status}
            </Text>
          </View>
        </Card>
      ))}
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
  available: {
    color: colors.success,
  },
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
  status: {
    ...typography.label,
  },
  time: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  unavailable: {
    color: colors.warning,
  },
});
