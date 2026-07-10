import { StyleSheet, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { colors } from '@/theme';

type SkeletonProps = {
  height?: number;
  width?: DimensionValue;
};

export const Skeleton = ({ height = 18, width = '100%' }: SkeletonProps): React.ReactElement => (
  <View style={[styles.skeleton, { height, width }]} />
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    opacity: 0.7,
  },
});
