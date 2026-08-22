import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
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
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    height: 4,
    marginBottom: spacing.md,
    width: 44,
  },
});
