import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import type { PublicBarber } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type BarberCardProps = {
  barber: PublicBarber;
  compact?: boolean;
  href?: string;
};

export const BarberCard = ({
  barber,
  compact = false,
  href,
}: BarberCardProps): React.ReactElement => (
  <Pressable onPress={() => router.push(href ?? '/(client)/discover/' + barber.id)}>
    <Card style={compact ? styles.compact : undefined}>
      <View style={styles.row}>
        <Avatar
          imageUrl={barber.profilePhotoUrl}
          name={barber.businessName}
          size={compact ? 48 : 58}
        />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {barber.businessName}
            </Text>
            {barber.isVerified ? <Badge label="Verified" tone="success" /> : null}
            {barber.mobileService?.isEnabled === true ? <Badge label="Mobile" tone="info" /> : null}
          </View>
          <Text style={styles.meta}>
            {[barber.city, barber.state].filter(Boolean).join(', ') || 'Local barber'}
          </Text>
          <View style={styles.ratingRow}>
            <StarRating value={Math.round(barber.averageRating)} />
            <Text style={styles.meta}>
              {barber.averageRating.toFixed(1)} ({barber.totalReviews})
            </Text>
          </View>
          <Text style={styles.price}>
            {barber.lowestServicePrice === null
              ? 'Services available'
              : 'From $' + barber.lowestServicePrice.toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  </Pressable>
);

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  compact: {
    width: 280,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  price: {
    ...typography.label,
    color: colors.accentLight,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
