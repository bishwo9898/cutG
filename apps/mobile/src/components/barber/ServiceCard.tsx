import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { BarberService } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type ServiceCardProps = {
  service: BarberService;
  onPress?: () => void;
};

const ServiceCardComponent = ({ service, onPress }: ServiceCardProps): React.ReactElement => (
  <Pressable disabled={onPress === undefined} onPress={onPress}>
    <Card>
      <View style={styles.row}>
        <View style={styles.body}>
          <Text style={styles.title}>{service.name}</Text>
          {service.description !== null ? (
            <Text numberOfLines={2} style={styles.description}>
              {service.description}
            </Text>
          ) : null}
          <View style={styles.badges}>
            <Badge label={service.category} tone="default" />
            <Badge icon="time-outline" label={service.durationMinutes + ' min'} tone="default" />
            {/* Only when the barber has actually deactivated it. The public services endpoint
                returns just the active ones and omits isActive entirely, so a bare falsy check
                stamped "Inactive" on every service a customer saw. */}
            {service.isActive === false ? <Badge label="Inactive" tone="warning" /> : null}
          </View>
        </View>
        <Text style={styles.price}>{'$' + service.price.toFixed(2)}</Text>
      </View>
    </Card>
  </Pressable>
);

/** Memoised to match the other list rows; a barber's service list re-renders on every tab change. */
export const ServiceCard = memo(ServiceCardComponent);

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  body: {
    flex: 1,
    gap: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  price: {
    ...typography.h3,
    color: colors.goldText,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
});
