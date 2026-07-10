import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
};

export const StarRating = ({ value, onChange, size = 18 }: StarRatingProps): React.ReactElement => (
  <View style={styles.row}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Pressable disabled={onChange === undefined} key={star} onPress={() => onChange?.(star)}>
        <Text style={{ color: star <= value ? colors.gold : colors.borderLight, fontSize: size }}>
          ★
        </Text>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
