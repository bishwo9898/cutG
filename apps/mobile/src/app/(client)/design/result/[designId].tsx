import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

const generationLabel = (status: string | null | undefined, progress: number): string => {
  if (status === 'QUEUED') return 'Queued securely';
  if (progress >= 85) return 'Saving your preview';
  if (progress >= 45) return 'Generating your preview';
  return 'Preparing your requested edit';
};

export default function HairDesignResultScreen(): React.ReactElement {
  const { designId = '' } = useLocalSearchParams<{ designId?: string }>();
  const queryClient = useQueryClient();
  const [showAfter, setShowAfter] = useState(true);
  const design = useQuery({
    queryKey: ['hair-design', designId],
    queryFn: () => mobileApi.client.design(designId),
    enabled: designId.length > 0,
    refetchInterval: (query) =>
      ['QUEUED', 'PROCESSING'].includes(query.state.data?.generationStatus ?? '') ? 2000 : false,
  });
  const retry = useMutation({
    mutationFn: () =>
      mobileApi.client.retryDesign(designId, { idempotencyKey: Crypto.randomUUID() }),
    onSuccess: (updated) => queryClient.setQueryData(['hair-design', designId], updated),
  });
  const remove = useMutation({
    mutationFn: () => mobileApi.client.deleteDesign(designId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['hair-designs'] });
      router.replace('/(client)/design');
    },
  });

  const active = ['QUEUED', 'PROCESSING'].includes(design.data?.generationStatus ?? '');
  const current = design.data;
  const progress = Math.min(100, Math.max(0, current?.progress ?? 0));
  if (active || design.isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.loader}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.eyebrow}>AI VISUALIZATION IN PROGRESS</Text>
          <Text style={styles.loaderTitle}>
            {generationLabel(current?.generationStatus, progress)}
          </Text>
          <Text style={styles.meta}>
            This bar advances only when the generation service completes a real processing
            milestone.
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
      </Screen>
    );
  }

  if (current?.generationStatus === 'FAILED') {
    return (
      <Screen>
        <ScreenHeader showBack title="Preview needs another pass" />
        <Card>
          <Text style={styles.title}>We could not complete this visualization.</Text>
          <Text style={styles.meta}>
            {current.errorMessage ?? 'Please retry or capture a new portrait.'}
          </Text>
          <Button
            disabled={retry.isPending}
            title={retry.isPending ? 'Retrying…' : 'Retry generation'}
            onPress={() => retry.mutate()}
          />
          <Button
            title="Retake photo"
            variant="secondary"
            onPress={() => router.replace('/(client)/design')}
          />
        </Card>
        {retry.isError ? <Text style={styles.error}>{errorMessage(retry.error)}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        showBack
        title={current?.styleName ?? 'Your preview'}
        subtitle="AI-generated style reference"
      />
      <View style={styles.resultFrame}>
        {showAfter && current?.generatedPreviewUrl !== null ? (
          <Image source={{ uri: current?.generatedPreviewUrl }} style={styles.resultImage} />
        ) : current?.sourcePhotoUrl !== null ? (
          <Image source={{ uri: current?.sourcePhotoUrl }} style={styles.resultImage} />
        ) : null}
        <View style={styles.labels}>
          <Text style={styles.label}>{showAfter ? 'AI PREVIEW' : 'ORIGINAL'}</Text>
          <Pressable style={styles.toggle} onPress={() => setShowAfter((value) => !value)}>
            <Text style={styles.toggleText}>{showAfter ? 'Show before' : 'Show after'}</Text>
          </Pressable>
        </View>
      </View>
      <Card>
        <Text style={styles.title}>{current?.styleName}</Text>
        <Text style={styles.meta}>{current?.description}</Text>
        <Text style={styles.disclaimer}>
          This is a visualization for communicating with your barber, not a guaranteed haircut
          outcome.
        </Text>
      </Card>
      <Button
        title="Find a barber for this look"
        onPress={() => router.push(`/(client)/discover/search?designId=${designId}`)}
      />
      <View style={styles.actions}>
        <Button
          title="Try another"
          variant="secondary"
          onPress={() => router.replace('/(client)/design')}
        />
        <Button
          title="Share"
          variant="secondary"
          onPress={() =>
            void Share.share({
              message: `My cutG ${current?.styleName ?? 'hair'} preview`,
              url: current?.generatedPreviewUrl ?? undefined,
            })
          }
        />
        <Button
          disabled={remove.isPending}
          title="Delete"
          variant="danger"
          onPress={() => remove.mutate()}
        />
      </View>
      {remove.isError ? <Text style={styles.error}>{errorMessage(remove.error)}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  disclaimer: { ...typography.caption, color: colors.warning },
  error: { ...typography.bodySmall, color: colors.error },
  eyebrow: {
    ...typography.caption,
    color: colors.accentLight,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  label: { ...typography.caption, color: '#fff' },
  labels: {
    alignItems: 'center',
    bottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
  },
  loader: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loaderTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  meta: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  progressFill: { backgroundColor: colors.accent, borderRadius: 4, height: 6 },
  progressValue: { ...typography.label, color: colors.accentLight },
  progressTrack: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  resultFrame: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 480,
    overflow: 'hidden',
  },
  resultImage: { height: '100%', resizeMode: 'cover', width: '100%' },
  sparkle: { color: colors.accentLight, fontSize: 54 },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  toggle: {
    backgroundColor: 'rgba(0,0,0,.65)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleText: { ...typography.caption, color: '#fff' },
});
