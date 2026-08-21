import { Ionicons } from '@expo/vector-icons';
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

const availability = (value: string | null): string => {
  if (value === null) return 'Availability coming soon';
  const slot = new Date(value);
  const days = Math.round(
    (new Date(slot.getFullYear(), slot.getMonth(), slot.getDate()).getTime() -
      new Date().setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days === 0) return 'Available today';
  if (days === 1) return 'Available tomorrow';
  return `Next ${slot.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};

export const BarberCard = ({ barber, compact = false, href }: BarberCardProps): React.ReactElement => (
  <Pressable onPress={() => router.push(href ?? '/(client)/discover/' + barber.id)}>
    {({ pressed }) => (
      <Card style={{ ...(compact ? styles.compact : {}), ...(pressed ? styles.pressed : {}) }}>
        <View style={styles.row}>
          <Avatar imageUrl={barber.profilePhotoUrl} name={barber.businessName} size={compact ? 48 : 58} />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.title}>{barber.businessName}</Text>
              {barber.isVerified ? <Ionicons color={colors.info} name="shield-checkmark" size={17} /> : null}
            </View>
            <Text numberOfLines={1} style={styles.meta}>
              {[barber.city, barber.state].filter(Boolean).join(', ') || 'Local barber'}
              {barber.distanceMiles !== null && barber.distanceMiles !== undefined
                ? ` · ${barber.distanceMiles.toFixed(1)} mi`
                : ''}
            </Text>
            <View style={styles.ratingRow}>
              {barber.totalReviews > 0 ? (
                <>
                  <StarRating value={Math.round(barber.averageRating)} />
                  <Text style={styles.meta}>{barber.averageRating.toFixed(1)} ({barber.totalReviews})</Text>
                </>
              ) : <Text style={styles.newLabel}>New</Text>}
            </View>
            <Text style={styles.price}>
              {barber.lowestServicePrice === null ? 'Services available' : `From $${barber.lowestServicePrice.toFixed(2)}`}
            </Text>
            <Text style={styles.availability}>{availability(barber.nextAvailableSlot)}</Text>
            <View style={styles.badges}>
              {barber.mobileService?.isEnabled === true ? <Badge label="✓ Mobile visits" tone="success" /> : null}
              {barber.onlinePaymentsAvailable === true ? <Badge label="✓ Online payments" tone="info" /> : null}
            </View>
          </View>
        </View>
      </Card>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  availability: { ...typography.caption, color: colors.success, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  body: { flex: 1, gap: spacing.xs },
  compact: { width: 280 },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  newLabel: { ...typography.label, color: colors.warning },
  pressed: { backgroundColor: '#F3F0EB', borderColor: colors.borderLight },
  price: { ...typography.label, color: colors.textPrimary },
  ratingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
