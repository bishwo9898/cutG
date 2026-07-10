import {
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import type { ReactNode } from 'react';

import { colors } from '@/theme';

type KeyboardAvoidingViewProps = {
  children: ReactNode;
};

export const KeyboardAvoidingView = ({
  children,
}: KeyboardAvoidingViewProps): React.ReactElement => (
  <NativeKeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={styles.wrap}
  >
    {children}
  </NativeKeyboardAvoidingView>
);

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
