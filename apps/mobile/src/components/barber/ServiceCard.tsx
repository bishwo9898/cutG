import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { BarberService } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type ServiceCardProps = {
  service: BarberService;
  onPress?: () => void;
};

export const ServiceCard = ({ service, onPress }: ServiceCardProps): React.ReactElement => (
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
            <Badge label={service.durationMinutes + ' min'} tone="info" />
            {!service.isActive ? <Badge label="Inactive" tone="warning" /> : null}
          </View>
        </View>
        <Text style={styles.price}>{'$' + service.price.toFixed(2)}</Text>
      </View>
    </Card>
  </Pressable>
);

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
