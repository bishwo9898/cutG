import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { mobileApi } from '@/lib/apiClient';
import type { AppointmentTimeline } from '@/lib/types';

const activeTravelStatuses = ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED'];

export const useAppointmentStatus = (
  appointmentId: string,
  scheduledDate?: string,
): UseQueryResult<AppointmentTimeline> =>
  useQuery({
    queryKey: ['appointments', 'status-updates', appointmentId],
    queryFn: () => mobileApi.client.appointmentStatusUpdates(appointmentId),
    enabled: appointmentId.length > 0,
    refetchInterval: (query) => {
      const timeline = query.state.data;
      const today = new Date().toISOString().slice(0, 10);
      return timeline !== undefined &&
        scheduledDate === today &&
        activeTravelStatuses.includes(timeline.currentStatus)
        ? 30_000
        : false;
    },
  });
