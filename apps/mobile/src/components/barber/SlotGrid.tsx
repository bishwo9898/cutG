import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AvailabilitySlot } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type SlotGridProps = {
  slots: AvailabilitySlot[];
  selectedSlotId?: string;
  minDuration?: number;
  onSelect: (slot: AvailabilitySlot) => void;
};

export const SlotGrid = ({
  slots,
  selectedSlotId,
  minDuration = 0,
  onSelect,
}: SlotGridProps): React.ReactElement => (
  <View style={styles.grid}>
    {slots.map((slot) => {
      const disabled = slot.status !== 'AVAILABLE' || slot.durationMinutes < minDuration;
      const selected = slot.id === selectedSlotId;
      return (
        <Pressable
          disabled={disabled}
          key={slot.id}
          onPress={() => onSelect(slot)}
          style={[styles.slot, disabled && styles.disabled, selected && styles.selected]}
        >
          <Text style={[styles.text, selected && styles.selectedText]}>{slot.startTime}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.35,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  text: {
    ...typography.label,
    color: colors.textPrimary,
  },
});
