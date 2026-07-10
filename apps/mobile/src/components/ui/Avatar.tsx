import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

type AvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: number;
};

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CG';

export const Avatar = ({ name, imageUrl, size = 48 }: AvatarProps): React.ReactElement => {
  const style = { height: size, width: size, borderRadius: size / 2 };
  if (imageUrl !== undefined && imageUrl !== null && imageUrl.length > 0) {
    return <Image source={{ uri: imageUrl }} style={[styles.image, style]} />;
  }
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.text}>{initials(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderLight,
    borderWidth: 1,
    justifyContent: 'center',
  },
  image: {
    backgroundColor: colors.surfaceRaised,
  },
  text: {
    ...typography.label,
    color: colors.textPrimary,
  },
});
