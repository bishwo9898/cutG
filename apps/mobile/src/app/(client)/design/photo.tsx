import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

type SelectedPhoto = { uri: string; width: number; height: number };

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');

export default function HairPhotoScreen(): React.ReactElement {
  const { scanId = '' } = useLocalSearchParams<{ scanId?: string }>();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useResult = (result: ImagePicker.ImagePickerResult): void => {
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset !== undefined) {
      setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  const takePhoto = async (): Promise<void> => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to take a headshot.');
      return;
    }
    useResult(
      await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 1,
      }),
    );
  };

  const choosePhoto = async (): Promise<void> => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo-library permission is required to choose a headshot.');
      return;
    }
    useResult(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 1,
      }),
    );
  };

  const upload = async (): Promise<void> => {
    if (photo === null || scanId.length === 0 || processing) return;
    setProcessing(true);
    setError(null);
    try {
      const normalized = await manipulateAsync(photo.uri, [{ resize: { width: 1280 } }], {
        compress: 0.86,
        format: SaveFormat.JPEG,
      });
      const response = await fetch(normalized.uri);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 4_000_000) {
        throw new Error('The selected image is still larger than 4 MB. Choose a smaller photo.');
      }
      const checksum = toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
      const signed = await mobileApi.client.presignHairCapture(scanId, {
        angle: 'FRONT',
        mimeType: 'image/jpeg',
        sizeBytes: bytes.byteLength,
        checksumSha256: checksum,
      });
      const uploaded = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: signed.headers,
        body: bytes,
      });
      if (!uploaded.ok) throw new Error('The private headshot upload failed.');
      await mobileApi.client.completeHairCapture(scanId, signed.captureId, {
        width: normalized.width,
        height: normalized.height,
      });
      await mobileApi.client.validateHairScan(scanId, {});
      router.replace(`/(client)/design/style?scanId=${scanId}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Upload a headshot"
        subtitle="One clear portrait is all you need."
      />
      <Card>
        {photo === null ? (
          <View style={styles.captureOptions}>
            <View style={styles.dropzone}>
              <Text style={styles.icon}>◎</Text>
              <Text style={styles.title}>Take a photo now</Text>
              <Text style={styles.meta}>Use the front camera and preview it before upload.</Text>
              <Button title="Open camera" onPress={() => void takePhoto()} />
            </View>
            <Button
              title="Choose from your photos"
              variant="secondary"
              onPress={() => void choosePhoto()}
            />
            <Text style={styles.meta}>
              Front-facing photos work best. Side profiles are accepted for testing.
            </Text>
          </View>
        ) : (
          <View style={styles.previewWrap}>
            <Image source={{ uri: photo.uri }} style={styles.preview} />
            <Text style={styles.title}>Use this headshot?</Text>
            <Text style={styles.meta}>
              We’ll privately analyze it before generating your hairstyle.
            </Text>
            <Button
              disabled={processing}
              title={processing ? 'Uploading and checking…' : 'Use this headshot'}
              onPress={() => void upload()}
            />
            <View style={styles.captureOptions}>
              <Button
                disabled={processing}
                title="Retake photo"
                variant="secondary"
                onPress={() => void takePhoto()}
              />
              <Pressable disabled={processing} onPress={() => void choosePhoto()}>
                <Text style={styles.change}>Choose another photo</Text>
              </Pressable>
            </View>
          </View>
        )}
        {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.title}>For the best preview</Text>
        <Text style={styles.meta}>• Face forward when possible and use even lighting</Text>
        <Text style={styles.meta}>• Keep your full hair and hairline visible</Text>
        <Text style={styles.meta}>
          • Natural, unfiltered photos produce the most realistic result
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  captureOptions: { gap: spacing.md },
  change: { ...typography.button, color: colors.goldText, textAlign: 'center' },
  dropzone: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  error: { ...typography.bodySmall, color: colors.error, marginTop: spacing.md },
  icon: { color: colors.accentLight, fontSize: 42 },
  meta: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  preview: { borderRadius: 16, height: 390, width: '100%' },
  previewWrap: { gap: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
});
