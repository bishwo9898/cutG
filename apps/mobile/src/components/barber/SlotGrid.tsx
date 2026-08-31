import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AvailabilitySlot } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type SlotGridProps = {
  slots: AvailabilitySlot[];
  selectedSlotId?: string;
  minDuration?: number;
  onSelect: (slot: AvailabilitySlot) => void;
};

/**
 * Times that are booked or already gone stay on the grid rather than disappearing, matching the
 * web picker: a day with silent gaps reads as though the barber simply does not work then. They
 * are struck through, labelled with the reason, and cannot be pressed — the API reports
 * isAvailable false for both, and booking one is rejected server-side anyway.
 */
export const SlotGrid = ({
  slots,
  selectedSlotId,
  minDuration = 0,
  onSelect,
}: SlotGridProps): React.ReactElement => (
  <View style={styles.grid}>
    {slots.map((slot) => {
      const start = new Date(`2000-01-01T${slot.startTime}:00`).getTime();
      const end = new Date(`2000-01-01T${slot.endTime}:00`).getTime();
      const duration = slot.durationMinutes ?? (end - start) / 60_000;
      const past = slot.isPast === true || slot.status === 'PAST';
      const booked = slot.status === 'BOOKED';
      const available = (slot.isAvailable ?? slot.status === 'AVAILABLE') && !past;
      const disabled = !available || duration < minDuration;
      const selected = slot.id === selectedSlotId;
      const reason = past ? 'Passed' : booked ? 'Booked' : null;
      return (
        <Pressable
          accessibilityLabel={
            reason === null ? slot.startTime : `${slot.startTime}, ${reason.toLowerCase()}`
          }
          accessibilityRole="button"
          accessibilityState={{ disabled, selected }}
          disabled={disabled}
          key={slot.id}
          onPress={() => onSelect(slot)}
          style={[styles.slot, disabled && styles.disabled, selected && styles.selected]}
        >
          <Text
            style={[
              styles.text,
              selected && styles.selectedText,
              reason !== null && styles.struck,
            ]}
          >
            {slot.startTime}
          </Text>
          {reason !== null && <Text style={styles.reason}>{reason}</Text>}
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  disabled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reason: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selectedText: {
    color: colors.textOnAccent,
  },
  slot: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 82,
    padding: spacing.md,
  },
  struck: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  text: {
    ...typography.label,
    color: colors.textPrimary,
  },
});
