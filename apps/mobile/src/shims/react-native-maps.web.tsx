import { forwardRef, useImperativeHandle } from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ViewProps } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type Coordinate = { latitude: number; longitude: number };
export type MapPressEvent = { nativeEvent: { coordinate: Coordinate } };
export type MarkerDragStartEndEvent = MapPressEvent;

type MapViewProps = PropsWithChildren<
  ViewProps & {
    initialRegion?: unknown;
    region?: unknown;
    onPress?: (event: MapPressEvent) => void;
  }
>;

const MapView = forwardRef<{ fitToCoordinates: () => void }, MapViewProps>(
  (
    {
      children,
      initialRegion: _initialRegion,
      onPress: _onPress,
      region: _region,
      style,
      ...viewProps
    },
    ref,
  ) => {
    void _initialRegion;
    void _onPress;
    void _region;
    useImperativeHandle(
      ref,
      (): { fitToCoordinates: () => void } => ({ fitToCoordinates: (): void => undefined }),
      [],
    );
    return (
      <View {...viewProps} style={[styles.map, style]}>
        {children}
        <Text style={styles.title}>Interactive map preview</Text>
        <Text style={styles.copy}>Open the iOS or Android build for pins and live routes.</Text>
      </View>
    );
  },
);
MapView.displayName = 'WebMapPreview';

export const Marker = (props: Record<string, unknown>): null => {
  void props;
  return null;
};
export const Polyline = (props: Record<string, unknown>): null => {
  void props;
  return null;
};
export const Circle = (props: Record<string, unknown>): null => {
  void props;
  return null;
};

const styles = StyleSheet.create({
  copy: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  map: {
    alignItems: 'center',
    backgroundColor: colors.statusOnTheWaySurface,
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 180,
    padding: spacing.md,
  },
  title: { ...typography.label, color: colors.textPrimary },
});

export default MapView;
