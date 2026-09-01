import { HAIR_STYLE_CATALOG } from '@barber-saas/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

type Category = (typeof HAIR_STYLE_CATALOG)[number]['category'];

export default function HairStyleScreen(): React.ReactElement {
  const { scanId = '' } = useLocalSearchParams<{ scanId?: string }>();
  const [category, setCategory] = useState<Category>('haircut');
  const [styleId, setStyleId] = useState<string>('textured-crop');
  const [direction, setDirection] = useState('');
  const scan = useQuery({
    queryKey: ['hair-scan', scanId],
    queryFn: () => mobileApi.client.hairScan(scanId),
    enabled: scanId.length > 0,
  });
  const selected = useMemo(
    () => HAIR_STYLE_CATALOG.find((style) => style.id === styleId),
    [styleId],
  );
  const isCustom = styleId === 'custom';
  const customDescription = direction.trim();
  const canGenerate = isCustom ? customDescription.length >= 3 : selected !== undefined;
  const visible = HAIR_STYLE_CATALOG.filter((style) => style.category === category);
  const generate = useMutation({
    mutationFn: () => {
      if (!canGenerate) throw new Error('Choose a style or describe the hairstyle you want.');
      return mobileApi.client.generateDesign({
        scanId,
        styleName: isCustom ? customDescription.slice(0, 100) : selected?.name,
        styleCategory: isCustom ? category : selected?.category,
        description: isCustom
          ? customDescription
          : [selected?.description, customDescription].filter(Boolean).join(' '),
        idempotencyKey: Crypto.randomUUID(),
      });
    },
    onSuccess: (design) => router.replace(`/(client)/design/result/${design.id}`),
  });

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Choose your look"
        subtitle="Only the selected details will change."
      />
      <Card>
        <Text style={styles.eyebrow}>SCAN ACCEPTED</Text>
        <Text style={styles.title}>Your portrait passed the quality check.</Text>
        <Text style={styles.meta}>
          {scan.data?.captures.length ?? 3} angles secured · private processing
        </Text>
      </Card>
      <View style={styles.tabs}>
        {(['haircut', 'beard', 'color', 'combo'] as Category[]).map((value) => (
          <Pressable
            key={value}
            onPress={() => {
              setCategory(value);
              const first = HAIR_STYLE_CATALOG.find((style) => style.category === value);
              if (first !== undefined) setStyleId(first.id);
            }}
            style={[styles.tab, category === value && styles.tabActive]}
          >
            <Text style={[styles.tabText, category === value && styles.tabTextActive]}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {visible.map((style) => (
          <Pressable
            key={style.id}
            onPress={() => setStyleId(style.id)}
            style={[styles.styleCard, styleId === style.id && styles.styleSelected]}
          >
            <Text style={styles.styleName}>{style.name}</Text>
            <Text style={styles.meta}>{style.description}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setStyleId('custom')}
          style={[styles.styleCard, styleId === 'custom' && styles.styleSelected]}
        >
          <Text style={styles.styleName}>Describe my own</Text>
          <Text style={styles.meta}>Type the exact hairstyle you want the AI to create.</Text>
        </Pressable>
      </View>
      <Card>
        <Text style={styles.title}>
          {isCustom ? 'Describe your hairstyle' : 'Describe the details'}
        </Text>
        <Text style={styles.meta}>
          {isCustom
            ? 'Required. Include length, texture, fade or taper placement, shape, styling, facial-hair changes, and color.'
            : 'Optional notes are shared with the AI and your barber.'}
        </Text>
        <TextInput
          multiline
          maxLength={800}
          onChangeText={setDirection}
          placeholder={
            isCustom
              ? 'Three-inch waves, low temple taper, rounded shape, styled forward, shorter beard, dark brown...'
              : 'Keep more length at the crown, soften the temple blend...'
          }
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={direction}
        />
      </Card>
      {selected !== undefined || (isCustom && customDescription.length > 0) ? (
        <Card>
          <Text style={styles.eyebrow}>SELECTED LOOK</Text>
          <Text style={styles.title}>{isCustom ? 'Custom hairstyle' : selected?.name}</Text>
          <Text style={styles.meta}>{isCustom ? customDescription : selected?.description}</Text>
          {!isCustom && customDescription.length > 0 ? (
            <Text style={styles.note}>+ {customDescription}</Text>
          ) : null}
        </Card>
      ) : null}
      <Button
        disabled={!canGenerate || generate.isPending || scan.data?.status !== 'READY'}
        title={generate.isPending ? 'Starting preview…' : '✨ Generate my look'}
        onPress={() => generate.mutate()}
      />
      {generate.isError ? <Text style={styles.error}>{errorMessage(generate.error)}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.bodySmall, color: colors.error },
  eyebrow: { ...typography.caption, color: colors.success, letterSpacing: 1.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 110,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  note: { ...typography.bodySmall, color: colors.goldText },
  styleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 112,
    padding: spacing.md,
    width: '48%',
  },
  styleName: { ...typography.label, color: colors.textPrimary },
  styleSelected: { borderColor: colors.accent, borderWidth: 2 },
  tab: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabActive: { backgroundColor: colors.accent },
  tabText: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  tabTextActive: { color: colors.textOnAccent },
  tabs: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...typography.h3, color: colors.textPrimary },
});
