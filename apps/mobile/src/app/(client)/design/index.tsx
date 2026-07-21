import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function HairDesignStudioScreen(): React.ReactElement {
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const config = useQuery({
    queryKey: ['hair-studio-config'],
    queryFn: mobileApi.client.hairStudioConfig,
  });
  const designs = useQuery({
    queryKey: ['hair-designs'],
    queryFn: mobileApi.client.designs,
    refetchInterval: (query) =>
      query.state.data?.designs.some((design) =>
        ['QUEUED', 'PROCESSING'].includes(design.generationStatus ?? ''),
      )
        ? 2000
        : false,
  });
  const begin = useMutation({
    mutationFn: () =>
      mobileApi.client.createHairScan({
        consentAccepted: true,
        ageConfirmed: true,
        consentVersion: config.data?.consentVersion ?? '2026-07-17',
      }),
    onSuccess: (scan) => router.push(`/(client)/design/photo?scanId=${scan.id}`),
  });

  const enabled = config.data?.enabled !== false;
  return (
    <Screen refreshing={designs.isFetching} onRefresh={() => void designs.refetch()}>
      <ScreenHeader
        showBack
        title="AI Hair Studio"
        subtitle="See the look before you sit in the chair."
      />
      <Card>
        <Text style={styles.eyebrow}>PRIVATE AI PREVIEW</Text>
        <Text style={styles.hero}>Your next cut, visualized on you.</Text>
        <Text style={styles.meta}>
          Upload one clear headshot, choose a style, and receive a private visualization your barber
          can use as a reference.
        </Text>
        <View style={styles.steps}>
          <Text style={styles.step}>01 · Photo</Text>
          <Text style={styles.step}>02 · Style</Text>
          <Text style={styles.step}>03 · Preview</Text>
        </View>
      </Card>
      <Card>
        <Text style={styles.title}>Before you begin</Text>
        <Text style={styles.meta}>
          Use even lighting and keep your hairline visible. Raw captures expire after{' '}
          {config.data?.retentionHours ?? 24} hours.
        </Text>
        <View style={styles.consentRow}>
          <Text style={styles.consentText}>I confirm I am at least 18.</Text>
          <Switch value={adult} onValueChange={setAdult} />
        </View>
        <View style={styles.consentRow}>
          <Text style={styles.consentText}>I consent to private face-image processing.</Text>
          <Switch value={consent} onValueChange={setConsent} />
        </View>
        <Button
          disabled={!adult || !consent || !enabled || begin.isPending}
          title={begin.isPending ? 'Preparing upload…' : 'Choose a headshot'}
          onPress={() => begin.mutate()}
        />
        {!enabled ? (
          <Text style={styles.error}>AI previews are temporarily unavailable.</Text>
        ) : null}
        {begin.isError ? <Text style={styles.error}>{errorMessage(begin.error)}</Text> : null}
        {config.data?.isMock === true ? (
          <Text style={styles.warning}>
            Demo provider is active. It checks the full private job flow but returns your original
            portrait unchanged.
          </Text>
        ) : null}
      </Card>
      <View style={styles.sectionHeading}>
        <Text style={styles.title}>Saved looks</Text>
        <Text style={styles.meta}>{designs.data?.designs.length ?? 0} private previews</Text>
      </View>
      {(designs.data?.designs ?? []).map((design) => (
        <Pressable
          key={design.id}
          onPress={() => router.push(`/(client)/design/result/${design.id}`)}
        >
          <Card>
            <View style={styles.savedRow}>
              {design.generatedPreviewUrl !== null ? (
                <Image source={{ uri: design.generatedPreviewUrl }} style={styles.thumbnail} />
              ) : (
                <View style={[styles.thumbnail, styles.placeholder]}>
                  <Text style={styles.sparkle}>✦</Text>
                </View>
              )}
              <View style={styles.savedCopy}>
                <Text style={styles.title}>{design.styleName}</Text>
                <Text style={styles.meta}>{design.styleCategory}</Text>
                <Text style={styles.status}>
                  {(design.generationStatus ?? design.aiStatus).toLowerCase()}
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
      {(designs.data?.designs.length ?? 0) === 0 ? (
        <Text style={styles.meta}>Your generated looks will appear here.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  consentRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  consentText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  error: { ...typography.bodySmall, color: colors.error },
  eyebrow: { ...typography.caption, color: colors.accentLight, letterSpacing: 1.4 },
  hero: { ...typography.h1, color: colors.textPrimary },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
  savedCopy: { flex: 1, gap: spacing.xs },
  savedRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  sectionHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  sparkle: { color: colors.accentLight, fontSize: 24 },
  status: { ...typography.caption, color: colors.success, textTransform: 'uppercase' },
  step: { ...typography.caption, color: colors.textPrimary },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  thumbnail: { borderRadius: 12, height: 88, width: 72 },
  title: { ...typography.h3, color: colors.textPrimary },
  warning: { ...typography.bodySmall, color: colors.warning },
});
