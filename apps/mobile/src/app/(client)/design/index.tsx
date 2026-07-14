import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { HAIR_STYLES, type HairStyleCategory } from '@/lib/hairStyles';
import { colors, spacing, typography } from '@/theme';

export default function HairDesignScreen(): React.ReactElement {
  const [category, setCategory] = useState<HairStyleCategory>('haircut');
  const [styleName, setStyleName] = useState('Fade');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const designs = useQuery({ queryKey: ['hair-designs'], queryFn: mobileApi.client.designs });
  const save = useMutation({
    mutationFn: () =>
      mobileApi.client.createDesign({
        styleName,
        styleCategory: category,
        description: description || undefined,
      }),
    onSuccess: async () => {
      setMessage('Look saved for your barber. AI image previews are coming next.');
      await designs.refetch();
    },
  });
  const choosePhoto = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Hair Design Studio"
        subtitle="Tell your barber exactly what you want."
      />
      <Card>
        <Text style={styles.step}>1 · Your photo</Text>
        {photoUri === null ? (
          <Text style={styles.meta}>Use a front-facing photo with clear lighting.</Text>
        ) : (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        )}
        <Button
          title={photoUri === null ? 'Choose photo' : 'Replace photo'}
          variant="secondary"
          onPress={() => void choosePhoto()}
        />
      </Card>
      <Card>
        <Text style={styles.step}>2 · Style direction</Text>
        <View style={styles.row}>
          {(Object.keys(HAIR_STYLES) as HairStyleCategory[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setCategory(value);
                setStyleName(HAIR_STYLES[value][0]);
              }}
              style={[styles.chip, category === value && styles.chipActive]}
            >
              <Text style={styles.chipText}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.styles}>
          {HAIR_STYLES[category].map((style) => (
            <Pressable
              key={style}
              onPress={() => setStyleName(style)}
              style={[styles.style, styleName === style && styles.styleActive]}
            >
              <Text style={styles.styleName}>{style}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <Text style={styles.step}>3 · Details</Text>
        <Input
          label="Describe your vision"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Low fade, natural texture, clean neckline..."
        />
      </Card>
      <Card>
        <Text style={styles.previewTitle}>AI preview coming soon</Text>
        <Text style={styles.meta}>
          Your written brief is available now and can be attached to a booking. Image generation
          will use this same workflow.
        </Text>
        <Text style={styles.summary}>
          {styleName}
          {description.length > 0 ? ` · ${description}` : ''}
        </Text>
        <Button
          title={save.isPending ? 'Saving...' : 'Save look'}
          disabled={save.isPending}
          onPress={() => save.mutate()}
        />
      </Card>
      {message !== null ? <Text style={styles.success}>{message}</Text> : null}
      {save.isError ? <Text style={styles.error}>{errorMessage(save.error)}</Text> : null}
      {(designs.data?.designs ?? []).map((design) => (
        <Card key={design.id}>
          <Text style={styles.styleName}>{design.styleName}</Text>
          <Text style={styles.meta}>{design.description ?? 'No extra details'}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: colors.info, borderColor: colors.info },
  chipText: { ...typography.caption, color: colors.textPrimary, textTransform: 'capitalize' },
  error: { ...typography.bodySmall, color: colors.error },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  photo: { borderRadius: 8, height: 240, width: '100%' },
  previewTitle: { ...typography.h2, color: colors.accentLight },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  step: { ...typography.h3, color: colors.textPrimary },
  style: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '45%',
    padding: spacing.sm,
  },
  styleActive: { borderColor: colors.accent },
  styleName: { ...typography.label, color: colors.textPrimary },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  success: { ...typography.bodySmall, color: colors.success },
  summary: { ...typography.body, color: colors.textPrimary },
});
