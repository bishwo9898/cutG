import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
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
