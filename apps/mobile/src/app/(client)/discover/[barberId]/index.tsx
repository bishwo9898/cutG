import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ReviewCard } from '@/components/barber/ReviewCard';
import { ServiceCard } from '@/components/barber/ServiceCard';
import { SlotGrid } from '@/components/barber/SlotGrid';
import { Screen } from '@/components/layout/Screen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StarRating } from '@/components/ui/StarRating';
import {
  useBarberProfile,
  useBarberReviews,
  useBarberServices,
  useBarberSlots,
  useSaveBarber,
} from '@/hooks/useBarbers';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const tabs = ['Services', 'Availability', 'Reviews'] as const;

type ProfileTab = (typeof tabs)[number];

export default function BarberProfileScreen(): React.ReactElement {
  const { barberId = '' } = useLocalSearchParams<{ barberId?: string }>();
  const [tab, setTab] = useState<ProfileTab>('Services');
  const profile = useBarberProfile(barberId);
  const services = useBarberServices(barberId);
  const slots = useBarberSlots(barberId);
  const reviews = useBarberReviews(barberId);
  const saveBarber = useSaveBarber();
  const serviceList = listFromResponse(services.data ?? {});
  const slotList = listFromResponse(slots.data ?? {});
  const reviewList = listFromResponse(reviews.data ?? {});

  if (profile.data === undefined && profile.isLoading)
    return (
      <Screen>
        <EmptyState title="Loading profile" message="Getting barber details." />
      </Screen>
    );
  if (profile.data === undefined)
    return (
      <Screen>
        <EmptyState title="Profile unavailable" message="This barber could not be loaded." />
      </Screen>
    );

  return (
    <Screen
      refreshing={profile.isFetching}
      onRefresh={() => {
        void profile.refetch();
      }}
    >
      <View style={styles.heroWrap}>
        {profile.data.profilePhotoUrl !== null ? (
          <Image source={{ uri: profile.data.profilePhotoUrl }} style={styles.hero} />
        ) : (
          <View style={styles.heroFallback} />
        )}
        <Pressable
          style={styles.heart}
          onPress={() => {
            void saveBarber.mutateAsync(barberId);
          }}
        >
          <Text style={styles.heartText}>♡</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{profile.data.businessName}</Text>
      <View style={styles.row}>
        <StarRating value={Math.round(profile.data.averageRating)} />
        <Text style={styles.meta}>
          {profile.data.averageRating.toFixed(1)} ({profile.data.totalReviews})
        </Text>
        {profile.data.isVerified ? <Badge label="Verified" tone="success" /> : null}
      </View>
      <Text style={styles.meta}>
        {[profile.data.city, profile.data.state].filter(Boolean).join(', ')}
      </Text>
      <Text style={styles.body}>{profile.data.bio ?? 'No bio yet.'}</Text>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Button
            key={item}
            title={item}
            onPress={() => setTab(item)}
            variant={tab === item ? 'primary' : 'secondary'}
          />
        ))}
      </View>
      {tab === 'Services'
        ? serviceList.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onPress={() => router.push('/(client)/discover/' + barberId + '/book/service')}
            />
          ))
        : null}
      {tab === 'Availability' ? (
        <SlotGrid
          slots={slotList}
          onSelect={() => router.push('/(client)/discover/' + barberId + '/book/service')}
        />
      ) : null}
      {tab === 'Reviews'
        ? reviewList.map((review) => <ReviewCard key={review.id} review={review} />)
        : null}
      <Button
        title="Book Now"
        onPress={() => router.push('/(client)/discover/' + barberId + '/book/service')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  heart: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 44,
  },
  heartText: {
    color: colors.accentLight,
    fontSize: 24,
  },
  hero: {
    height: 260,
    width: '100%',
  },
  heroFallback: {
    backgroundColor: colors.surfaceRaised,
    height: 260,
  },
  heroWrap: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
});
