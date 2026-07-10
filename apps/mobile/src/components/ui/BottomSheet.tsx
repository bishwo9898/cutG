import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, spacing } from '@/theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export const BottomSheet = ({
  visible,
  onClose,
  children,
}: BottomSheetProps): React.ReactElement => (
  <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} />
    <View style={styles.sheet}>{children}</View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: spacing.md,
    padding: spacing.lg,
  },
});
