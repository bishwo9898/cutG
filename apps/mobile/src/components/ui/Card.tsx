import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  // StyleProp rather than a bare ViewStyle so callers can compose conditional styles as an array,
  // which is the normal React Native idiom.
  style?: StyleProp<ViewStyle>;
};

export const Card = ({ children, style }: CardProps): React.ReactElement => (
  <View style={[styles.card, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
  },
});
