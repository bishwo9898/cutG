import { format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { AppointmentSummary } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type AppointmentCardProps = {
  appointment: AppointmentSummary;
  mode: 'client' | 'barber';
  onPrimaryAction?: () => void;
};

const formatDate = (date: string): string => {
  try {
    return format(parseISO(date), 'EEE, MMM d');
  } catch {
    return date;
  }
};

export const AppointmentCard = ({
  appointment,
  mode,
  onPrimaryAction,
}: AppointmentCardProps): React.ReactElement => {
  const route =
    mode === 'client'
      ? '/(client)/appointments/' + appointment.id
      : '/(barber)/appointments/' + appointment.id;
  const name =
    mode === 'client' ? (appointment.barberName ?? 'Barber') : (appointment.clientName ?? 'Client');

  return (
    <Pressable onPress={() => router.push(route)}>
      <Card>
        <View style={styles.row}>
          <Avatar imageUrl={appointment.barberPhotoUrl} name={name} />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{name}</Text>
              <Badge label={appointment.status} tone={statusTone(appointment.status)} />
            </View>
            <Text style={styles.meta}>{appointment.serviceName}</Text>
            {appointment.isMobileService === true ? (
              <>
                <Badge label="Mobile" tone="info" />
                <Text style={styles.meta}>
                  {appointment.serviceAddress?.addressLine1}, {appointment.serviceAddress?.city}
                </Text>
              </>
            ) : null}
            <Text style={styles.meta}>
              {formatDate(appointment.scheduledDate)} at {appointment.startTime}
            </Text>
            <Text style={styles.price}>
              {'$' + appointment.price.toFixed(2) + ' · ' + appointment.paymentStatus}
            </Text>
            {onPrimaryAction !== undefined ? (
              <Button title="Navigate" onPress={onPrimaryAction} variant="secondary" />
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  price: {
    ...typography.label,
    color: colors.gold,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
