import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import type { Review } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type ReviewCardProps = {
  review: Review;
};

export const ReviewCard = ({ review }: ReviewCardProps): React.ReactElement => (
  <Card>
    <View style={styles.header}>
      <Text style={styles.name}>{review.clientName ?? 'Customer'}</Text>
      <StarRating value={review.rating} />
    </View>
    {review.title !== undefined && review.title !== null ? (
      <Text style={styles.title}>{review.title}</Text>
    ) : null}
    {review.comment !== undefined && review.comment !== null ? (
      <Text style={styles.comment}>{review.comment}</Text>
    ) : null}
  </Card>
);

const styles = StyleSheet.create({
  comment: {
    ...typography.body,
    color: colors.textSecondary,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.label,
    color: colors.textPrimary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
});
