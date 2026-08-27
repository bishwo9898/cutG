import { useClerk } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBarberProfilePrivate } from '@/hooks/useBarberDashboard';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { unregisterCurrentDevice } from '@/services/pushNotifications';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';

export default function BarberProfileScreen(): React.ReactElement {
  const profile = useBarberProfilePrivate();
  const { clearAuth } = useAuthStore();
  const { signOut } = useClerk();
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    try {
      if (businessName.length > 0 || bio.length > 0)
        await mobileApi.barber.updateProfile({ businessName, bio });
      if (photoUrl.length > 0) await mobileApi.barber.uploadPhoto(photoUrl);
      setMessage('Profile updated.');
      await profile.refetch();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const pickPhoto = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri !== undefined) setPhotoUrl(result.assets[0].uri);
  };

  const logout = async (): Promise<void> => {
    await unregisterCurrentDevice();
    await clearAuth();
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen
      refreshing={profile.isFetching}
      onRefresh={() => {
        void profile.refetch();
      }}
    >
      <ScreenHeader title="Barber profile" subtitle="Public business identity." />
      <Card>
        <Avatar
          name={profile.data?.businessName ?? 'cutG Barber'}
          imageUrl={profile.data?.profilePhotoUrl}
          size={72}
        />
        <Text style={styles.title}>{profile.data?.businessName ?? 'Create profile'}</Text>
        <Badge label={profile.data?.subscriptionTier ?? 'FREE'} tone="gold" />
        <Text style={styles.meta}>{profile.data?.averageRating.toFixed(1) ?? '-'} rating</Text>
      </Card>
      <Input
        label="Business name"
        value={businessName}
        onChangeText={setBusinessName}
        placeholder={profile.data?.businessName ?? 'Business name'}
      />
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder={profile.data?.bio ?? 'Tell customers about your shop'}
      />
      {photoUrl.length > 0 ? (
        <Image
          accessibilityLabel="Selected profile photo"
          source={{ uri: photoUrl }}
          style={styles.preview}
        />
      ) : null}
      <Button
        title="Choose photo"
        variant="secondary"
        onPress={() => {
          void pickPhoto();
        }}
      />
      <Button
        title="Save profile"
        onPress={() => {
          void save();
        }}
      />
      <Button
        title="Preview public profile"
        variant="secondary"
        onPress={() => {
          if (profile.data?.id !== undefined) router.push('/(client)/discover/' + profile.data.id);
        }}
      />
      <Button
        title="Sign out"
        variant="danger"
        onPress={() => {
          void logout();
        }}
      />
      {message !== null ? <Text style={styles.meta}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  preview: { borderRadius: 18, height: 180, width: '100%' },
});
